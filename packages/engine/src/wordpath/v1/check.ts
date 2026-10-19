// Obfuscation, not security: the XOR key and base 36 only keep the route from
// reading as plain cell numbers in the public file. Remove when a server checker exists.
const KEY = 0x2a5;

export function encodeRoute(route: readonly number[]): string {
  return route.map((cell) => (cell ^ KEY).toString(36)).join('.');
}

/** Malformed input yields garbage numbers, never a throw; `parsePuzzle` re-encodes to catch it. */
export function decodeRoute(s: string): number[] {
  return s.split('.').map((part) => Number.parseInt(part, 36) ^ KEY);
}
