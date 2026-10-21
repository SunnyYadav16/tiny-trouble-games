import { wordpathV1 } from '@ttg/engine';
import { useEffect, useState, type ReactNode } from 'react';
import { formatDateLabel, localDateKey } from '../../shared/daily';
import { Header } from './Header';
import { EmptyPlot } from './EmptyPlot';
import { dailyUrl, loadPuzzle, type LoadResult } from './loadPuzzle';
import { PuzzlePlayer } from './PuzzlePlayer';
import { loadResults, type ResultRecord } from './results';
import { ResultScreen } from './ResultScreen';
import { DAILY, clearActive, type ActiveSession } from './session';
import { loadStats } from './stats';
import { pickDaily } from './today';
import { useHeaderDialogs } from './useHeaderDialogs';

interface Props {
  now: () => Date;
  /** Both return to the Word Path page (N21). */
  onBack: () => void;
  onUnlimited: () => void;
}

/** A finished daily reopens on its last board: the answer route, solved or revealed, never replayed. */
const reopen = (r: ResultRecord, id: string, solutions: Record<number, number[]>): ActiveSession => ({
  puzzleId: id,
  date: r.date,
  size: r.size,
  elapsedMs: r.timeMs,
  state: { route: solutions[r.size] ?? [], status: r.outcome === 'solved' ? 'won' : 'gave-up', wrongAttempts: r.wrongAttempts, wrong: null },
});

/** Decides which daily to play and loads it; PuzzlePlayer does the playing. */
export function WordPathDaily({ now, onBack, onUnlimited }: Props) {
  const [today, setToday] = useState(() => localDateKey(now()));
  const [plan, setPlan] = useState(() => pickDaily(today));
  const { date, active, done } = plan;
  const [finished, setFinished] = useState<ResultRecord | null>(null);
  const result = finished ?? done;
  const [load, setLoad] = useState<LoadResult | null>(null);
  const stats = loadStats(today); // after a finish this re-reads the saved results, so the streak is current
  const { openStats, openHowTo, dialogs } = useHeaderDialogs(stats);

  useEffect(() => {
    if (plan.drop) clearActive(DAILY.active);
  }, [plan.drop]);

  useEffect(() => {
    let live = true;
    void loadPuzzle(dailyUrl(date)).then((r) => {
      if (!live) return;
      if (!r.ok && r.reason !== 'offline' && active && date < today) {
        // An earlier day's session that cannot be finished must not hold today; today's own session stays, and so does any session through a network failure. The next open retries.
        clearActive(DAILY.active);
        const results = loadResults(DAILY.results);
        setPlan({ date: today, active: null, done: results[`wp-${today}`] ?? null, drop: false });
        return;
      }
      setLoad(r);
    });
    return () => {
      live = false;
    };
  }, [date, active, today]);

  /** The next day has begun: leave the finished result for the new daily. */
  const openToday = () => {
    const next = localDateKey(now());
    setToday(next);
    setFinished(null);
    setLoad(null);
    setPlan(pickDaily(next));
  };

  let body: ReactNode = null; // loading: the header alone, briefly
  if (load?.ok) {
    const { puzzle, solutions } = load;
    body = (
      <PuzzlePlayer
        key={puzzle.id}
        keys={DAILY}
        puzzle={puzzle}
        solutions={solutions}
        date={date}
        resume={done ? reopen(done, puzzle.id, solutions) : active}
        result={
          result && (
            <ResultScreen
              mode="daily"
              result={result}
              clue={puzzle.clue}
              answer={wordpathV1.recoverAnswer(puzzle) ?? ''}
              focus={finished !== null}
              now={now}
              onUnlimited={onUnlimited}
              onStats={openStats}
              onToday={openToday}
            />
          )
        }
        onDone={setFinished}
      />
    );
  } else if (load?.reason === 'missing') {
    body = (
      <EmptyPlot
        title="No Word Path puzzle today"
        text="Today's plot isn't ready yet. Try again in a little while, or play an Unlimited puzzle now."
        onBack={onBack}
        onUnlimited={onUnlimited}
      />
    );
  } else if (load?.reason === 'offline') {
    body = <EmptyPlot title="Couldn't load the puzzle" text="Check your connection and try again." onBack={onBack} />;
  } else if (load) {
    body = <EmptyPlot title="This puzzle won't open" text="Something is wrong with this puzzle file. Try again in a little while." onBack={onBack} />;
  }

  return (
    <>
      <Header title="Word Path" subtitle={formatDateLabel(date)} streak={stats.daily.current} onBack={onBack} onStats={openStats} onHowTo={openHowTo} />
      {body}
      {dialogs}
    </>
  );
}
