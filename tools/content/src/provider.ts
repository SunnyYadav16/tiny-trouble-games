import { createAnthropicLlm, PROPOSER_MODEL, REVIEWER_MODEL } from './anthropic';
import { createGeminiLlm, GEMINI_PROPOSER_MODEL, GEMINI_REVIEWER_MODEL } from './gemini';

/** N24: GEMINI_API_KEY when set, else ANTHROPIC_API_KEY. No client exists until `create` runs. */
export function chooseProvider(env: Record<string, string | undefined>) {
  const gemini = env.GEMINI_API_KEY;
  if (gemini) return { name: 'Gemini', proposer: GEMINI_PROPOSER_MODEL, reviewer: GEMINI_REVIEWER_MODEL, create: () => createGeminiLlm(gemini) };
  const anthropic = env.ANTHROPIC_API_KEY;
  if (anthropic) return { name: 'Anthropic', proposer: PROPOSER_MODEL, reviewer: REVIEWER_MODEL, create: () => createAnthropicLlm(anthropic) };
  throw new Error('Set GEMINI_API_KEY or ANTHROPIC_API_KEY in the environment; keys are never read from a file.');
}
