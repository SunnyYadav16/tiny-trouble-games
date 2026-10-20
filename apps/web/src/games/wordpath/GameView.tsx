import { wordpathV1 } from '@ttg/engine';
import { useEffect, useId, useReducer, useRef, useState, type ReactNode, type Ref } from 'react';
import { LiveRegion } from '../../shared/LiveRegion';
import { Board, type RouteState } from './Board';
import { CLEAR, FLAG, Icon } from './icons';
import { Stones } from './Stones';
import './GameView.css';

const { WRONG_MS, initialState, spell, step } = wordpathV1;
type State = wordpathV1.State;

interface Props {
  game: wordpathV1.Game;
  clue: string;
  /** Answer length: one stone per letter. */
  length: number;
  /** Tile edge in px, computed by the play layout from the measured board slot. */
  tile: number;
  /** A saved or finished attempt to open on. A finished one shows its final state without celebrating. */
  initial?: State;
  unlimited?: boolean;
  /** Mouse devices: show the Esc hint on Clear and the keyboard line. */
  showShortcuts?: boolean;
  /** The board stage: the slot the play layout measures. It has no padding. */
  stageRef?: Ref<HTMLDivElement>;
  /** Once there is a result, the side panel shows it in place of the clue and controls; the board stays as it ended. */
  result?: ReactNode;
  /** Stage decorations under the board (compass, scale bar). */
  decor?: ReactNode;
  onChange: (s: State) => void;
  onFinish: (s: State) => void;
}

interface Model {
  state: State;
  /** Live region text for the last change. */
  say: string;
}

/** What a screen reader hears for a change from `prev` to `next` ('' keeps the last message). */
function announce(game: wordpathV1.Game, prev: State, next: State): string {
  if (next.status === 'won') return 'Solved';
  if (next.status === 'gave-up') return 'Gave up';
  if (next.wrong && next.wrong !== prev.wrong) return `${next.wrong.word} is not the answer`;
  if (next.route.length === 0 && prev.route.length > 0) return 'Route cleared';
  const last = next.route[next.route.length - 1];
  if (last === undefined || next.route === prev.route) return '';
  return `${game.cells[last]} selected, ${next.route.length} of ${game.solution.length}`;
}

/**
 * The playable puzzle: the side panel (clue, answer stones, result line, controls) and the board stage,
 * as two siblings for the play layout's grid. Engine `step` decides everything; this only shows it.
 */
export function GameView({ game, clue, length, tile, initial, unlimited, showShortcuts, stageRef, result, decor, onChange, onFinish }: Props) {
  const [{ state, say }, dispatch] = useReducer(
    (m: Model, a: wordpathV1.Action): Model => {
      const next = step(game, m.state, a);
      return next === m.state ? m : { state: next, say: announce(game, m.state, next) || m.say };
    },
    initial,
    (start): Model => ({ state: start ?? initialState(), say: '' }),
  );
  // Give up's inline confirm. Only a dismissed confirm swaps the button back in with motion.
  const [ask, setAsk] = useState<'never' | 'open' | 'closed'>('never');
  const confirming = ask === 'open';
  const giveUpRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const resRef = useRef<HTMLDivElement>(null);
  const promptId = useId();

  // Parent callbacks: every change, and the one move from playing to finished (never for a state opened finished).
  const seen = useRef(state);
  useEffect(() => {
    const was = seen.current;
    if (was === state) return;
    seen.current = state;
    onChange(state);
    if (was.status === 'playing' && state.status !== 'playing') onFinish(state);
  }, [state, onChange, onFinish]);

  // A wrong route stays on show for WRONG_MS; any other action ends the window sooner and cancels this timer.
  useEffect(() => {
    if (!state.wrong) return;
    const id = setTimeout(() => dispatch({ type: 'settle' }), WRONG_MS);
    return () => clearTimeout(id);
  }, [state.wrong]);

  // Escape dismisses an open Give up confirm, otherwise clears the route; never inside an open dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as Element | null)?.closest?.('dialog, [role="dialog"]')) return;
      if (confirming) setAsk('closed');
      else dispatch({ type: 'clear' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);

  // Focus follows the Give up swap: into the safe choice, and back to the button when dismissed.
  useEffect(() => {
    if (ask === 'open') keepRef.current?.focus();
    if (ask === 'closed') giveUpRef.current?.focus();
  }, [ask]);

  const playing = state.status === 'playing';
  const shown = state.wrong?.route ?? state.route;
  const routeState: RouteState = state.status === 'won' ? 'solved' : state.status === 'gave-up' ? 'revealed' : state.wrong ? 'wrong' : 'active';
  const letters = state.wrong?.word ?? spell(game.cells, state.route);
  const answer = spell(game.cells, game.solution);
  const kind = state.status === 'won' ? ('solved' as const) : state.status === 'gave-up' ? ('revealed' as const) : undefined;
  const stoneText = kind ? answer : letters;
  const which = unlimited ? 'the' : "today's";

  return (
    <>
      <div className="side game-side">
        {result ?? (
          <>
            <div className="cartouche">
              <span className="lbl">Clue</span>
              <p>{clue}</p>
            </div>

            <Stones text={stoneText} length={length} kind={kind} />

            <div ref={resRef} className="resline" data-good={state.status === 'won' || undefined} tabIndex={-1}>
              {state.status === 'won' && 'Solved'}
              {state.status === 'gave-up' && `Gave up. The answer is ${answer}`}
              {state.wrong && (
                <>
                  <span className="word">{state.wrong.word}</span> is not {which} answer
                </>
              )}
            </div>

            {playing && (
              <div className="btns controls" data-confirming={confirming || undefined}>
                <button type="button" className="btn clear" aria-keyshortcuts={showShortcuts ? 'Escape' : undefined} onClick={() => dispatch({ type: 'clear' })}>
                  <Icon d={CLEAR} />
                  Clear
                  {showShortcuts && <kbd aria-hidden="true">Esc</kbd>}
                </button>
                {confirming ? (
                  <div className="confirm">
                    <span id={promptId}>{unlimited ? 'Give up? The answer will be shown.' : 'Give up? Your streak resets.'}</span>
                    <button
                      type="button"
                      className="btn primary"
                      aria-describedby={promptId}
                      onClick={() => {
                        setAsk('closed');
                        dispatch({ type: 'giveUp' });
                        resRef.current?.focus();
                      }}
                    >
                      Yes, show answer
                    </button>
                    <button ref={keepRef} type="button" className="btn" aria-describedby={promptId} onClick={() => setAsk('closed')}>
                      Keep playing
                    </button>
                  </div>
                ) : (
                  <button
                    ref={giveUpRef}
                    type="button"
                    className="btn quiet giveup"
                    data-returned={ask === 'closed' || undefined}
                    onClick={() => setAsk('open')}
                  >
                    <Icon d={FLAG} />
                    Give up
                  </button>
                )}
              </div>
            )}

            {showShortcuts && playing && (
              <p className="kbdline">
                <span className="visually-hidden">Arrow keys move, Enter or Space selects, Escape clears.</span>
                <span aria-hidden="true">
                  <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> move · <kbd>Enter</kbd> or <kbd>Space</kbd> selects · <kbd>Esc</kbd> clears
                </span>
              </p>
            )}
          </>
        )}

        <LiveRegion message={say} />
      </div>

      <div ref={stageRef} className="stage">
        <Board
          size={game.size}
          tile={tile}
          cells={game.cells}
          route={shown}
          routeState={routeState}
          disabled={!playing}
          onTap={(cell) => dispatch({ type: 'tap', cell })}
        />
        {decor}
      </div>
    </>
  );
}
