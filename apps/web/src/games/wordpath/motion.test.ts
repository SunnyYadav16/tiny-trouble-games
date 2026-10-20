import { wordpathV1 } from '@ttg/engine';
import gsap from 'gsap';
import { afterEach, describe, expect, it } from 'vitest';
import {
  EASE,
  celebrate,
  countUp,
  drawSegment,
  petalBurst,
  screenEnter,
  selectPop,
  solveCascade,
  traceRoute,
  wrongShake,
  type Burst,
} from './motion';

type Anim = gsap.core.Tween | gsap.core.Timeline;

// Keys GSAP reads as settings, not as values to animate.
const SETTINGS = new Set([
  'duration', 'ease', 'delay', 'stagger', 'repeat', 'yoyo', 'overwrite', 'immediateRender', 'runBackwards',
  'startAt', 'parent', 'onComplete', 'onUpdate', 'clearProps', 'svgOrigin', 'lazy', 'data', 'id',
]);
const MOVES = new Set(['x', 'y', 'scale', 'rotation', 'rotationX', 'rotationY', 'opacity']);

const tweensOf = (a: Anim): gsap.core.Tween[] =>
  a instanceof gsap.core.Timeline ? (a.getChildren(true, true, false) as gsap.core.Tween[]) : [a as gsap.core.Tween];

function animated(a: Anim): Set<string> {
  const keys = new Set<string>();
  for (const t of tweensOf(a)) {
    const vars = t.vars as Record<string, unknown>;
    for (const v of [vars, (vars.startAt ?? {}) as Record<string, unknown>]) {
      Object.keys(v).filter((k) => !SETTINGS.has(k)).forEach((k) => keys.add(k));
    }
  }
  return keys;
}

const els = (n: number) => Array.from({ length: n }, () => document.body.appendChild(document.createElement('button')));

function segment() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  Object.entries({ x1: '23', y1: '23', x2: '69', y2: '23' }).forEach(([k, v]) => line.setAttribute(k, v));
  svg.appendChild(line);
  document.body.appendChild(svg);
  return line;
}

function burst(routeLength: number, width = 726, height = 726): Burst {
  const frame = document.body.appendChild(document.createElement('div'));
  const origins = Array.from({ length: routeLength }, (_, i): [number, number] => [41 + i * 46, 41]);
  return { frame, width, height, tile: 46, origins };
}

function everyEffect(reduced: boolean): [string, Anim][] {
  const label = document.body.appendChild(document.createElement('span'));
  return [
    ['selectPop', selectPop(els(1)[0]!, reduced)],
    ['drawSegment', drawSegment(segment(), reduced)],
    ['wrongShake', wrongShake(els(5), reduced)],
    ['solveCascade', solveCascade(els(5), reduced)],
    ['petalBurst', petalBurst(burst(5), reduced)],
    ['traceRoute', traceRoute(els(5), reduced)],
    ['screenEnter', screenEnter(document.body.appendChild(document.createElement('main')), reduced)],
    ['countUp', countUp({ el: label, to: 41 }, reduced)],
  ];
}

afterEach(() => {
  gsap.globalTimeline.clear();
  document.body.innerHTML = '';
});

describe('motion', () => {
  it('names the two easing curves', () => {
    expect(EASE).toEqual({ out: 'power4.out', inOut: 'power4.inOut' });
  });

  it('animates only transforms and opacity', () => {
    const extra = everyEffect(false).flatMap(([name, anim]) => [...animated(anim)].filter((k) => !MOVES.has(k)).map((k) => `${name}: ${k}`));
    expect(extra).toEqual([]);
  });

  it('with reduced motion tweens only opacity, for at most 0.15 s', () => {
    const effects = everyEffect(true);
    const extra = effects.flatMap(([name, anim]) => [...animated(anim)].filter((k) => k !== 'opacity').map((k) => `${name}: ${k}`));
    expect(extra).toEqual([]);
    expect(effects.filter(([, anim]) => anim.duration() > 0.15).map(([name]) => name)).toEqual([]);
  });

  it('wrongShake shakes ±6 px and ends inside the wrong window', () => {
    const shake = wrongShake(els(5), false);
    const xs = tweensOf(shake).map((t) => (t.vars as { x?: number }).x).filter((x) => x !== undefined);
    expect(Math.max(...xs.map(Math.abs))).toBe(6);
    expect(shake.duration() * 1000).toBeLessThan(wordpathV1.WRONG_MS);
  });

  it('drawSegment grows from a visible stub, never from scale 0', () => {
    const from = (drawSegment(segment(), false) as gsap.core.Tween).vars.startAt as { scale: number };
    expect(from.scale).toBeGreaterThan(0);
    expect(from.scale).toBeLessThan(1);
  });

  it('countUp shows the final number at once under reduced motion', () => {
    const el = document.body.appendChild(document.createElement('span'));
    countUp({ el, to: 41, format: (n) => `0:${n}` }, true);
    expect(el.textContent).toBe('0:41');
  });

  it('the whole solve celebration ends within 5 s', () => {
    for (let run = 0; run < 5; run++) {
      expect(celebrate(els(8), burst(8), false).duration()).toBeLessThanOrEqual(5);
    }
  });

  describe('petalBurst', () => {
    it('adds at most 48 bloom and 104 shower pieces on an aria-hidden layer', () => {
      const b = burst(8, 2000, 2000);
      petalBurst(b, false);
      const layer = b.frame.querySelector('.petals')!;
      expect(layer).toHaveAttribute('aria-hidden', 'true');
      expect(layer.querySelectorAll('.petal')).toHaveLength(152);
    });

    it('caps the bloom at 48 pieces however long the route', () => {
      const b = burst(15, 0, 0);
      petalBurst(b, false);
      expect(b.frame.querySelectorAll('.petal').length).toBeLessThanOrEqual(48 + 36);
    });

    it('spreads the shower across the full board width', () => {
      const b = burst(5, 726, 726);
      petalBurst(b, false);
      const shower = [...b.frame.querySelectorAll('.petal')].slice(5 * 6);
      const xs = shower.map((el) => Number(gsap.getProperty(el, 'x')));
      const quarters = [0, 1, 2, 3].filter((q) => xs.some((x) => x >= (q * 726) / 4 && x < ((q + 1) * 726) / 4));
      expect(quarters).toEqual([0, 1, 2, 3]);
    });

    it('removes every piece and its layer when done', () => {
      const b = burst(5);
      petalBurst(b, false).progress(1);
      expect(b.frame.querySelector('.petals')).toBeNull();
      expect(b.frame.querySelector('.petal')).toBeNull();
    });

    it('adds nothing under reduced motion', () => {
      const b = burst(5);
      petalBurst(b, true);
      expect(b.frame.children).toHaveLength(0);
    });
  });
});
