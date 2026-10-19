/** One word per line; keeps only lowercase a-z words (drops proper nouns, abbreviations, accents, apostrophes). */
export function parseWordList(text: string): string[] {
  const words = new Set<string>();
  for (const line of text.split('\n')) {
    const word = line.trim();
    if (/^[a-z]+$/.test(word)) words.add(word.toUpperCase());
  }
  return [...words].sort();
}
