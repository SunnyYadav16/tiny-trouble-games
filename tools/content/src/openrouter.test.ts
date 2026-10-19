import { describe, expect, it, vi } from 'vitest';
import { LlmAuthError } from './llm';
import { createOpenRouterLlm, OPENROUTER_PROPOSER_MODEL, OPENROUTER_REVIEWER_MODEL } from './openrouter';
import { chooseProvider } from './provider';

// A stub fetch: no test reaches the network or a real model.
const KEY = 'sk-or-test-key';
const candidate = { answer: 'MANGO', clue: 'Fruit of the Alphonso tree', clueSource: 'https://example.com/mango' };
const review = { supported: true, offensive: false, plainDefinition: false, reason: 'The page lists {Alphonso} as a mango.' };
const completion = (content: string | null, finish_reason: string | null = 'stop', cost = 0.001) => ({
  choices: [{ finish_reason, message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost },
});
const respond = (body: unknown, status = 200, headers?: Record<string, string>) => new Response(JSON.stringify(body), { status, headers });
const stub = (...responses: Response[]) => {
  const f = vi.fn<typeof fetch>();
  for (const r of responses) f.mockResolvedValueOnce(r);
  return f;
};
const sent = (f: ReturnType<typeof stub>, i = 0) => {
  const [url, init] = f.mock.calls.at(i)!;
  return { url, init: init!, headers: new Headers(init!.headers), body: JSON.parse(init!.body as string) };
};
const solveRequest = { clue: candidate.clue, length: 5, letters: 'AGMNO' };

describe('openrouter', () => {
  it('uses two different models and throws, before any request, when they match', () => {
    expect(OPENROUTER_PROPOSER_MODEL).not.toBe(OPENROUTER_REVIEWER_MODEL);
    const f = stub();
    expect(() => createOpenRouterLlm(KEY, { proposer: 'same/model', reviewer: 'same/model' }, f)).toThrow(/different/);
    expect(f).not.toHaveBeenCalled();
  });

  it('proposes on the proposer model with the web plugin and reads the JSON from the text', async () => {
    const f = stub(respond(completion(`I found [example.com](https://example.com/mango).\n${JSON.stringify(candidate)}`)));
    expect(await createOpenRouterLlm(KEY, undefined, f).propose({ topic: 'fruit', level: 'normal', avoid: [], rejected: [] })).toEqual(candidate);
    const { url, init, headers, body } = sent(f);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(headers.get('http-referer')).toBe('https://github.com/SunnyYadav16/tiny-trouble-games');
    expect(headers.get('x-openrouter-title')).toBe('Tiny Trouble Games');
    expect(body).toMatchObject({ model: OPENROUTER_PROPOSER_MODEL, plugins: [{ id: 'web', engine: 'parallel', mode: 'turbo', max_results: 3 }] });
    expect(body.response_format).toBeUndefined();
    expect(body.messages[0]).toMatchObject({ role: 'system', content: expect.stringMatching(/untrusted data/) });
    expect(body.messages[1]).toMatchObject({ role: 'user', content: expect.stringMatching(/Topic: fruit/) });
  });

  it('reviews and solves on the reviewer model with a strict JSON schema and no plugins', async () => {
    const f = stub(respond(completion(JSON.stringify(review))), respond(completion('{"guesses": ["mango", "papaya"]}')));
    const llm = createOpenRouterLlm(KEY, undefined, f);
    expect(await llm.review({ candidate, sourceText: 'Alphonso is a mango.' })).toEqual(review);
    expect(await llm.solve(solveRequest)).toEqual(['MANGO', 'PAPAYA']);
    for (const i of [0, 1]) {
      const { body } = sent(f, i);
      expect(body.model).toBe(OPENROUTER_REVIEWER_MODEL);
      expect(body.plugins).toBeUndefined();
      expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true, schema: { type: 'object', additionalProperties: false } } });
    }
    const reviewed = sent(f, 0).body.messages;
    expect(reviewed[0].content).toMatch(/untrusted data/);
    expect(reviewed.at(-1).content).toMatch(/<page>\nAlphonso is a mango.\n<\/page>/);
    const solved = sent(f, 1).body;
    expect(solved.messages).toHaveLength(1);
    expect(JSON.stringify(solved)).not.toMatch(/MANGO|Alphonso is|<page>/);
  });

  it('throws a clear error on malformed JSON, an error in a 200 body, no choices, an unexpected finish, or no text', async () => {
    const cases: [unknown, RegExp][] = [
      [completion('{"guesses": "MANGO"}'), /not the expected JSON/],
      [{ error: { code: 502, message: 'provider melted' } }, /provider melted/],
      [{ choices: [] }, /no choices/],
      [completion('{"guesses": ["MAN', 'length'), /stopped: length/],
      [{ choices: [{ finish_reason: 'error', message: { content: 'partial' }, error: { code: 502, message: 'disconnected' } }] }, /stopped: error: disconnected/],
      [completion(null), /no text/],
    ];
    for (const [reply, error] of cases) {
      await expect(createOpenRouterLlm(KEY, undefined, stub(respond(reply))).solve(solveRequest)).rejects.toThrow(error);
    }
  });

  it('stops the run on a refused key or no credits, and never prints the key', async () => {
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    for (const [status, message] of [[401, 'No auth credentials found'], [403, 'Key is disabled']] as const) {
      const refused = createOpenRouterLlm(KEY, undefined, stub(respond({ error: { code: status, message } }, status))).solve(solveRequest);
      await expect(refused).rejects.toBeInstanceOf(LlmAuthError);
      await expect(refused).rejects.toThrow(message);
    }
    const broke = createOpenRouterLlm(KEY, undefined, stub(respond({ error: { code: 402, message: 'Insufficient credits' } }, 402))).solve(solveRequest);
    await expect(broke).rejects.toBeInstanceOf(LlmAuthError);
    await expect(broke).rejects.toThrow(/out of credits/);
    await expect(broke).rejects.not.toThrow(KEY);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });

  it('treats a moderation 403 as one failed try, not a refused key', async () => {
    const flagged = { error: { code: 403, message: 'Input was flagged', metadata: { reasons: ['violence'], flagged_input: '...', provider_name: 'X', model_slug: 'x/y' } } };
    const blocked = createOpenRouterLlm(KEY, undefined, stub(respond(flagged, 403))).review({ candidate, sourceText: 'x' });
    await expect(blocked).rejects.toThrow(/flagged/);
    await expect(blocked).rejects.not.toBeInstanceOf(LlmAuthError);
  });

  it('retries 429 and 5xx up to 3 tries, honoring Retry-After, then throws', async () => {
    const wait = { 'Retry-After': '0' };
    const limited = stub(respond({ error: { code: 429, message: 'Rate limit exceeded' } }, 429, wait), respond(completion('{"guesses": ["MANGO"]}')));
    expect(await createOpenRouterLlm(KEY, undefined, limited).solve(solveRequest)).toEqual(['MANGO']);
    expect(limited).toHaveBeenCalledTimes(2);

    const down = stub(...Array.from({ length: 3 }, () => respond({ error: { code: 503, message: 'No provider available' } }, 503, wait)));
    const failed = createOpenRouterLlm(KEY, undefined, down).solve(solveRequest);
    await expect(failed).rejects.toThrow(/503.*No provider available/);
    await expect(failed).rejects.not.toBeInstanceOf(LlmAuthError);
    expect(down).toHaveBeenCalledTimes(3);
  });

  it('sums the reported cost per stage, failed replies included', async () => {
    const f = stub(
      respond(completion(JSON.stringify(candidate), 'stop', 0.004)),
      respond(completion(JSON.stringify(review), 'stop', 0.002)),
      respond(completion('not json', 'stop', 0.0005)),
      respond(completion('{"guesses": ["MANGO"]}', 'stop', 0.0007)),
      respond({ choices: [{ finish_reason: 'stop', message: { content: '{"guesses": []}' } }] }),
    );
    const llm = createOpenRouterLlm(KEY, undefined, f);
    expect(llm.spent).toEqual({ propose: 0, review: 0, solve: 0 });
    await llm.propose({ topic: 'fruit', level: 'normal', avoid: [], rejected: [] });
    await llm.review({ candidate, sourceText: 'x' });
    await expect(llm.solve(solveRequest)).rejects.toThrow(/not the expected JSON/);
    await llm.solve(solveRequest);
    await llm.solve(solveRequest);
    expect(llm.spent!.propose).toBeCloseTo(0.004);
    expect(llm.spent!.review).toBeCloseTo(0.002);
    expect(llm.spent!.solve).toBeCloseTo(0.0012);
  });
});

describe('chooseProvider with OpenRouter', () => {
  it('prefers OPENROUTER_API_KEY over GEMINI_API_KEY and ANTHROPIC_API_KEY', () => {
    const all = { OPENROUTER_API_KEY: 'o', GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' };
    expect(chooseProvider(all)).toMatchObject({ name: 'OpenRouter', proposer: OPENROUTER_PROPOSER_MODEL, reviewer: OPENROUTER_REVIEWER_MODEL });
    expect(chooseProvider({ ...all, OPENROUTER_API_KEY: '' })).toMatchObject({ name: 'Gemini' });
  });

  it('takes model overrides from the environment it is given, and equal overrides still throw', () => {
    const env = { OPENROUTER_API_KEY: 'o', OPENROUTER_PROPOSER_MODEL: 'a/proposer', OPENROUTER_REVIEWER_MODEL: 'b/reviewer' };
    expect(chooseProvider(env)).toMatchObject({ proposer: 'a/proposer', reviewer: 'b/reviewer' });
    expect(chooseProvider({ ...env, OPENROUTER_REVIEWER_MODEL: '' })).toMatchObject({ proposer: 'a/proposer', reviewer: OPENROUTER_REVIEWER_MODEL });
    expect(() => chooseProvider({ ...env, OPENROUTER_REVIEWER_MODEL: 'a/proposer' }).create()).toThrow(/different/);
  });

  it('names all three variables when none is set', () => {
    expect(() => chooseProvider({})).toThrow(/OPENROUTER_API_KEY.*GEMINI_API_KEY.*ANTHROPIC_API_KEY/);
  });
});
