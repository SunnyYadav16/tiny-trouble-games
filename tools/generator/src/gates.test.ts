import { describe, expect, it } from 'vitest';
import { candidateProblems, type Candidate } from './gates';

const lists = {
  answers: new Set(['MANGO', 'STRAP']),
  blocking: new Set(['MANGO', 'STRAP', 'PARTS']),
};
const ctx = { lists, used: new Set<string>() };
const good: Candidate = { answer: 'MANGO', clue: 'A tropical fruit with a large stone' };
const problems = (c: Partial<Candidate>, used: string[] = []) =>
  candidateProblems({ ...good, ...c }, { lists, used: new Set(used) }).join('\n');

describe('candidateProblems', () => {
  it('passes an eligible candidate', () => expect(candidateProblems(good, ctx)).toEqual([]));

  it('flags an answer whose reverse is a word', () => {
    expect(problems({ answer: 'STRAP' })).toMatch(/PARTS/);
  });

  it('flags an answer outside the answer list', () => {
    expect(problems({ answer: 'PLANT' })).toMatch(/answer list/);
  });

  it('flags a used answer, comparing uppercase', () => {
    expect(problems({ answer: 'mango' }, ['MANGO'])).toMatch(/MANGO already used/);
  });

  it('flags an empty clue', () => {
    expect(problems({ clue: '  ' })).toBe('clue is empty');
  });

  it('flags a clue containing the answer, any case', () => {
    expect(problems({ clue: 'A tropical MANGO fruit' })).toBe('clue contains the answer');
  });

  it('flags a clue containing the first five letters inside another word', () => {
    expect(problems({ answer: 'MANGOES', clue: 'Several mangoes in a bowl' }).split('\n')).toContain('clue contains the answer');
  });
});
