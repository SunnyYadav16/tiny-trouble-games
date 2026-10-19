import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeRoute, encodeRoute } from './check';

describe('encodeRoute', () => {
  it('round-trips', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1, maxLength: 7 }), (route) => {
        expect(decodeRoute(encodeRoute(route))).toEqual(route);
      }),
    );
  });
});
