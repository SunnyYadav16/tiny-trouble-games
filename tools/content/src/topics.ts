import { randInt, rngFrom } from '@ttg/engine';

export const TOPICS: readonly string[] = [
  'food', 'animals', 'weather', 'music', 'sports', 'geography', 'tools', 'plants', 'space', 'the human body',
  'clothing', 'travel', 'cooking', 'birds', 'the sea', 'buildings', 'transport', 'art', 'science', 'history',
  'games', 'jobs', 'the home', 'school', 'fruit', 'insects', 'materials', 'festivals', 'farming', 'the garden',
];

/** The same slot always gets the same topic. */
export function topicFor(seedKey: string): string {
  return TOPICS[randInt(rngFrom(seedKey), TOPICS.length)]!;
}
