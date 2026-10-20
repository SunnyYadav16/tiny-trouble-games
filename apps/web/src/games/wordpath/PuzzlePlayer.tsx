import { wordpathV1 } from '@ttg/engine';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useVisibleTimer } from '../../shared/useVisibleTimer';
import { GameView } from './GameView';
import { chooseSize, tileFor } from './layout';
import { saveResult, type ResultRecord } from './results';
import { clearActive, saveActive, type ActiveSession, type ModeKeys } from './session';
import { useLayoutInput } from './useLayoutInput';
import './PuzzlePlayer.css';

const { SIZES, initialState } = wordpathV1;
type State = wordpathV1.State;

/** The board is drawn at this size, hidden and inert, until the first real measurement picks its size. */
const PROBE = SIZES[0]!;

interface Props {
  keys: ModeKeys;
  puzzle: wordpathV1.PuzzleBody;
  solutions: Record<number, number[]>;
  /** The daily's date, or the play date in unlimited. */
  date: string;
  /** A saved attempt, or a finished one to show as it ended. */
  resume: ActiveSession | null;
  unlimited?: boolean;
  /** Replaces the clue and controls in the side panel; the same board stays on the stage. */
  result?: ReactNode;
  onDone: (r: ResultRecord) => void;
}

/** R-C9: a saved session must belong to this puzzle and fit a board the engine builds. */
function fits(s: ActiveSession, puzzle: wordpathV1.PuzzleBody): boolean {
  const cells = s.size * s.size;
  const route = [...s.state.route, ...(s.state.wrong?.route ?? [])];
  return s.puzzleId === puzzle.id && (SIZES as readonly number[]).includes(s.size) && route.every((c) => c < cells);
}

/** Plays one loaded puzzle: picks and locks the board size, runs the clock, saves progress, records the result. */
export function PuzzlePlayer({ keys, puzzle, solutions, date, resume, unlimited, result, onDone }: Props) {
  const [start] = useState(() => {
    if (!resume || fits(resume, puzzle)) return resume;
    clearActive(keys.active);
    return null;
  });

  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const input = useLayoutInput(stage);
  // N8, W1: the first real measurement picks the size, and it holds for the whole attempt.
  const [size, setSize] = useState(start?.size ?? null);
  if (size === null && input.width > 0) setSize(chooseSize(input));
  const shown = size ?? PROBE;
  const probing = size === null || input.width === 0;

  const state = useRef<State>(start?.state ?? initialState());
  const [playing, setPlaying] = useState((start?.state.status ?? 'playing') === 'playing');
  const { elapsed } = useVisibleTimer(start?.elapsedMs ?? 0, playing && size !== null);

  const save = useCallback(() => {
    if (size === null || state.current.status !== 'playing') return;
    saveActive(keys.active, { puzzleId: puzzle.id, date, size, elapsedMs: Math.round(elapsed()), state: state.current });
  }, [keys.active, puzzle.id, date, size, elapsed]);

  // Leaving keeps the clock: the tab hides, the page closes, or this screen goes away.
  useEffect(() => {
    const onVisibility = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [save]);

  // GameView calls these from a guarded effect, so they need no stable identity.
  const onChange = (s: State) => {
    state.current = s;
    save();
  };

  const onFinish = (s: State) => {
    const record: ResultRecord = {
      id: puzzle.id,
      date,
      outcome: s.status === 'won' ? 'solved' : 'gave-up',
      timeMs: Math.round(elapsed()),
      wrongAttempts: s.wrongAttempts,
      size: shown,
      level: puzzle.meta.level,
    };
    saveResult(keys.results, record);
    clearActive(keys.active);
    setPlaying(false);
    onDone(record);
  };

  return (
    <main className="play" data-probe={probing || undefined} inert={probing}>
      <GameView
        // GameView reads game and initial once; only the probe-to-real switch remounts it, never a finish.
        key={`${puzzle.id}:${shown}`}
        game={{ size: shown, cells: puzzle.grids[shown]!, solution: solutions[shown]! }}
        clue={puzzle.clue}
        length={puzzle.length}
        tile={tileFor(shown, input)}
        initial={start?.state}
        unlimited={unlimited}
        showShortcuts={input.finePointer}
        stageRef={setStage}
        result={result}
        decor={
          <>
            <Compass />
            <div className="scalebar">
              <i aria-hidden="true">
                <b />
                <b />
                <b />
                <b />
              </i>
              Plot {shown} × {shown}
            </div>
          </>
        }
        onChange={onChange}
        onFinish={onFinish}
      />
    </main>
  );
}

const Compass = () => (
  <svg className="compass" viewBox="0 0 54 54" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
    <circle cx="27" cy="29" r="15" />
    <circle cx="27" cy="29" r="11" strokeDasharray="1.5 2.5" />
    <path d="M27 12l3.4 17L27 46l-3.4-17z" fill="currentColor" fillOpacity=".18" />
    <path d="M27 12l3.4 17h-6.8z" fill="currentColor" />
    <text x="27" y="8" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">
      N
    </text>
  </svg>
);
