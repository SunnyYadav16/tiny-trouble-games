import { wordpathV1 } from '@ttg/engine';
import { useEffect, useRef, useState } from 'react';
import { localDateKey } from '../../shared/daily';
import { EmptyPlot } from './EmptyPlot';
import { Header } from './Header';
import { INFO, Icon } from './icons';
import { PuzzlePlayer } from './PuzzlePlayer';
import { loadResults, type ResultRecord } from './results';
import { ResultScreen } from './ResultScreen';
import { loadActive, unlimitedKeys } from './session';
import { loadStats } from './stats';
import { findPuzzle, levelName, type Found } from './unlimited';
import { useHeaderDialogs } from './useHeaderDialogs';
import './UnlimitedScreen.css';

interface Props {
  level: wordpathV1.Level;
  now: () => Date;
  /** Back and Change level: to the Word Path page, with the puzzle still saved. */
  onBack: () => void;
}

/** `undefined` while loading, `null` when there is nothing to play. */
type Load = Found | null | undefined;

/** The ids of every unlimited puzzle played so far, from this browser's saved results. */
const seenIds = (resultsKey: string) => new Set(Object.keys(loadResults(resultsKey)));

/** Puzzle after puzzle at one level, chosen on the Word Path page (N21): resumes the saved one, else picks the next unseen. */
export function UnlimitedScreen({ level, now, onBack }: Props) {
  const keys = unlimitedKeys(level);
  const name = levelName(level);
  const [load, setLoad] = useState<Load>(undefined);
  const [round, setRound] = useState(0);
  const [finished, setFinished] = useState<ResultRecord | null>(null);

  // Math.random: a UI choice of which puzzle to show, not puzzle generation.
  useEffect(() => {
    let live = true;
    void findPuzzle(level, loadActive(keys.active), seenIds(keys.results), Math.random).then((r) => live && setLoad(r));
    return () => {
      live = false;
    };
  }, [level, keys.active, keys.results]);

  // Next puzzle unmounts the button that was pressed, so once the next one loads the heading takes focus.
  const refocus = useRef(false);
  useEffect(() => {
    if (load !== undefined && refocus.current) {
      refocus.current = false;
      document.querySelector<HTMLElement>('h1')?.focus();
    }
  }, [load]);

  const next = () => {
    refocus.current = true;
    setFinished(null);
    setLoad(undefined);
    setRound((n) => n + 1);
    void findPuzzle(level, null, seenIds(keys.results), Math.random).then(setLoad);
  };

  const stats = loadStats(localDateKey(now()));
  const { openStats, openHowTo, dialogs } = useHeaderDialogs(stats);

  let body = null; // loading: the header alone, briefly
  if (load) {
    const { puzzle, solutions, resume, replay } = load;
    body = (
      <>
        {replay && (
          <output className="strip">
            <span className="info">
              <Icon d={INFO} />
            </span>
            <span>You've played every puzzle. New ones arrive daily, so here's one again.</span>
          </output>
        )}
        <PuzzlePlayer
          key={`${puzzle.id}:${round}`}
          keys={keys}
          puzzle={puzzle}
          solutions={solutions}
          date={resume?.date ?? localDateKey(now())}
          resume={resume}
          unlimited
          result={
            finished && (
              <ResultScreen
                mode="unlimited"
                result={finished}
                clue={puzzle.clue}
                answer={wordpathV1.recoverAnswer(puzzle) ?? ''}
                focus
                onNext={next}
                onUnlimited={onBack}
              />
            )
          }
          onDone={setFinished}
        />
      </>
    );
  } else if (load === null) {
    body = <EmptyPlot title={`No ${name} puzzles yet`} text="New ones arrive daily. Try another level, or come back in a little while." onBack={onBack} />;
  }

  return (
    <>
      <Header title="Word Path" subtitle={`Unlimited · ${name}`} streak={null} onBack={onBack} onStats={openStats} onHowTo={openHowTo} />
      {body}
      {dialogs}
    </>
  );
}
