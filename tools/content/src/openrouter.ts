import { setTimeout as sleep } from 'node:timers/promises';
import { LlmAuthError, LlmQuotaError, LlmUnavailableError, type Llm, type Spent } from './llm';
import { parseCandidate, parseGuesses, parseReview, PROPOSE_SYSTEM, proposePrompt, REVIEW_SYSTEM, reviewPrompt, solvePrompt } from './prompts';

/**
 * N27, from openrouter.ai/api/v1/models (read 2026-10-19): free (`:free`) models from two labs, both listing
 * response_format, reasoning, and max_tokens. Free keys get 50 requests a day. The reviewer is Nvidia's Nemotron: Gemma's free
 * provider (Google AI Studio) answered every live review with a 429, while OpenRouter's public endpoints API (2026-10-19) showed
 * Nemotron on Nvidia at 100% uptime over 30 minutes, with response_format and reasoning, max output 235,929.
 */
export const OPENROUTER_PROPOSER_MODEL = 'minimax/minimax-m3.1-flash:free';
export const OPENROUTER_REVIEWER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 120_000;
const TRIES = 4;
/** Seconds waited before the 2nd, 3rd, and 4th try when the provider gives no usable Retry-After. */
const BACKOFF = [5, 15, 30];
const MAX_TOKENS = 2_000;

interface OpenRouterError {
  message?: string;
  metadata?: unknown;
}
interface Completion {
  error?: OpenRouterError;
  choices?: { finish_reason?: string | null; message?: { content?: unknown }; error?: OpenRouterError }[];
  usage?: { cost?: unknown };
}

/**
 * A 403 that blocked this one request's content, per the errors docs: moderation (`reasons`, `flagged_input`),
 * a guardrail (`patterns`), or a policy block (`error_type` content_policy_violation or refusal). Any other 403 is the key.
 */
const contentBlocked = (m: unknown) =>
  typeof m === 'object' &&
  m !== null &&
  ('reasons' in m || 'flagged_input' in m || 'patterns' in m || ['content_policy_violation', 'refusal'].includes(String((m as { error_type?: unknown }).error_type)));

/**
 * A 429 for the free-model daily cap. openrouter.ai/docs/api_reference/limits: a platform 429 carries X-RateLimit-Limit for the
 * limit hit, and the tiers are 20/min vs 50 or 1000/day, so a limit over 20 is the daily cap. Fallbacks: the message names the
 * day (OpenRouter's reads "free-models-per-day"), or Retry-After is over a minute (sent only for provider-side limits, which also stop the run).
 */
const dailyLimit = (message: string | undefined, headers: Headers) =>
  Number(headers.get('x-ratelimit-limit')) > 20 || /per-day|daily/i.test(message ?? '') || Number(headers.get('retry-after')) > 60;

/** Seconds before retry `attempt` (1-based): Retry-After when it is a number of seconds up to 60, else 5, 15, then 30. */
export function retryWait(retryAfter: string | null, attempt: number): number {
  const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN;
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 60 ? seconds : BACKOFF[Math.min(attempt, BACKOFF.length) - 1]!;
}

const unavailable = (model: string, why: string) =>
  new LlmUnavailableError(
    `${model} is busy or down at its provider (${why}); stopped to save your free requests — try again later or set OPENROUTER_REVIEWER_MODEL / OPENROUTER_PROPOSER_MODEL`,
  );

export function createOpenRouterLlm(
  apiKey: string,
  models = { proposer: OPENROUTER_PROPOSER_MODEL, reviewer: OPENROUTER_REVIEWER_MODEL },
  fetchFn: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => sleep(ms),
): Llm {
  if (models.proposer === models.reviewer) throw new Error('the proposer and reviewer must be different models');
  const spent: Spent = { propose: 0, review: 0, solve: 0 };
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/SunnyYadav16/tiny-trouble-games',
    'X-OpenRouter-Title': 'Tiny Trouble Games',
  };

  /** One completion's text, as a JSON object. Retries 408, 429, 5xx, timeouts, and network errors with spaced waits, then stops the run; a refused key, no credits, the free daily limit, or no provider for the request stops the run. */
  async function ask(stage: keyof Spent, model: string, messages: { role: 'system' | 'user'; content: string }[]): Promise<string> {
    // Every reply is a short JSON object, so low reasoning effort and a 2,000-token cap keep a call from spending its time on long
    // hidden thinking (on shared free capacity that made a refill crawl). A reply cut off at the cap fails its try with a message saying so.
    // The free endpoints lack structured_outputs (a json_schema request finds no endpoint and 404s), so ask for JSON mode, which they
    // support; the prompts state each reply's shape and the shared guards reject a wrong one.
    // require_parameters routes only to providers that honor response_format.
    const body = JSON.stringify({ model, messages, max_tokens: MAX_TOKENS, reasoning: { effort: 'low' }, provider: { require_parameters: true }, response_format: { type: 'json_object' } });
    // Waits before the next try, or stops the run when this was the last one.
    const backoff = async (attempt: number, retryAfter: string | null, why: string) => {
      if (attempt >= TRIES) throw unavailable(model, why);
      await wait(1000 * retryWait(retryAfter, attempt));
    };
    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await fetchFn(ENDPOINT, { method: 'POST', headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (e) {
        // A timeout or network error: the provider is silent, so it follows the same wait-then-stop rule as a busy one.
        await backoff(attempt, null, (e as Error).message);
        continue;
      }
      if (res.ok) {
        const data = (await res.json()) as Completion;
        // Billed even when the reply is unusable.
        if (typeof data.usage?.cost === 'number') spent[stage] += data.usage.cost;
        if (data.error) throw new Error(`${model} error: ${data.error.message}`);
        const choice = data.choices?.[0];
        if (!choice) throw new Error(`${model} returned no choices`);
        if (choice.finish_reason === 'length') throw new Error(`${model} stopped: length (output cap of ${MAX_TOKENS} tokens reached)`);
        if (choice.finish_reason !== 'stop') throw new Error(`${model} stopped: ${choice.finish_reason}${choice.error ? `: ${choice.error.message}` : ''}`);
        const text = choice.message?.content;
        if (typeof text !== 'string' || !text) throw new Error(`${model} returned no text`);
        return text;
      }
      const error = ((await res.json().catch(() => ({}))) as Completion).error;
      const detail = `${model} HTTP ${res.status}: ${error?.message ?? res.statusText}`;
      if (res.status === 401 || (res.status === 403 && !contentBlocked(error?.metadata))) throw new LlmAuthError(`OpenRouter rejected the API key: ${detail}`);
      if (res.status === 404 && /no endpoints/i.test(error?.message ?? '')) throw new LlmAuthError(`OpenRouter has no provider for ${model} with these settings: ${error?.message}`);
      if (res.status === 402) throw new LlmAuthError(`OpenRouter is out of credits; add credits or raise the key's limit, then run again: ${detail}`);
      if (res.status === 429 && dailyLimit(error?.message, res.headers)) {
        throw new LlmQuotaError(`OpenRouter free daily limit reached — run again tomorrow (or add credits to raise it): ${detail}`);
      }
      if (res.status === 408 || res.status === 429 || res.status >= 500) {
        await backoff(attempt, res.headers.get('retry-after'), `HTTP ${res.status}: ${error?.message ?? res.statusText}`);
        continue;
      }
      throw new Error(detail);
    }
  }

  return {
    spent,
    propose: async (r) =>
      parseCandidate(await ask('propose', models.proposer, [{ role: 'system', content: PROPOSE_SYSTEM }, { role: 'user', content: proposePrompt(r) }])),
    review: async (r) =>
      parseReview(await ask('review', models.reviewer, [{ role: 'system', content: REVIEW_SYSTEM }, { role: 'user', content: reviewPrompt(r) }])),
    solve: async (r) => parseGuesses(await ask('solve', models.reviewer, [{ role: 'user', content: solvePrompt(r) }])),
  };
}
