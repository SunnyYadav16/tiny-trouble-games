import { wordpathV1 } from '@ttg/engine';

const BLOCKED = ['AMONG', 'GAMMA', 'MAMMA', 'MANGA', 'MANNA'];

/** Tests only: a real puzzle built by the engine. Defaults to MANGO, the engine tests' answer. */
export function makeTestPuzzle(
  opts: { id?: string; seedKey?: string; date?: string; answer?: string; level?: wordpathV1.Level } = {},
): wordpathV1.PuzzleBody {
  const { id = 'wp-test', seedKey = id, date, answer = 'MANGO', level = 'normal' } = opts;
  return wordpathV1.makePuzzle({
    id,
    seedKey,
    ...(date === undefined ? {} : { date }),
    level,
    answer,
    clue: 'A tropical fruit with a large stone',
    blocked: BLOCKED,
    wordListVersion: 'test-1',
  });
}
