import gsap from 'gsap';

/** GSAP twins of the CSS `--ease-out` and `--ease-in-out` tokens. */
export const EASE = { out: 'power4.out', inOut: 'power4.inOut' } as const;

type Anim = gsap.core.Tween | gsap.core.Timeline;

/** Reduced motion swaps movement for a fade this long (seconds). */
const FADE = 0.15;
/** Where the petals start inside the solve celebration (seconds). */
const BURST_AT = 0.12;

/** Nothing moves: the final frame shows at once. */
const instant = () => gsap.timeline();
const fadeUp = (targets: gsap.TweenTarget, from: number) =>
  gsap.fromTo(targets, { opacity: from }, { opacity: 1, duration: FADE, ease: 'none', overwrite: 'auto' });

/** A tapped tile springs back from the press: scale 0.86 to 1 in 160 ms. */
export function selectPop(tile: Element, reduced: boolean): Anim {
  if (reduced) return instant();
  return gsap.fromTo(tile, { scale: 0.86 }, { scale: 1, duration: 0.16, ease: EASE.out, overwrite: 'auto' });
}

/** The newest route segment grows out of the tile it leaves, in 120 ms. */
export function drawSegment(line: SVGLineElement, reduced: boolean): Anim {
  if (reduced) return instant();
  const svgOrigin = `${line.getAttribute('x1')} ${line.getAttribute('y1')}`;
  return gsap.fromTo(line, { scale: 0, svgOrigin }, { scale: 1, svgOrigin, duration: 0.12, ease: EASE.out, overwrite: 'auto' });
}

/** A wrong route shakes ±6 px for 280 ms, then fades back; done well inside `WRONG_MS`. */
export function wrongShake(tiles: Element[], reduced: boolean): Anim {
  if (reduced) return fadeUp(tiles, 0.5);
  const sway = { ease: 'power1.inOut', overwrite: 'auto' as const };
  return gsap
    .timeline()
    .to(tiles, { x: -6, duration: 0.04, ...sway })
    .to(tiles, { x: 6, duration: 0.05, repeat: 3, yoyo: true, ...sway })
    .to(tiles, { x: 0, duration: 0.04, ...sway })
    .to(tiles, { opacity: 0.55, duration: 0.3, ease: 'none' }, 0.5);
}

/** The solved route pops tile by tile (scale 1.16, 45 ms apart). */
export function solveCascade(tiles: Element[], reduced: boolean): Anim {
  if (reduced) return fadeUp(tiles, 0.4);
  return gsap.timeline().to(tiles, { scale: 1.16, duration: 0.13, yoyo: true, repeat: 1, stagger: 0.045, ease: 'power2.out' });
}

/** Home example: the route lays itself down once, tile by tile, in under 3 s. */
export function traceRoute(tiles: Element[], reduced: boolean): Anim {
  if (reduced) return instant();
  const each = Math.min(0.26, 2.8 / Math.max(1, tiles.length - 1));
  return gsap.timeline().fromTo(tiles, { opacity: 0.35, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.16, ease: EASE.out, stagger: each });
}

/** A new screen rises 8 px into place over 200 ms; reduced motion fades it in. */
export function screenEnter(screen: Element, reduced: boolean): Anim {
  const from = reduced ? { opacity: 0 } : { opacity: 0, y: 8 };
  const to = reduced ? { opacity: 1, duration: FADE, ease: 'none' } : { opacity: 1, y: 0, duration: 0.2, ease: EASE.out };
  return gsap.fromTo(screen, from, { ...to, clearProps: 'opacity,transform' });
}

/** A result number counts up from zero over 600 ms; reduced motion shows the final number. */
export function countUp(
  { el, to, format = String }: { el: Element; to: number; format?: (n: number) => string },
  reduced: boolean,
): Anim {
  const show = (n: number) => void (el.textContent = format(Math.round(n)));
  show(reduced ? to : 0);
  if (reduced) return instant();
  const tween: gsap.core.Tween = gsap.to({}, { duration: 0.6, ease: EASE.out, onUpdate: () => show(to * tween.ratio) });
  return tween;
}

const PETAL = {
  blossom: (c: string) =>
    `<svg viewBox="-8 -10 16 20" width="16" height="20"><path d="M0-6.6Q2.2-10 4.6-8.6Q8.4 1.6 0 9.6Q-8.4 1.6-4.6-8.6Q-2.2-10 0-6.6Z" fill="${c}"/><path d="M0-5.6Q3.6-1 0 8Q-1.6 1.4 0-5.6Z" fill="rgb(255 255 255 / .28)"/></svg>`,
  leaf: (c: string) =>
    `<svg viewBox="-7 -11 14 22" width="14" height="22"><path d="M0-10Q7.6-3 0 9.6Q-7.6-3 0-10Z" fill="${c}"/><path d="M0-8.6V10.6" stroke="rgb(0 0 0 / .28)" stroke-width=".9" stroke-linecap="round"/><path d="M0-2L2.8-5M0 2L-2.8-1.2M0 5.4L2.4 3" stroke="rgb(0 0 0 / .18)" stroke-width=".7" stroke-linecap="round"/></svg>`,
  seed: (c: string) =>
    `<svg viewBox="-5 -6 10 12" width="9" height="11"><ellipse rx="3.8" ry="5.2" fill="${c}"/><ellipse cx="-1.2" cy="-1.8" rx="1.2" ry="1.8" fill="rgb(255 255 255 / .3)"/></svg>`,
};
// Cream, blush, apricot and orange blossoms, hedge-green leaves, tan seeds (N17): no maroon or dark green.
const PETAL_MIX: [keyof typeof PETAL, string][] = [
  ['blossom', '#FFF3E3'], ['blossom', '#F8C9A4'], ['leaf', '#8DBF6A'], ['blossom', '#F28C28'], ['blossom', '#FFE2C6'],
  ['leaf', '#5E9E4C'], ['blossom', '#FFF3E3'], ['seed', '#E8B26A'], ['blossom', '#F8C9A4'], ['leaf', '#A9CF7C'],
];
const BLOOM_MAX = 48;

export interface Burst {
  /** The board frame (hedge band and plot). The petal layer covers it and is clipped to it. */
  frame: HTMLElement;
  width: number;
  height: number;
  tile: number;
  /** Route tile centres in frame pixels. */
  origins: [number, number][];
}

/**
 * Petals bloom from every route tile, then a shower drifts across the whole frame on a left-to-right breeze;
 * about a third land on the pavers, settle flat, and fade. Decorative: the layer is aria-hidden, takes no
 * input, and removes itself when done. Scatter uses `gsap.utils.random` (Math.random): UI decoration only.
 */
export function petalBurst({ frame, width: W, height: H, tile, origins }: Burst, reduced: boolean): Anim {
  const tl = gsap.timeline();
  if (reduced) return tl;
  const R = gsap.utils.random;
  const sc = tile / 46;
  const layer = document.createElement('div');
  layer.className = 'petals';
  layer.setAttribute('aria-hidden', 'true');
  frame.appendChild(layer);
  tl.eventCallback('onComplete', () => layer.remove());

  let n = 0;
  const petal = (x: number, y: number, size: number) => {
    const [kind, color] = PETAL_MIX[n++ % PETAL_MIX.length]!;
    const el = document.createElement('span');
    el.className = 'petal';
    el.innerHTML = `<i>${PETAL[kind](color)}</i>`;
    layer.appendChild(el);
    gsap.set(el, { x: x - 8, y: y - 10, opacity: 0, scale: size * sc });
    gsap.set(el.firstChild, { transformPerspective: 160, rotation: R(0, 360), rotationY: R(0, 180) });
    return el;
  };
  // Side-to-side sway plus a tumble, for as long as the piece is airborne.
  const flutter = (el: HTMLElement, at: number, dur: number) => {
    const p = R(0.45, 0.7);
    tl.to(el.firstChild, { x: R(7, 16) * sc, duration: p, yoyo: true, repeat: Math.max(0, Math.floor(dur / p) - 1), ease: 'sine.inOut' }, at);
    tl.to(el.firstChild, { rotationY: `+=${R(300, 720)}`, rotation: `+=${R(-160, 160)}`, duration: dur, ease: 'none' }, at);
  };

  // 1. Bloom: each route tile throws a small cluster up and out, following the green cascade.
  const per = Math.min(6, Math.floor(BLOOM_MAX / Math.max(1, origins.length)));
  origins.forEach(([cx, cy], i) => {
    const at = i * 0.06;
    for (let k = 0; k < per; k++) {
      const el = petal(cx, cy, R(1.15, 1.5));
      const a = (k / per) * Math.PI * 2 + R(-0.4, 0.4);
      const r = R(0.7, 1.5) * tile;
      const fall = R(1.6, 2.3);
      tl.to(el, { opacity: 1, duration: 0.12 }, at);
      tl.to(el, { x: `+=${Math.cos(a) * r}`, y: `+=${Math.sin(a) * r * 0.6 - tile * R(0.8, 1.4)}`, duration: 0.55, ease: 'power3.out' }, at);
      tl.to(el, { x: `+=${R(20, 70) * sc}`, y: `+=${R(1.2, 2.4) * tile}`, duration: fall, ease: 'sine.in' }, at + 0.55);
      tl.to(el, { opacity: 0, duration: 0.5 }, at + 0.05 + fall);
      flutter(el, at, 0.55 + fall);
    }
  });

  // 2. Shower: 36-104 pieces by width, spread in even bands so every part of the frame gets some.
  const count = Math.round(gsap.utils.clamp(36, 104, W / 7));
  for (let k = 0; k < count; k++) {
    const lands = k % 3 === 0;
    const at = R(0.25, lands ? 2.6 : 3);
    const dur = lands ? R(1.1, 1.5) : R(1.4, 1.8);
    const el = petal(-0.25 * W + ((k + R(0, 1)) / count) * 1.2 * W, R(-50, -24), R(1.2, 1.8));
    tl.to(el, { opacity: R(0.85, 1), duration: 0.2 }, at);
    tl.to(el, { x: `+=${R(0.08, 0.28) * W}`, y: lands ? R(0.15, 0.95) * H : H + 30, duration: dur, ease: lands ? 'power1.out' : 'none' }, at);
    flutter(el, at, dur);
    if (lands) {
      tl.to(el.firstChild, { rotationY: 0, rotationX: 58, duration: 0.3, ease: 'power2.out' }, at + dur);
      tl.to(el, { opacity: 0, duration: 0.45 }, at + dur + 0.3);
    } else {
      tl.to(el, { opacity: 0, duration: 0.3 }, at + dur - 0.3);
    }
  }
  return tl;
}

/** The whole solve moment (N17): cascade, then petals. Ends within 5 s. */
export function celebrate(tiles: Element[], burst: Burst, reduced: boolean): gsap.core.Timeline {
  return gsap
    .timeline()
    .add(solveCascade(tiles, reduced), 0)
    .add(petalBurst(burst, reduced), reduced ? 0 : BURST_AT);
}
