import { setTimeout as sleep } from 'node:timers/promises';
import { LlmAuthError, type Llm, type Spent } from './llm';
import {
  GUESSES_SCHEMA,
  parseCandidate,
  parseGuesses,
  parseReview,
  PROPOSE_SYSTEM,
  proposePrompt,
  REVIEW_SCHEMA,
  REVIEW_SYSTEM,
  reviewPrompt,
  solvePrompt,
} from './prompts';

/**
 * From openrouter.ai/api/v1/models (read 2026-10-19): a low-cost open model from one lab proposes,
 * an unmoderated low-cost model from another lab with structured outputs reviews.
 */
export const OPENROUTER_PROPOSER_MODEL = 'deepseek/deepseek-v4-pro';
export const OPENROUTER_REVIEWER_MODEL = 'google/gemini-3.1-flash-lite';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 120_000;
const TRIES = 3;
/**
 * OpenRouter's web search server tool on Parallel's turbo mode, the cheapest engine ($0.001 a search, English): at most 3 searches,
 * and max_tool_calls bounds the server-tool loop (default 30 steps, each a model turn) so a model looping on search stops early.
 */
const SEARCH = { tools: [{ type: 'openrouter:web_search', parameters: { engine: 'parallel', mode: 'turbo', max_results: 3, max_uses: 3 } }], max_tool_calls: 3 };

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

  /** One completion's text. Retries 408, 429, and 5xx; a refused key or no credits stops the run. */
  async function ask(stage: keyof Spent, model: string, messages: { role: 'system' | 'user'; content: string }[], extra: object): Promise<string> {
    // Effort and output cap mirror the other backends and bound the cost of one call.
    const body = JSON.stringify({ model, messages, max_tokens: 16_000, reasoning: { effort: 'medium' }, ...extra });
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
      if ((res.status === 408 || res.status === 429 || res.status >= 500) && attempt < TRIES) {
        await sleep(1000 * retryWait(res.headers.get('retry-after'), attempt));
        continue;
      }
      throw new Error(detail);
    }
  }

  return {
    spent,
    // Web search and JSON mode are not combined, so propose asks for JSON in the text like the other backends.
    propose: async (r) =>
      parseCandidate(await ask('propose', models.proposer, [{ role: 'system', content: PROPOSE_SYSTEM }, { role: 'user', content: proposePrompt(r) }], SEARCH)),
    review: async (r) =>
      parseReview(
        await ask('review', models.reviewer, [{ role: 'system', content: REVIEW_SYSTEM }, { role: 'user', content: reviewPrompt(r) }], {
          response_format: jsonSchema('review', REVIEW_SCHEMA),
        }),
      ),
    solve: async (r) =>
      parseGuesses(await ask('solve', models.reviewer, [{ role: 'user', content: solvePrompt(r) }], { response_format: jsonSchema('guesses', GUESSES_SCHEMA) })),
  };
}
