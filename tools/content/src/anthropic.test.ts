import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { AuthenticationError, PermissionDeniedError, RateLimitError } from '@anthropic-ai/sdk';
import { createAnthropicLlm, PROPOSER_MODEL, REVIEWER_MODEL } from './anthropic';
import { LlmAuthError } from './llm';

// A stub client: no test reaches the network or a real model.
const { create } = vi.hoisted(() => ({ create: vi.fn<(params: Anthropic.MessageCreateParamsNonStreaming) => Promise<unknown>>() }));
vi.mock('@anthropic-ai/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@anthropic-ai/sdk')>()),
  default: class {
    messages = { create };
  },
}));

const candidate = { answer: 'MANGO', clue: 'Fruit of the Alphonso tree', clueSource: 'https://example.com/mango' };
const message = (text: string) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

describe('anthropic', () => {
  it('uses two different models and throws when they match', () => {
    expect(PROPOSER_MODEL).not.toBe(REVIEWER_MODEL);
    expect(() => createAnthropicLlm('test-key', { proposer: 'same-model', reviewer: 'same-model' })).toThrow(/different/);
  });

  it('parses a structured review whole, braces in the reason included', async () => {
    const review = { supported: true, offensive: false, plainDefinition: false, reason: 'The page lists {Alphonso} as a mango.' };
    create.mockResolvedValueOnce(message(JSON.stringify(review)));
    expect(await createAnthropicLlm('test-key').review({ candidate, sourceText: 'Alphonso is a mango.' })).toEqual(review);
    expect(create.mock.calls.at(-1)![0]).toMatchObject({ model: REVIEWER_MODEL, output_config: { format: { type: 'json_schema' } } });
  });

  it('turns a rejected key into LlmAuthError and leaves other API errors alone', async () => {
    const llm = createAnthropicLlm('test-key');
    for (const e of [new AuthenticationError(401, undefined, 'invalid x-api-key', new Headers()), new PermissionDeniedError(403, undefined, 'forbidden', new Headers())]) {
      create.mockRejectedValueOnce(e);
      await expect(llm.solve({ clue: 'c', length: 5, letters: 'AGMNO' })).rejects.toBeInstanceOf(LlmAuthError);
    }
    create.mockRejectedValueOnce(new RateLimitError(429, undefined, 'slow down', new Headers()));
    const limited = llm.solve({ clue: 'c', length: 5, letters: 'AGMNO' });
    await expect(limited).rejects.toThrow(/slow down/);
    await expect(limited).rejects.not.toBeInstanceOf(LlmAuthError);
  });
});
