import { describe, expect, it } from 'vitest';
import { blockedWords, checkAnswer, reverse, type WordLists } from './words';

const lists: WordLists = {
  answers: new Set(['MANGO', 'GAMMA', 'CATS', 'STRAP', 'LEVEL', 'RACECAR']),
  blocking: new Set(['AMONG', 'MANGA', 'MANNA', 'GAMMA', 'MAMMA', 'MANGO', 'PARTS']),
};

describe('reverse', () => {
  it('reverses a string', () => {
    expect(reverse('STRAP')).toBe('PARTS');
    expect(reverse('')).toBe('');
  });
});

describe('blockedWords', () => {
  it('keeps same-length words built from the answer letters, minus the answer', () => {
    const blocking = ['AMONG', 'MANGA', 'MANNA', 'GAMMA', 'MAMMA', 'MANGO', 'MANGOS', 'MONEY', 'ANION'];
    expect(blockedWords('MANGO', blocking)).toEqual(['AMONG', 'GAMMA', 'MAMMA', 'MANGA', 'MANNA']);
  });

  it('does not need an anagram', () => {
    expect(blockedWords('PIANO', ['ANION', 'PIANO', 'OPINE'])).toEqual(['ANION']);
  });

  it('returns sorted unique words', () => {
    expect(blockedWords('MANGO', ['MANNA', 'AMONG', 'MANNA'])).toEqual(['AMONG', 'MANNA']);
  });
});

describe('checkAnswer', () => {
  it('accepts an eligible answer', () => {
    expect(checkAnswer('MANGO', lists)).toEqual([]);
  });

  it('rejects a palindrome', () => {
    expect(checkAnswer('LEVEL', lists)).toContainEqual(expect.stringMatching(/palindrome/));
    const only = checkAnswer('RACECAR', lists);
    expect(only).toHaveLength(1);
    expect(only[0]).toMatch(/palindrome/);
  });

  it('rejects fewer than 4 distinct letters', () => {
    const problems = checkAnswer('GAMMA', lists);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/distinct/);
  });

  it('rejects a bad length', () => {
    const problems = checkAnswer('CATS', lists);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/5-7/);
  });

  it('rejects a word whose reverse is a word', () => {
    const problems = checkAnswer('STRAP', lists);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/PARTS/);
  });

  it('rejects a word missing from the answer list', () => {
    const problems = checkAnswer('ZZXQV', lists);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/answer list/);
  });

  it('rejects non A-Z input', () => {
    expect(checkAnswer('mango', lists)).toContainEqual(expect.stringMatching(/5-7/));
  });
});
