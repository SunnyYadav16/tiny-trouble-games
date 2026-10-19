import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from '@google/genai';
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

/**
 * From ai.google.dev/gemini-api/docs/models (read 2026-10-19): the stable
 * flagship proposes, the stable Flash model reviews.
 */
export const GEMINI_PROPOSER_MODEL = 'gemini-4-argon';
export const GEMINI_REVIEWER_MODEL = 'gemini-3.8-flash';

const MAX_OUTPUT_TOKENS = 16_000;

/** 401 and 403 per the API errors page; an invalid key has also come back as 400 API_KEY_INVALID. */
const keyRejected = (e: unknown): never => {
  if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.message.includes('API_KEY_INVALID'))) {
    throw new LlmAuthError(`Gemini rejected the API key: ${e.message}`);
  }
  throw e;
};

/** The reply text. A blocked prompt, any finish but STOP (safety, recitation, max tokens), or no text throws. */
async function ask(client: GoogleGenAI, model: string, prompt: string, config: GenerateContentConfig): Promise<string> {
  const res = await client.models
    .generateContent({ model, contents: prompt, config: { maxOutputTokens: MAX_OUTPUT_TOKENS, thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM }, ...config } })
    .catch(keyRejected);
  const blocked = res.promptFeedback?.blockReason;
  if (blocked) throw new Error(`${model} blocked the prompt: ${blocked}`);
  const finish = res.candidates?.[0]?.finishReason;
  if (finish !== FinishReason.STOP) throw new Error(`${model} stopped: ${finish ?? 'no candidate'}`);
  const text = res.text;
  if (!text) throw new Error(`${model} returned no text`);
  return text;
}

const json = (schema: object): GenerateContentConfig => ({ responseMimeType: 'application/json', responseJsonSchema: schema });

export function createGeminiLlm(apiKey: string, models = { proposer: GEMINI_PROPOSER_MODEL, reviewer: GEMINI_REVIEWER_MODEL }): Llm {
  if (models.proposer === models.reviewer) throw new Error('the proposer and reviewer must be different models');
  // The SDK retries nothing by default; 3 attempts on 408, 429, and 5xx match the Anthropic SDK's default.
  const client = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 3 } } });
  return {
    propose: async (r) =>
      parseCandidate(await ask(client, models.proposer, proposePrompt(r), { systemInstruction: PROPOSE_SYSTEM, ...json(PROPOSE_SCHEMA) })),
    review: async (r) =>
      parseReview(await ask(client, models.reviewer, reviewPrompt(r), { systemInstruction: REVIEW_SYSTEM, ...json(REVIEW_SCHEMA) })),
    solve: async (r) => parseGuesses(await ask(client, models.reviewer, solvePrompt(r), json(GUESSES_SCHEMA))),
  };
}
