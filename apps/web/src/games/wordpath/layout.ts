export interface LayoutInput {
  /** The board slot: the space CSS gives the plot inside its hedge frame. */
  width: number;
  height: number;
  /** Mouse-like device: `(pointer: fine) and (hover: hover)`. */
  finePointer: boolean;
}

export const MIN_TILE = { touch: 44, mouse: 36 } as const;
export const MAX_TILE = 48;
const MIN_SIZE = 6;
const MAX_PHONE_SIZE = 10;
const DESKTOP_SIZE = 15;

const dim = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** The board size to start an attempt with. Locked once the attempt starts (W1). */
export function chooseSize({ width, height, finePointer }: LayoutInput): number {
  const w = dim(width);
  if (!finePointer) {
    return Math.max(MIN_SIZE, Math.min(MAX_PHONE_SIZE, Math.floor(w / MIN_TILE.touch)));
  }
  const room = Math.min(w, dim(height));
  if (DESKTOP_SIZE * MIN_TILE.mouse <= room) return DESKTOP_SIZE;
  return Math.max(MIN_SIZE, Math.min(MAX_PHONE_SIZE, Math.floor(room / MIN_TILE.mouse)));
}

/** Tile edge in px for a board of `size`; follows the window while the size stays locked. */
export function tileFor(size: number, { width, height, finePointer }: LayoutInput): number {
  const room = finePointer ? Math.min(dim(width), dim(height)) : dim(width);
  return Math.min(MAX_TILE, room / size);
}
