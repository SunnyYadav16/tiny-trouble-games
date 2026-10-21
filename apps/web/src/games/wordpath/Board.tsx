/* oxlint-disable jsx-a11y/prefer-tag-over-role -- an ARIA grid of buttons (APG grid pattern); a <table> cannot hold the route SVG */
import { useGSAP } from '@gsap/react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { celebrate, drawSegment, prefersReduced, selectPop, wrongShake } from './motion';
import { RouteLine } from './RouteLine';
import './Board.css';

export type RouteState = 'active' | 'wrong' | 'solved' | 'revealed';

interface Props {
  size: number;
  /** Tile edge in px. */
  tile: number;
  cells: string;
  route: readonly number[];
  routeState: RouteState;
  disabled: boolean;
  onTap: (cell: number) => void;
}

const sameStart = (a: readonly number[], b: readonly number[]) => a.every((c, i) => c === b[i]);

/**
 * The plot: a hedge band around soil holding raised clay pavers, one button per letter.
 * Every state shows without motion (data attributes, outlines, the route line); GSAP only decorates.
 */
export function Board({ size, tile, cells, route, routeState, disabled, onTap }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(0);
  const tileEls = () => [...boardRef.current!.querySelectorAll<HTMLButtonElement>('.tile')];

  // State moments. Reverting on every change means the next state (or the next tap) cuts the last one short.
  const shownState = useRef(routeState);
  useGSAP(
    () => {
      const from = shownState.current;
      shownState.current = routeState;
      if (from === routeState) return; // first render, or a board that opens already finished
      const reduced = prefersReduced();
      const els = tileEls();
      const routeEls = route.map((c) => els[c]!);
      if (routeState === 'wrong') wrongShake(routeEls, reduced);
      if (routeState !== 'solved') return;

      const frame = boardRef.current!;
      const plot = frame.firstElementChild as HTMLElement;
      const origins = route.map((c): [number, number] => [
        plot.offsetLeft + ((c % size) + 0.5) * tile,
        plot.offsetTop + (Math.floor(c / size) + 0.5) * tile,
      ]);
      const tl = celebrate(routeEls, { frame, width: frame.offsetWidth, height: frame.offsetHeight, tile, origins }, reduced);
      // Any click or key jumps to the final frame.
      const skip = () => void tl.progress(1);
      const stop = () => {
        window.removeEventListener('pointerdown', skip);
        window.removeEventListener('keydown', skip);
      };
      window.addEventListener('pointerdown', skip);
      window.addEventListener('keydown', skip);
      tl.eventCallback('onComplete', stop);
      return () => {
        stop();
        frame.querySelector('.petals')?.remove();
      };
    },
    { scope: boardRef, dependencies: [routeState], revertOnUpdate: true },
  );

  // Tap-time moments: the tile just added pops, and its segment draws in.
  const { contextSafe } = useGSAP({ scope: boardRef });
  const laid = useRef<readonly number[]>(routeState === 'active' ? route : []);
  useLayoutEffect(() => {
    const before = laid.current;
    laid.current = routeState === 'active' ? route : [];
    const last = route[route.length - 1];
    if (routeState !== 'active' || last === undefined || before.includes(last)) return;
    contextSafe(() => {
      const reduced = prefersReduced();
      selectPop(tileEls()[last]!, reduced);
      const seg = boardRef.current!.querySelector<SVGLineElement>('.route-seg');
      if (seg && route.length === before.length + 1 && sameStart(before, route)) drawSegment(seg, reduced);
    })();
  }, [route, routeState, contextSafe]);

  const move = (e: KeyboardEvent, i: number) => {
    const r = Math.floor(i / size);
    const c = i % size;
    const next = {
      ArrowLeft: c > 0 ? i - 1 : i,
      ArrowRight: c < size - 1 ? i + 1 : i,
      ArrowUp: r > 0 ? i - size : i,
      ArrowDown: r < size - 1 ? i + size : i,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    tileEls()[next]!.focus();
  };

  const tabStop = focus < size * size ? focus : 0;
  const rows = Array.from({ length: size }, (_, r) => r);

  return (
    <div ref={boardRef} className="hedge board" data-state={routeState}>
      <div className="plot" role="grid" aria-label="Letter grid" style={{ '--t': `${tile}px` } as CSSProperties}>
        <RouteLine size={size} tile={tile} route={route} state={routeState} />
        {rows.map((r) => (
          <div role="row" className="row" key={r}>
            {rows.map((c) => {
              const i = r * size + c;
              const selected = route.includes(i);
              return (
                <div role="gridcell" key={c}>
                  <button
                    type="button"
                    className="tile"
                    data-parity={(r + c) % 2}
                    data-selected={selected || undefined}
                    data-start={(routeState === 'revealed' && i === route[0]) || undefined}
                    aria-label={`${cells[i]}, row ${r + 1}, column ${c + 1}${selected ? ', selected' : ''}`}
                    aria-disabled={disabled || undefined}
                    tabIndex={!disabled && i === tabStop ? 0 : -1}
                    onClick={() => !disabled && onTap(i)}
                    onFocus={() => setFocus(i)}
                    onKeyDown={(e) => move(e, i)}
                  >
                    <span className="paver">{cells[i]}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
