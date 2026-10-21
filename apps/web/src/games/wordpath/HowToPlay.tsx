import { useGSAP } from '@gsap/react';
import { useId, useRef, useState } from 'react';
import { canPersist, load, save } from '../../shared/storage';
import { Board } from './Board';
import { Dialog } from './Dialog';
import { EXAMPLE, EXAMPLE_FRAMES, EXAMPLE_LAST } from './example';
import { Icon, REPLAY } from './icons';
import { layRoute, prefersReduced } from './motion';
import { WIDE, useMedia } from './useMedia';
import './HowToPlay.css';

const SEEN = 'ttg:wordpath:seen-howto';
// In memory, since storage is the thing that failed: when this browser will not keep the flag, it holds for this visit.
let seenThisVisit = false;
export const seenHowTo = (): boolean => seenThisVisit || load(SEEN, (v): v is true => v === true) === true;

const noop = () => {};

/** Three steps beside the example, which plays once (Replay plays it again). Closing marks it seen. */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const scope = useRef<HTMLDivElement>(null);
  const wide = useMedia(WIDE);
  const [reduced] = useState(prefersReduced);
  const [frame, setFrame] = useState(reduced ? EXAMPLE_LAST : 0);
  const [run, setRun] = useState(0);

  // Reduced motion: the final frame, no timeline and no timers.
  useGSAP(
    () => {
      if (!reduced) layRoute(setFrame, EXAMPLE_LAST);
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
          <Board size={EXAMPLE.size} tile={wide ? 58 : 50} cells={EXAMPLE.cells} route={EXAMPLE_FRAMES[frame]!.route} routeState="active" disabled onTap={noop} />
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
