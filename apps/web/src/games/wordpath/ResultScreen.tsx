import { useGSAP } from '@gsap/react';
import { useEffect, useReducer, useRef } from 'react';
import { formatCountdown, formatDuration, localDateKey, msUntilNextMidnight } from '../../shared/daily';
import { INFINITY, Icon, LevelIcon, NEXT, STATS } from './icons';
import { countUp, prefersReduced } from './motion';
import type { ResultRecord } from './results';
import { Stones } from './Stones';
import './ResultScreen.css';

interface Props {
  mode: 'daily' | 'unlimited';
  result: ResultRecord;
  clue: string;
  answer: string;
  /** Daily: Play unlimited. Unlimited: Change level. Either way, back to the Word Path page. */
  onUnlimited: () => void;
  /** Unlimited: the next puzzle at the same level. */
  onNext?: () => void;
  /** Daily: open the stats dialog. */
  onStats?: () => void;
  /** Daily: once the next daily is out, open it. */
  onToday?: () => void;
  now?: () => Date;
  /** Move focus to the heading: the player just finished, as opposed to reopening a result. */
  focus?: boolean;
}

const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard' } as const;

/** The result in the play layout's side panel (R-C4): the board stays on the stage in its final state. */
export function ResultScreen({ mode, result, clue, answer, onUnlimited, onNext, onStats, onToday, now = () => new Date(), focus }: Props) {
  const solved = result.outcome === 'solved';
  const scope = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const time = useRef<HTMLElement>(null);
  const tries = useRef<HTMLElement>(null);
  const level = LEVEL_NAME[result.level];

  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);

  // Numbers count up only for a fresh finish; a reopened result shows its final numbers at once.
  useGSAP(
    () => {
      const reduced = !focus || prefersReduced();
      countUp({ el: time.current!, to: result.timeMs, format: formatDuration }, reduced);
      countUp({ el: tries.current!, to: result.wrongAttempts }, reduced);
    },
    { scope },
  );

  return (
    <div ref={scope} className="result">
      <h2 ref={heading} className="res-h" data-good={solved || undefined} tabIndex={-1}>
        {solved ? 'Solved' : 'Gave up'}
      </h2>
      <Stones text={answer} length={answer.length} kind={solved ? 'solved' : 'revealed'} okLabel="" />
      <p className="res-clue">{clue}</p>
      <dl className="ledger">
        <div>
          <dt>Time</dt>
          <dd ref={time} />
        </div>
        <div>
          <dt>Wrong tries</dt>
          <dd ref={tries} />
        </div>
      </dl>

      {mode === 'daily' && !solved && <p className="note">Your streak is back to 0. Wrong tries never break it; giving up does.</p>}
      {mode === 'daily' && <Countdown date={result.date} now={now} onToday={onToday} />}

      <div className="btns">
        {mode === 'daily' ? (
          <>
            <button type="button" className="btn primary big" onClick={onUnlimited}>
              <Icon d={INFINITY} />
              Play unlimited
            </button>
            <button type="button" className="btn big" onClick={onStats}>
              <Icon d={STATS} />
              Stats
            </button>
          </>
        ) : (
          <>
            {onNext && (
              <button type="button" className="btn primary big" onClick={onNext}>
                Next {level} puzzle
                <Icon d={NEXT} />
              </button>
            )}
            <button type="button" className="btn big" onClick={onUnlimited}>
              <LevelIcon level={result.level} />
              Change level
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Time to the next daily, ticking each second; at midnight, or for an earlier day's result, the way in. */
function Countdown({ date, now, onToday }: { date: string; now: () => Date; onToday?: () => void }) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const t = now();
  if (date < localDateKey(t)) {
    return onToday && (
      <button type="button" className="btn big today" onClick={onToday}>
        Play today's puzzle
      </button>
    );
  }
  return (
    <p className="next">
      Next daily puzzle in <b>{formatCountdown(msUntilNextMidnight(t))}</b>
    </p>
  );
}
