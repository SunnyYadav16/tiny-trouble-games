import { useGSAP } from '@gsap/react';
import { useRef, useState } from 'react';
import { localDateKey } from '../../shared/daily';
import { Board } from './Board';
import { EXAMPLE, EXAMPLE_FRAMES, EXAMPLE_LAST } from './example';
import { StreakPill } from './Header';
import { HowToPlay } from './HowToPlay';
import { HELP, Icon, Mark, NEXT } from './icons';
import { layRoute, prefersReduced } from './motion';
import { loadStats } from './stats';
import { dailyStatus, dayLabel } from './today';
import { WIDE, useMedia } from './useMedia';
import './Home.css';

interface Props {
  now: () => Date;
  /** Opens the Word Path page (N21). */
  onOpen: () => void;
}

const noop = () => {};

/** The collection page (N7): one designed card per game. The whole Word Path card is one link to its page. */
export function Home({ now, onOpen }: Props) {
  const [{ date, status, streak }] = useState(() => {
    const today = localDateKey(now());
    return { ...dailyStatus(today), streak: loadStats(today).daily.current };
  });
  const wide = useMedia(WIDE);
  const [howTo, setHowTo] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  // The example lays its route tap by tap once on show, and again on hover or focus once the last trace is done.
  // Reduced motion: the static route.
  const [reduced] = useState(prefersReduced);
  const [frame, setFrame] = useState(reduced ? EXAMPLE_LAST : 0);
  const [run, setRun] = useState(0);
  const tracing = useRef<gsap.core.Timeline | null>(null);
  useGSAP(
    () => {
      if (reduced) return;
      tracing.current = layRoute(setFrame, EXAMPLE_LAST);
      return () => void (tracing.current = null);
    },
    { scope: card, dependencies: [run], revertOnUpdate: true },
  );
  const retrace = () => {
    if (tracing.current?.progress() === 1) setRun((n) => n + 1);
  };

  const streakText = streak > 0 ? ` ${streak}-day streak.` : '';
  return (
    <>
      <header className="bar">
        <Mark />
        <div className="title">
          <h1 tabIndex={-1}>Tiny Trouble Games</h1>
        </div>
        <span className="spacer" />
        <button type="button" className="iconbtn" aria-label="How to play" onClick={() => setHowTo(true)}>
          <Icon d={HELP} />
        </button>
      </header>

      <main className="homepage">
        <div className="gamecard" ref={card}>
          <div className="hedge gc-art" aria-hidden="true" inert>
            <Board size={EXAMPLE.size} tile={wide ? 70 : 52} cells={EXAMPLE.cells} route={EXAMPLE_FRAMES[frame]!.route} routeState="active" disabled onTap={noop} />
            <span className="cap">{EXAMPLE.word}, in one path</span>
          </div>
          {/* Its ::after covers the whole card, so the art panel is part of the click target without sitting inside the link. */}
          <a
            className="gc-body"
            href="#wordpath"
            aria-label={`Word Path. ${dayLabel(date, true)}: ${status}.${streakText} Open to play.`}
            onClick={(e) => {
              e.preventDefault();
              onOpen();
            }}
            onMouseEnter={retrace}
            onFocus={retrace}
          >
            <h2>Word Path</h2>
            <p className="desc">Read the clue, then trace the one path of touching tiles that spells the answer.</p>
            <div className="gc-status">
              <span>{dayLabel(date, wide)}</span>
              <span aria-hidden="true">·</span>
              <b>{status}</b>
              <span className="grow" />
              {streak > 0 && <StreakPill streak={streak} />}
            </div>
            <span className="gc-go">
              Play Word Path
              <Icon d={NEXT} />
            </span>
          </a>
        </div>
        <p className="later">More puzzles from this collection are on the way.</p>
      </main>

      {howTo && <HowToPlay onClose={() => setHowTo(false)} />}
    </>
  );
}
