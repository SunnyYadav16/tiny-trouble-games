import Anthropic, { AuthenticationError, PermissionDeniedError } from '@anthropic-ai/sdk';
import { LlmAuthError, type Llm } from './llm';
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

/** From the claude-api skill (models cached 2026-10-06): the current Opus proposes, the cheaper Sonnet tier reviews. */
export const PROPOSER_MODEL = 'claude-opus-5-5';
export const REVIEWER_MODEL = 'claude-sonnet-5-5';

const MAX_TOKENS = 16_000;
const EFFORT = 'medium';
const jsonFormat = (schema: Record<string, unknown>) => ({ type: 'json_schema' as const, schema });

/** 401 and 403 mean the key itself is refused; anything else is one failed try. */
const keyRejected = (e: unknown): never => {
  if (e instanceof AuthenticationError || e instanceof PermissionDeniedError) throw new LlmAuthError(`Anthropic rejected the API key: ${e.message}`);
  throw e;
};

/** Concatenated text of the reply. Refusals and truncation throw. */
async function ask(client: Anthropic, params: Anthropic.MessageCreateParamsNonStreaming): Promise<string> {
  const res = await client.messages.create(params).catch(keyRejected);
  if (res.stop_reason !== 'end_turn') throw new Error(`${params.model} stopped: ${res.stop_reason}`);
  return res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
}

/**
 * The real Llm. No server-side refusal fallback: a fallback could answer as the
 * proposer's model, and the reviewer must stay a different model. A refusal
 * throws, and refill retries the slot.
 */
export function createAnthropicLlm(apiKey: string, models = { proposer: PROPOSER_MODEL, reviewer: REVIEWER_MODEL }): Llm {
  if (models.proposer === models.reviewer) throw new Error('the proposer and reviewer must be different models');
  const client = new Anthropic({ apiKey });
  return {
    async propose(r) {
      const text = await ask(client, {
        model: models.proposer,
        max_tokens: MAX_TOKENS,
        output_config: { effort: EFFORT, format: jsonFormat(PROPOSE_SCHEMA) },
        system: PROPOSE_SYSTEM,
        messages: [{ role: 'user', content: proposePrompt(r) }],
      });
      return parseCandidate(text);
    },
    async review(r) {
      const text = await ask(client, {
        model: models.reviewer,
        max_tokens: MAX_TOKENS,
        output_config: { effort: EFFORT, format: jsonFormat(REVIEW_SCHEMA) },
        system: REVIEW_SYSTEM,
        messages: [{ role: 'user', content: reviewPrompt(r) }],
      });
      return parseReview(text);
    },
    async solve(r) {
      const text = await ask(client, {
        model: models.reviewer,
        max_tokens: MAX_TOKENS,
        output_config: { effort: EFFORT, format: jsonFormat(GUESSES_SCHEMA) },
        messages: [{ role: 'user', content: solvePrompt(r) }],
      });
      return parseGuesses(text);
    },
  };
}
