import { useState } from 'react';
import { canPersist } from '../../shared/storage';
import { ALERT, BACK, CLEAR, FLAME, HELP, Icon, STATS } from './icons';
import './Header.css';

interface Props {
  title: string;
  /** The date label (daily) or "Unlimited · <Level>". */
  subtitle: string;
  /** Hidden when null. */
  streak: number | null;
  onBack: () => void;
  onStats: () => void;
  onHowTo: () => void;
}

// In memory, since storage is the thing that failed: a dismissal lasts for this visit.
let noticeDismissed = false;

/** The play screens' top bar, and under it the notice when this browser will not keep progress (N14). */
export function Header({ title, subtitle, streak, onBack, onStats, onHowTo }: Props) {
  const [dismissed, setDismissed] = useState(noticeDismissed);

  return (
    <>
      <header className="bar">
        <button type="button" className="iconbtn" aria-label="Back" onClick={onBack}>
          <Icon d={BACK} />
        </button>
        <div className="title">
          <h1>{title}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <span className="spacer" />
        {streak !== null && (
          <span className="streak">
            <Icon d={FLAME} />
            <span aria-hidden="true">{streak}</span>
            <span className="visually-hidden">{streak}-day streak</span>
          </span>
        )}
        <button type="button" className="iconbtn" aria-label="Stats" onClick={onStats}>
          <Icon d={STATS} />
        </button>
        <button type="button" className="iconbtn" aria-label="How to play" onClick={onHowTo}>
          <Icon d={HELP} />
        </button>
      </header>

      {!dismissed && !canPersist() && (
        <output className="strip">
          <span className="warn">
            <Icon d={ALERT} />
          </span>
          <span>This browser isn't saving progress. You can still play, but your result and streak won't be kept.</span>
          <button
            type="button"
            className="btn quiet dismiss"
            onClick={() => {
              noticeDismissed = true;
              setDismissed(true);
            }}
          >
            <Icon d={CLEAR} />
            <span>Dismiss</span>
          </button>
        </output>
      )}
    </>
  );
}
