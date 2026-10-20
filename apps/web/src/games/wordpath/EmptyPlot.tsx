import { BACK, INFINITY, Icon } from './icons';
import './EmptyPlot.css';

/** No puzzle to play: an empty hedged plot with its gate open, and the ways out. */
export function EmptyPlot({ title, text, onBack, onUnlimited }: { title: string; text: string; onBack: () => void; onUnlimited?: () => void }) {
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
