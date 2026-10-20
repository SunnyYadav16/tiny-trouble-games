import { wordpathV1 } from '@ttg/engine';
import { useEffect, useState, type ReactNode } from 'react';
import { formatDateLabel, formatDuration, localDateKey } from '../../shared/daily';
import { Header } from './Header';
import { BACK, INFINITY, Icon } from './icons';
import { dailyUrl, loadPuzzle, type LoadResult } from './loadPuzzle';
import { PuzzlePlayer } from './PuzzlePlayer';
import { loadResults, type ResultRecord } from './results';
import { DAILY, clearActive, loadActive, type ActiveSession } from './session';
import './WordPathDaily.css';

interface Props {
  now: () => Date;
  /** Both return to the Word Path page (N21). */
  onBack: () => void;
  onUnlimited: () => void;
}

// Tasks 21 and 22 wire the stats dialog and how to play.
const later = () => {};

/** A session saved on an earlier day is finished first, under its own date. */
function pickDaily(now: Date) {
  const active = loadActive(DAILY.active);
  const date = active?.date ?? localDateKey(now);
  return { date, active, done: loadResults(DAILY.results)[`wp-${date}`] ?? null };
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
  const [{ date, active, done }] = useState(() => pickDaily(now()));
  const [result, setResult] = useState(done);
  const [load, setLoad] = useState<LoadResult | null>(null);

  useEffect(() => {
    // Already finished: a leftover session must not hold later days.
    if (done && active) clearActive(DAILY.active);
  }, [done, active]);

  useEffect(() => {
    let live = true;
    void loadPuzzle(dailyUrl(date)).then((r) => {
      if (!live) return;
      if (!r.ok && active) clearActive(DAILY.active);
      setLoad(r);
    });
    return () => {
      live = false;
    };
  }, [date, active]);

  let body: ReactNode = null; // loading: the header alone, briefly
  if (load?.ok) {
    const { puzzle, solutions } = load;
    body = (
      <PuzzlePlayer
        keys={DAILY}
        puzzle={puzzle}
        solutions={solutions}
        date={date}
        resume={done ? reopen(done, puzzle.id, solutions) : active}
        result={
          result && (
            <ResultView result={result} clue={puzzle.clue} answer={wordpathV1.recoverAnswer(puzzle) ?? ''} onUnlimited={onUnlimited} />
          )
        }
        onDone={setResult}
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
  } else if (load) {
    body = <EmptyPlot title="This puzzle won't open" text="Something is wrong with this puzzle file. Try again in a little while." onBack={onBack} />;
  }

  return (
    <>
      <Header title="Word Path" subtitle={formatDateLabel(date)} streak={null} onBack={onBack} onStats={later} onHowTo={later} />
      {body}
    </>
  );
}

/** No puzzle to play: an empty hedged plot with its gate open, and the ways out. */
function EmptyPlot({ title, text, onBack, onUnlimited }: { title: string; text: string; onBack: () => void; onUnlimited?: () => void }) {
  return (
    <main className="play empty">
      <div className="side">
        <h2 className="res-h">{title}</h2>
        <p className="res-clue">{text}</p>
        <div className="btns">
          {onUnlimited && (
            <button type="button" className="btn primary big" onClick={onUnlimited}>
              <Icon d={INFINITY} />
              Play unlimited
            </button>
          )}
          <button type="button" className="btn big" onClick={onBack}>
            <Icon d={BACK} />
            Back
          </button>
        </div>
      </div>
      <div className="stage">
        <div className="empty-plot" aria-hidden="true" />
      </div>
    </main>
  );
}

/** Placeholder until Task 21's ResultScreen takes this slot in the side panel. */
function ResultView({ result, clue, answer, onUnlimited }: { result: ResultRecord; clue: string; answer: string; onUnlimited: () => void }) {
  const solved = result.outcome === 'solved';
  return (
    <>
      <h2 className="res-h" data-good={solved || undefined}>
        {solved ? 'Solved' : 'Gave up'}
      </h2>
      <div className="stones">
        <span className="visually-hidden">The answer is {answer}</span>
        {[...answer].map((ch, i) => (
          <div key={i} className={`stoneb ${solved ? 'solved' : 'revealed'}`} aria-hidden="true">
            <span>{ch}</span>
          </div>
        ))}
      </div>
      <p className="res-clue">{clue}</p>
      <p className="res-nums">
        Time {formatDuration(result.timeMs)} · Wrong tries {result.wrongAttempts}
      </p>
      <div className="btns">
        <button type="button" className="btn primary big" onClick={onUnlimited}>
          <Icon d={INFINITY} />
          Play unlimited
        </button>
      </div>
    </>
  );
}
