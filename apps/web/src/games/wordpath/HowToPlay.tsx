import { useGSAP } from '@gsap/react';
import { wordpathV1 } from '@ttg/engine';
import gsap from 'gsap';
import { useId, useRef, useState } from 'react';
import { canPersist, load, save } from '../../shared/storage';
import { Board } from './Board';
import { Dialog } from './Dialog';
import { EXAMPLE } from './example';
import { Icon, REPLAY } from './icons';
import { prefersReduced } from './motion';
import { WIDE, useMedia } from './useMedia';
import './HowToPlay.css';

const SEEN = 'ttg:wordpath:seen-howto';
// In memory, since storage is the thing that failed: when this browser will not keep the flag, it holds for this visit.
let seenThisVisit = false;
export const seenHowTo = (): boolean => seenThisVisit || load(SEEN, (v): v is true => v === true) === true;

// The demo is the engine playing the example: each frame is the state after one more tap, so it cannot drift from the rules.
const GAME: wordpathV1.Game = { size: EXAMPLE.size, cells: EXAMPLE.cells, solution: EXAMPLE.solution };
const FRAMES = EXAMPLE.solution.reduce(
  (frames, cell) => [...frames, wordpathV1.step(GAME, frames.at(-1)!, { type: 'tap', cell })],
  [wordpathV1.initialState()],
);
const LAST = FRAMES.length - 1;
/** Seconds: the first tap waits for the dialog to open, then one tap per beat (done by 2.3 s). */
const FIRST_TAP = 0.5;
const BEAT = 0.45;
const noop = () => {};

/** Three steps beside the example, which plays once (Replay plays it again). Closing marks it seen. */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const scope = useRef<HTMLDivElement>(null);
  const wide = useMedia(WIDE);
  const [reduced] = useState(prefersReduced);
  const [frame, setFrame] = useState(reduced ? LAST : 0);
  const [run, setRun] = useState(0);

  // Reduced motion: the final frame, no timeline and no timers.
  useGSAP(
    () => {
      if (reduced) return;
      const tl = gsap.timeline();
      FRAMES.forEach((_, i) => tl.call(setFrame, [i], i && FIRST_TAP + (i - 1) * BEAT));
    },
    { scope, dependencies: [run], revertOnUpdate: true },
  );

  const close = () => {
    save(SEEN, true);
    if (!canPersist()) seenThisVisit = true;
    onClose();
  };

  return (
    <Dialog className="howto" labelledBy={titleId} onClose={close}>
      <div className="example" ref={scope}>
        <div aria-hidden="true" inert>
          <Board size={EXAMPLE.size} tile={wide ? 58 : 50} cells={EXAMPLE.cells} route={FRAMES[frame]!.route} routeState="active" disabled onTap={noop} />
        </div>
        <span className="cap">{EXAMPLE.word}, traced in one path</span>
      </div>
      <div>
        <h2 id={titleId}>How to play</h2>
        <ol className="steps">
          <li>Read the clue and work out the word.</li>
          <li>Tap touching tiles, up, down, left or right, to spell it. Tap the last tile again to undo.</li>
          <li>Only one path in the grid spells the answer. Truly stuck? Give up shows it, but resets your daily streak.</li>
        </ol>
        <div className="btns">
          <button type="button" className="btn primary" onClick={close}>
            Got it
          </button>
          {!reduced && (
            <button
              type="button"
              className="btn quiet"
              onClick={() => {
                setFrame(0);
                setRun((n) => n + 1);
              }}
            >
              <Icon d={REPLAY} />
              Replay example
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
