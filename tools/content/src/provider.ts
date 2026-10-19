import { createAnthropicLlm, PROPOSER_MODEL, REVIEWER_MODEL } from './anthropic';
import { createGeminiLlm, GEMINI_PROPOSER_MODEL, GEMINI_REVIEWER_MODEL } from './gemini';
import { createOpenRouterLlm, OPENROUTER_PROPOSER_MODEL, OPENROUTER_REVIEWER_MODEL } from './openrouter';

/** N25: OPENROUTER_API_KEY, else GEMINI_API_KEY (N24), else ANTHROPIC_API_KEY. No client exists until `create` runs. */
export function chooseProvider(env: Record<string, string | undefined>) {
  const openrouter = env.OPENROUTER_API_KEY;
  if (openrouter) {
    const models = { proposer: env.OPENROUTER_PROPOSER_MODEL || OPENROUTER_PROPOSER_MODEL, reviewer: env.OPENROUTER_REVIEWER_MODEL || OPENROUTER_REVIEWER_MODEL };
    return { name: 'OpenRouter', ...models, create: () => createOpenRouterLlm(openrouter, models) };
  }
  const gemini = env.GEMINI_API_KEY;
  if (gemini) return { name: 'Gemini', proposer: GEMINI_PROPOSER_MODEL, reviewer: GEMINI_REVIEWER_MODEL, create: () => createGeminiLlm(gemini) };
  const anthropic = env.ANTHROPIC_API_KEY;
  if (anthropic) return { name: 'Anthropic', proposer: PROPOSER_MODEL, reviewer: REVIEWER_MODEL, create: () => createAnthropicLlm(anthropic) };
  throw new Error('Set OPENROUTER_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in the environment; keys are never read from a file.');
}
