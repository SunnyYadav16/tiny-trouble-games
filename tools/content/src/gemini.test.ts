import { describe, expect, it, vi } from 'vitest';
import { ApiError, FinishReason, GenerateContentResponse, type GoogleGenAI } from '@google/genai';
import { createGeminiLlm, GEMINI_PROPOSER_MODEL, GEMINI_REVIEWER_MODEL } from './gemini';
import { LlmAuthError } from './llm';
import { chooseProvider } from './provider';

// A stub client: no test reaches the network or a real model.
const { generateContent, clients } = vi.hoisted(() => ({ generateContent: vi.fn<GoogleGenAI['models']['generateContent']>(), clients: [] as unknown[] }));
vi.mock('@google/genai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@google/genai')>()),
  GoogleGenAI: class {
    models = { generateContent };
    constructor(options: unknown) {
      clients.push(options);
    }
  },
}));

const reply = (text: string, finishReason = FinishReason.STOP) =>
  Object.assign(new GenerateContentResponse(), { candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason }] });
const candidate = { answer: 'MANGO', clue: 'Fruit of the Alphonso tree', clueSource: 'https://example.com/mango' };
const review = { supported: true, offensive: false, plainDefinition: false, reason: 'The page lists {Alphonso} as a mango.' };
const request = (i = 0) => generateContent.mock.calls.at(i)![0];

describe('gemini', () => {
  it('uses two different models and throws, before any client exists, when they match', () => {
    expect(GEMINI_PROPOSER_MODEL).not.toBe(GEMINI_REVIEWER_MODEL);
    const before = clients.length;
    expect(() => createGeminiLlm('test-key', { proposer: 'same-model', reviewer: 'same-model' })).toThrow(/different/);
    expect(clients).toHaveLength(before);
  });

  it('proposes with Search grounding on the proposer model and reads the JSON from the text', async () => {
    generateContent.mockResolvedValueOnce(reply(`I found a page.\n\`\`\`json\n${JSON.stringify(candidate)}\n\`\`\``));
    const llm = createGeminiLlm('test-key');
    expect(await llm.propose({ topic: 'fruit', level: 'normal', avoid: [], rejected: [] })).toEqual(candidate);
    expect(request()).toMatchObject({ model: GEMINI_PROPOSER_MODEL, config: { tools: [{ googleSearch: {} }] } });
    expect(request().contents).toMatch(/Topic: fruit/);
    expect(request().config!.systemInstruction).toMatch(/untrusted data/);
  });

  it('reviews and solves on the reviewer model with JSON output and no tools', async () => {
    generateContent.mockResolvedValueOnce(reply(JSON.stringify(review))).mockResolvedValueOnce(reply('{"guesses": ["mango", "papaya"]}'));
    const llm = createGeminiLlm('test-key');
    expect(await llm.review({ candidate, sourceText: 'Alphonso is a mango.' })).toEqual(review);
    expect(await llm.solve({ clue: candidate.clue, length: 5, letters: 'AGMNO' })).toEqual(['MANGO', 'PAPAYA']);
    for (const i of [-2, -1]) {
      expect(request(i)).toMatchObject({ model: GEMINI_REVIEWER_MODEL, config: { responseMimeType: 'application/json' } });
      expect(request(i).config!.responseJsonSchema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(request(i).config!.tools).toBeUndefined();
    }
    expect(request(-2).contents).toMatch(/<page>\nAlphonso is a mango.\n<\/page>/);
    expect(request(-1).contents).not.toMatch(/MANGO|Alphonso is/);
  });

  it('throws on malformed JSON, a blocked prompt, an unexpected finish, or no text', async () => {
    const llm = createGeminiLlm('test-key');
    const solve = () => llm.solve({ clue: 'c', length: 5, letters: 'AGMNO' });
    generateContent.mockResolvedValueOnce(reply('{"guesses": "MANGO"}'));
    await expect(solve()).rejects.toThrow(/not the expected JSON/);
    generateContent.mockResolvedValueOnce(Object.assign(new GenerateContentResponse(), { promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(solve()).rejects.toThrow(/blocked the prompt: SAFETY/);
    generateContent.mockResolvedValueOnce(reply('', FinishReason.SAFETY));
    await expect(solve()).rejects.toThrow(/stopped: SAFETY/);
    generateContent.mockResolvedValueOnce(Object.assign(new GenerateContentResponse(), { candidates: [{ content: { parts: [] }, finishReason: FinishReason.STOP }] }));
    await expect(solve()).rejects.toThrow(/no text/);
  });

  it('turns a rejected key into LlmAuthError and leaves other API errors alone', async () => {
    const llm = createGeminiLlm('test-key');
    const invalid = '{"error":{"code":400,"message":"API key not valid.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}';
    for (const [status, message] of [[401, 'unauthenticated'], [403, 'permission denied'], [400, invalid]] as const) {
      generateContent.mockRejectedValueOnce(new ApiError({ status, message }));
      await expect(llm.review({ candidate, sourceText: 'x' })).rejects.toBeInstanceOf(LlmAuthError);
    }
    generateContent.mockRejectedValueOnce(new ApiError({ status: 429, message: 'quota' }));
    const limited = llm.review({ candidate, sourceText: 'x' });
    await expect(limited).rejects.toThrow(/quota/);
    await expect(limited).rejects.not.toBeInstanceOf(LlmAuthError);
  });
});

describe('chooseProvider', () => {
  it('prefers GEMINI_API_KEY, falls back to ANTHROPIC_API_KEY, and creates no client while choosing', () => {
    const before = clients.length;
    expect(chooseProvider({ GEMINI_API_KEY: 'g' })).toMatchObject({ name: 'Gemini', proposer: GEMINI_PROPOSER_MODEL, reviewer: GEMINI_REVIEWER_MODEL });
    expect(chooseProvider({ ANTHROPIC_API_KEY: 'a' })).toMatchObject({ name: 'Anthropic' });
    expect(chooseProvider({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' })).toMatchObject({ name: 'Gemini' });
    expect(clients).toHaveLength(before);
  });

  it('throws a message naming every variable when none is set', () => {
    expect(() => chooseProvider({})).toThrow(/OPENROUTER_API_KEY.*GEMINI_API_KEY.*ANTHROPIC_API_KEY/);
    expect(() => chooseProvider({ GEMINI_API_KEY: '' })).toThrow(/OPENROUTER_API_KEY.*GEMINI_API_KEY.*ANTHROPIC_API_KEY/);
  });
});
