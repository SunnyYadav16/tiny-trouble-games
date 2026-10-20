import { setTimeout as sleep } from 'node:timers/promises';
import { LlmAuthError, LlmQuotaError, type Llm, type Spent } from './llm';
import {
  GUESSES_SCHEMA,
  parseCandidate,
  parseGuesses,
  parseReview,
  PROPOSE_SCHEMA,
  PROPOSE_SYSTEM,
  proposePrompt,
  REVIEW_SCHEMA,
  REVIEW_SYSTEM,
  reviewPrompt,
  solvePrompt,
} from './prompts';

/**
 * N27, from openrouter.ai/api/v1/models (read 2026-10-19): free (`:free`) models from two labs, both listing
 * response_format, reasoning, and max_tokens (Gemma's cap, 32,768, fits our 16,000). Free keys get 50 requests a day.
 */
export const OPENROUTER_PROPOSER_MODEL = 'minimax/minimax-m3.1-flash:free';
export const OPENROUTER_REVIEWER_MODEL = 'google/gemma-4-31b-it:free';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 120_000;
const TRIES = 3;

interface OpenRouterError {
  message?: string;
  metadata?: unknown;
}
interface Completion {
  error?: OpenRouterError;
  choices?: { finish_reason?: string | null; message?: { content?: unknown }; error?: OpenRouterError }[];
  usage?: { cost?: unknown };
}

const jsonSchema = (name: string, schema: object) => ({ type: 'json_schema', json_schema: { name, strict: true, schema } });

/**
 * A 403 that blocked this one request's content, per the errors docs: moderation (`reasons`, `flagged_input`),
 * a guardrail (`patterns`), or a policy block (`error_type` content_policy_violation or refusal). Any other 403 is the key.
 */
const contentBlocked = (m: unknown) =>
  typeof m === 'object' &&
  m !== null &&
  ('reasons' in m || 'flagged_input' in m || 'patterns' in m || ['content_policy_violation', 'refusal'].includes(String((m as { error_type?: unknown }).error_type)));

/**
 * A 429 for the free-model daily cap. openrouter.ai/docs/api_reference/limits names the cap (50/day, 20/min) but gives no
 * body marker, so: the message names the day (OpenRouter's reads "free-models-per-day"), or Retry-After is over a minute.
 */
const dailyLimit = (message: string | undefined, retryAfter: string | null) => /per-day|daily/i.test(message ?? '') || Number(retryAfter) > 60;

/** Seconds before retry `attempt`: Retry-After when it is a number of seconds, else 1, 2, ...; never over 60. */
export function retryWait(retryAfter: string | null, attempt: number): number {
  const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN;
  return Math.min(Number.isFinite(seconds) && seconds >= 0 ? seconds : 2 ** (attempt - 1), 60);
}

export function createOpenRouterLlm(
  apiKey: string,
  models = { proposer: OPENROUTER_PROPOSER_MODEL, reviewer: OPENROUTER_REVIEWER_MODEL },
  fetchFn: typeof fetch = fetch,
): Llm {
  if (models.proposer === models.reviewer) throw new Error('the proposer and reviewer must be different models');
  const spent: Spent = { propose: 0, review: 0, solve: 0 };
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/SunnyYadav16/tiny-trouble-games',
    'X-OpenRouter-Title': 'Tiny Trouble Games',
  };

  /** One completion's text, as JSON in `schema`. Retries 408, 429, and 5xx; a refused key, no credits, or the free daily limit stops the run. */
  async function ask(stage: keyof Spent, model: string, messages: { role: 'system' | 'user'; content: string }[], schema: object): Promise<string> {
    // Effort and output cap mirror the other backends and bound the cost of one call. require_parameters routes only to providers that honor response_format.
    const body = JSON.stringify({ model, messages, max_tokens: 16_000, reasoning: { effort: 'medium' }, provider: { require_parameters: true }, response_format: jsonSchema(stage, schema) });
    for (let attempt = 1; ; attempt++) {
      const res = await fetchFn(ENDPOINT, { method: 'POST', headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) {
        const data = (await res.json()) as Completion;
        // Billed even when the reply is unusable.
        if (typeof data.usage?.cost === 'number') spent[stage] += data.usage.cost;
        if (data.error) throw new Error(`${model} error: ${data.error.message}`);
        const choice = data.choices?.[0];
        if (!choice) throw new Error(`${model} returned no choices`);
        if (choice.finish_reason !== 'stop') throw new Error(`${model} stopped: ${choice.finish_reason}${choice.error ? `: ${choice.error.message}` : ''}`);
        const text = choice.message?.content;
        if (typeof text !== 'string' || !text) throw new Error(`${model} returned no text`);
        return text;
      }
      const error = ((await res.json().catch(() => ({}))) as Completion).error;
      const detail = `${model} HTTP ${res.status}: ${error?.message ?? res.statusText}`;
      if (res.status === 401 || (res.status === 403 && !contentBlocked(error?.metadata))) throw new LlmAuthError(`OpenRouter rejected the API key: ${detail}`);
      if (res.status === 402) throw new LlmAuthError(`OpenRouter is out of credits; add credits or raise the key's limit, then run again: ${detail}`);
      if (res.status === 429 && dailyLimit(error?.message, res.headers.get('retry-after'))) {
        throw new LlmQuotaError(`OpenRouter free daily limit reached — run again tomorrow (or add credits to raise it): ${detail}`);
      }
      if ((res.status === 408 || res.status === 429 || res.status >= 500) && attempt < TRIES) {
        await sleep(1000 * retryWait(res.headers.get('retry-after'), attempt));
        continue;
      }
      throw new Error(detail);
    }
  }

  return {
    spent,
    propose: async (r) =>
      parseCandidate(await ask('propose', models.proposer, [{ role: 'system', content: PROPOSE_SYSTEM }, { role: 'user', content: proposePrompt(r) }], PROPOSE_SCHEMA)),
    review: async (r) =>
      parseReview(await ask('review', models.reviewer, [{ role: 'system', content: REVIEW_SYSTEM }, { role: 'user', content: reviewPrompt(r) }], REVIEW_SCHEMA)),
    solve: async (r) => parseGuesses(await ask('solve', models.reviewer, [{ role: 'user', content: solvePrompt(r) }], GUESSES_SCHEMA)),
  };
}
