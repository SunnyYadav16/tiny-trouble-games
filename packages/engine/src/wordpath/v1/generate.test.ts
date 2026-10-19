import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { randInt, rngFrom } from '../../shared/rng';
import { generate, routesNear, seedFor, SIZES } from './generate';
import { LEVELS, metrics, qualityProblems } from './quality';
import { findRoutes } from './routes';
import { spell } from './rules';

const BLOCKED = ['AMONG', 'GAMMA', 'MAMMA', 'MANGA', 'MANNA'];

// Hard calls that failed in the generator benchmark (same seeds) before near misses were
// planted (N23). Blocked lists are blockedWords(answer, content/wordlists/blocking.txt)
// at word list 2026-10-a.
const REAL_HARD = [
  {
    answer: 'HUGEST',
    size: 6,
    nearMisses: 4,
    blocked: ['EGESTS', 'GEESTS', 'GEGGEE', 'GESSES', 'GESTES', 'GHESSE', 'GUESTS', 'GUSHES', 'GUSHET', 'GUSSET', 'GUTSES', 'GUTTEE', 'GUTTUS', 'HEUGHS', 'HUSHES', 'HUSSES', 'SEESEE', 'SEETHE', 'SEGUES', 'SESSES', 'SESTET', 'SETTEE', 'SHEESH', 'SHEETS', 'SHEUGH', 'SHUTES', 'SUEGEE', 'SUSSES', 'SUTTEE', 'TEETEE', 'TEETHE', 'TEHEES', 'TESTEE', 'TESTES', 'THESES', 'THETES', 'THUSES', 'TSETSE', 'TUSHES', 'TUSSEH', 'TUSSES', 'TUTEES', 'TUTSES'],
  },
  {
    answer: 'BUSTLED',
    size: 9,
    nearMisses: 4,
    blocked: ['BEBLEED', 'BEBLESS', 'BEDELLS', 'BEDLESS', 'BEDUSTS', 'BEEBEES', 'BEETLED', 'BEETLES', 'BESTUDS', 'BLEBBED', 'BLESSED', 'BLESSES', 'BLETTED', 'BLUBBED', 'BLUETTE', 'BUBBLED', 'BUBBLES', 'BUDDLED', 'BUDDLES', 'BUDLESS', 'BULBELS', 'BULBLET', 'BULBULE', 'BULBULS', 'BULLETS', 'BULLULE', 'BULTELL', 'BUSTEES', 'BUSTLES', 'BUTTLED', 'BUTTLES', 'DEBTEES', 'DEBUSED', 'DEBUTED', 'DEEDEED', 'DEEDEST', 'DELEBLE', 'DELETED', 'DELETES', 'DELUDED', 'DELUDES', 'DESUETE', 'DETESTS', 'DUELLED', 'DUETTED', 'DULLEST', 'DUSTBLU', 'EBBLESS', 'EUSTELE', 'LESSEES', 'LESSEST', 'LUSUSES', 'LUTELET', 'SEEDBED', 'SEEDLET', 'SESTETS', 'SESTETT', 'SETTEES', 'SETTLED', 'SETTLES', 'SETULES', 'SLEDDED', 'SLEETED', 'SLUBBED', 'SLUTTED', 'STEDDED', 'STEDDES', 'STEDDLE', 'STEEDED', 'STEELED', 'STELLED', 'STETTED', 'STUBBED', 'STUBBLE', 'STUDDED', 'STUDDLE', 'SUBDEBS', 'SUBDUED', 'SUBDUES', 'SUBLETS', 'SUBSETS', 'SUBSULT', 'SUBTEST', 'SUTTEES', 'SUTTLED', 'SUTTLES', 'TELEDUS', 'TELESES', 'TESTBED', 'TESTEES', 'TESTULE', 'TSETSES', 'TUBELET', 'TUBULES', 'TUBULET', 'TUBULUS', 'TUSSLED', 'TUSSLES', 'TUTULUS', 'USELESS'],
  },
  {
    answer: 'LEVERED',
    size: 15,
    nearMisses: 12,
    blocked: ['DEEDEED', 'DEVELED', 'LEVELED', 'LEVELER', 'LEVERER', 'REDDLED', 'RELEVEL', 'RELEVER', 'REREEVE', 'REVELED', 'REVELER', 'REVERED', 'REVEREE', 'REVERER', 'VERRELL'],
  },
];

describe('generate', () => {
  it('builds a grid where only the solution spells the answer or a blocked word', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom(...SIZES),
        fc.constantFrom(...LEVELS),
        (seed, size, level) => {
          const g = generate({ answer: 'MANGO', size, level, blocked: BLOCKED, seed });
          expect(g.cells).toHaveLength(size * size);
          expect(spell(g.cells, g.solution)).toBe('MANGO');
          expect(findRoutes(size, g.cells, ['MANGO', ...BLOCKED]).map((r) => r.route)).toEqual([
            g.solution,
          ]);
          expect(qualityProblems(size, g.cells, 'MANGO', g.solution, level)).toEqual([]);
        },
      ),
      { numRuns: 1000 },
    );
  }, 120_000);

  it.each(REAL_HARD)(
    'plants near misses for $answer at hard $size×$size against its real blocked words',
    ({ answer, size, nearMisses, blocked }) => {
      const g = generate({ answer, size, level: 'hard', blocked, seed: seedFor(`bench-${answer}-hard`, size) });
      expect(findRoutes(size, g.cells, [answer, ...blocked]).map((r) => r.route)).toEqual([g.solution]);
      expect(qualityProblems(size, g.cells, answer, g.solution, 'hard')).toEqual([]);
      expect(metrics(size, g.cells, answer, g.solution).nearMisses).toBeGreaterThanOrEqual(nearMisses);
    },
  );

  it('returns the same grid for the same input', () => {
    const input = { answer: 'MANGO', size: 8, level: 'hard', blocked: BLOCKED, seed: '2026-10-18|8|gen-1' } as const;
    expect(generate(input)).toEqual(generate(input));
  });

  it('refuses a palindrome', () => {
    expect(() => generate({ answer: 'LEVEL', size: 6, level: 'normal', blocked: [], seed: 's' })).toThrow(
      /palindrome/,
    );
  });

  it('refuses an answer whose reverse is blocked', () => {
    expect(() =>
      generate({ answer: 'STRAP', size: 6, level: 'normal', blocked: ['PARTS'], seed: 's' }),
    ).toThrow(/PARTS/);
  });

  it('names the attempt limit when every attempt fails', () => {
    expect(() =>
      generate({ answer: 'MANGO', size: 6, level: 'hard', blocked: BLOCKED, seed: 's', maxAttempts: 1, maxChanges: 0 }),
    ).toThrow('MANGO at 6×6: no valid grid in 1 attempts');
  });
});

describe('routesNear', () => {
  // Short words over many letters, and long words over two letters so routes are dense.
  const WORD_SETS = [['MANGO', ...BLOCKED], ['ABABAAB', 'BAABABA']];

  it('ranks a cell’s letters exactly as a whole-grid count does', () => {
    fc.assert(
      fc.property(fc.string(), fc.constantFrom(...SIZES), fc.constantFrom(...WORD_SETS), (seed, size, words) => {
        const rng = rngFrom(seed);
        const letters = [...new Set(words.join(''))];
        const grid = Array.from({ length: size * size }, () => letters[randInt(rng, letters.length)]!);
        const cell = randInt(rng, grid.length);
        const outside = letters.map((letter) => {
          grid[cell] = letter;
          return findRoutes(size, grid.join(''), words).length - routesNear(size, grid, cell, words);
        });
        expect(new Set(outside).size).toBe(1);
      }),
      { numRuns: 300 },
    );
  });
});
