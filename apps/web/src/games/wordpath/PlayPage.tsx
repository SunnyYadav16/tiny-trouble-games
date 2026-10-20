import { wordpathV1 } from '@ttg/engine';
import { useEffect, useId, useState } from 'react';
import { formatDuration, localDateKey } from '../../shared/daily';
import { Board } from './Board';
import { Header, StreakPill } from './Header';
import { HowToPlay, seenHowTo } from './HowToPlay';
import { INFO, Icon, NEXT } from './icons';
import { loadUnlimitedIndex, type IndexResult } from './loadPuzzle';
import { loadActive, unlimitedKeys } from './session';
import { loadStats } from './stats';
import { StatsDialog } from './StatsDialog';
import { dailyStatus, dayLabel } from './today';
import { WIDE, useMedia } from './useMedia';
import './PlayPage.css';

type Level = wordpathV1.Level;

interface Props {
  now: () => Date;
  /** Home. */
  onBack: () => void;
  /** Today's daily: start, continue, or its result. */
  onDaily: () => void;
  onUnlimited: (level: Level) => void;
}

/** Each level's name, what makes it harder, and the path shape its plot draws: one bend, a few bends, a turn at every tile. */
const LEVEL_INFO: Record<Level, { name: string; desc: string; route: number[] }> = {
  easy: { name: 'Easy', desc: 'A gentle path with a bend or two, and plain clues.', route: [4, 5, 6, 7, 11] },
  normal: { name: 'Normal', desc: 'Twistier paths, a few false trails, and clues that hint. Same as the daily.', route: [4, 5, 6, 10, 11] },
  hard: { name: 'Hard', desc: 'The path turns at every tile, with many false trails and clues from an odd angle.', route: [0, 1, 5, 6, 10] },
};
const BLANK = ' '.repeat(16);
const noop = () => {};

/** Today's daily, stats, and which levels have a saved puzzle, from this browser's storage. */
function read(day: Date) {
  const today = localDateKey(day);
  const saved = new Set(wordpathV1.LEVELS.filter((l) => loadActive(unlimitedKeys(l).active)));
  return { day, stats: loadStats(today), daily: dailyStatus(today), saved };
}

/** The Word Path page (N21): today's daily, and the Unlimited levels. Back from any game returns here. */
export function PlayPage({ now, onBack, onDaily, onUnlimited }: Props) {
  const [{ day, stats, daily, saved }, setData] = useState(() => read(now()));
  // Read storage again once mounted: the game this page replaced saves its session as it unmounts, after this page's first render.
  // oxlint-disable-next-line react/set-state-in-effect -- storage is the external system here
  useEffect(() => setData(read(now())), [now]);
  const wide = useMedia(WIDE);
  const [index, setIndex] = useState<IndexResult | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showHowTo, setShowHowTo] = useState(() => !seenHowTo());
  const todayId = useId();
  const unlId = useId();

  useEffect(() => {
    let live = true;
    void loadUnlimitedIndex().then((r) => {
      if (live) setIndex(r);
    });
    return () => {
      live = false;
    };
  }, []);

  const streak = stats.daily.current;
  return (
    <>
      <Header title="Word Path" subtitle="" streak={null} onBack={onBack} onStats={() => setShowStats(true)} onHowTo={() => setShowHowTo(true)} />
      <main className="wp-page">
        <section className="hedge wp-today" aria-labelledby={todayId}>
          <h2 id={todayId}>Today's puzzle</h2>
          <div className="date">{dayLabel(day, wide)}</div>
          <div className="meta">
            <span>{daily.status}</span>
            <span className="grow" />
            {streak > 0 && <StreakPill streak={streak} />}
          </div>
          <p>One puzzle a day, at Normal level. Solving it keeps your streak going.</p>
          <button type="button" className="btn light big" onClick={onDaily}>
            {daily.action}
          </button>
        </section>

        <section className="wp-unl" aria-labelledby={unlId}>
          <h2 id={unlId}>Unlimited</h2>
          <p>Pick a level and play as many as you like. Each level keeps its own puzzle in progress, and its own stats.</p>
          {index && !index.ok && (
            <output className="unl-note">
              <Icon d={INFO} />
              <span>Unlimited puzzles aren't ready yet</span>
            </output>
          )}
          <div className="register">
            {wordpathV1.LEVELS.map((level) => {
              const { name, desc, route } = LEVEL_INFO[level];
              const { solved, avgSolveMs } = stats.byLevel[level];
              const avg = formatDuration(avgSolveMs);
              // Unknown until the index loads; then a level with no puzzles waits as "Coming soon".
              const off = index !== null && (!index.ok || index.count[level] === 0);
              const go = saved.has(level) ? 'Continue' : 'Play';
              const record = solved ? `${solved} solved, average ${avg}.` : 'None solved yet.';
              return (
                <div className="lvl" key={level} data-off={off || undefined}>
                  <div className="mini" aria-hidden="true" inert>
                    <Board size={4} tile={wide ? 22 : 15} cells={BLANK} route={route} routeState="active" disabled onTap={noop} />
                  </div>
                  {/* Its ::after covers the whole row, plot included. */}
                  <button
                    type="button"
                    className="lvl-btn"
                    disabled={index === null || off}
                    aria-label={off ? `${name}. ${desc} ${record} Coming soon.` : `${go} ${name}. ${desc} ${record}`}
                    onClick={() => onUnlimited(level)}
                  >
                    <span className="txt">
                      <span className="name">
                        {name}
                        {saved.has(level) && <span className="tag">In progress</span>}
                      </span>
                      <span className="desc">{desc}</span>
                      <span className="stat">
                        {off && 'Coming soon · '}
                        {solved ? `${solved} solved · ${avg} average` : 'None solved yet'}
                      </span>
                    </span>
                    <span className="nums">
                      <span>Solved</span>
                      <b>{solved}</b>
                      <span>Average</span>
                      <b>{solved ? avg : '–'}</b>
                    </span>
                    {off ? (
                      <span className="go soon">Coming soon</span>
                    ) : (
                      <span className="go" data-cont={saved.has(level) || undefined}>
                        <span>{go}</span>
                        <Icon d={NEXT} />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {showStats && <StatsDialog {...stats} onClose={() => setShowStats(false)} />}
      {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}
    </>
  );
}
