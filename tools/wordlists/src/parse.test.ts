import { describe, expect, it } from 'vitest';
import { parseWordList } from './parse';

describe('parseWordList', () => {
  it('keeps lowercase a-z words, uppercased, unique and sorted', () => {
    expect(parseWordList("Cat\ncat\ndog\nO'Brien\ncafé\nNASA\n")).toEqual(['CAT', 'DOG']);
  });

  it('ignores blank lines and CRLF endings', () => {
    expect(parseWordList('\nzed\r\n\r\napple\n\n')).toEqual(['APPLE', 'ZED']);
  });
});
