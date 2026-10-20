import { randInt, rngFrom, shuffle, wordpathV1 } from '@ttg/engine';

export const TOPICS: readonly string[] = [
  'food', 'animals', 'weather', 'music', 'sports', 'geography', 'tools', 'plants', 'space', 'the human body',
  'clothing', 'travel', 'cooking', 'birds', 'the sea', 'buildings', 'transport', 'art', 'science', 'history',
  'games', 'jobs', 'the home', 'school', 'fruit', 'insects', 'materials', 'festivals', 'farming', 'the garden',
];

/** One fixed order, so every topic is used once before any repeats. */
const ORDER = shuffle(rngFrom('topics-v1'), TOPICS);
const DAY_MS = 86_400_000;
const at = (i: number) => ORDER[i % ORDER.length]!;

/**
 * The same slot always gets the same topic. Dailies (`<date>` or `wp-<date>`) step through the order one
 * day at a time; unlimited ids (`wp-u-<level>-<n>`) step one puzzle at a time, each level starting a third
 * of the way round from the last. Any other key gets a seeded random topic.
 */
export function topicFor(seedKey: string): string {
  const day = /^(?:wp-)?(\d{4}-\d{2}-\d{2})$/.exec(seedKey);
  if (day) return at(Math.floor(Date.parse(day[1]!) / DAY_MS));
  const unlimited = /^wp-u-(easy|normal|hard)-(\d+)$/.exec(seedKey);
  if (unlimited) return at(Number(unlimited[2]) - 1 + wordpathV1.LEVELS.indexOf(unlimited[1] as wordpathV1.Level) * Math.floor(ORDER.length / 3));
  return TOPICS[randInt(rngFrom(seedKey), TOPICS.length)]!;
}
