import { wordpathV1 } from '@ttg/engine';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { formatDuration } from '../../shared/daily';
import { CLEAR, INFO, Icon, LevelIcon } from './icons';
import type { Stats, Summary } from './stats';
import './StatsDialog.css';

type Props = Stats & { onClose: () => void };

const percent = (rate: number) => `${Math.round(rate * 100)}%`;
const time = (s: Summary) => (s.solved ? formatDuration(s.avgSolveMs) : '–');

const Rows = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="stattable">
    {rows.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

/** Solve times as bars, scaled to the busiest bucket; each bar is decoration for the text count beside it. */
const Distribution = ({ summary }: { summary: Summary }) => {
  const most = Math.max(1, ...summary.distribution.map((d) => d.count));
  return (
    <ul className="dist" aria-label="Solve times">
      {summary.distribution.map(({ label, count }) => (
        <li key={label}>
          <span>
            {label}
            <span className="visually-hidden">:</span>
          </span>
          <span className="b" aria-hidden="true" style={{ width: count ? `${Math.max(4, (count / most) * 100)}%` : 0 }} />
          <span className="n">
            {count}
            <span className="visually-hidden"> {count === 1 ? 'puzzle' : 'puzzles'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};

/** A modal over the play screen: Daily (with streaks) beside Unlimited (per level). The parent unmounts it on close. */
export function StatsDialog({ daily, unlimited, byLevel, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressedOnBackdrop = useRef(false);

  // Native modal: the page behind goes inert and Tab stays inside. Focus goes back to whatever opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, []);

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a click on the backdrop is a mouse shortcut; Escape and Close are the keyboard routes
    <dialog
      ref={ref}
      className="dialog stats"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // Escape: closing is the parent's call, which unmounts this
        onClose();
      }}
      // Only the backdrop is the <dialog> itself (the panel inside fills it). A drag that began in the content and ended on the backdrop is not a backdrop click.
      onMouseDown={(e) => (pressedOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => e.target === e.currentTarget && pressedOnBackdrop.current && onClose()}
    >
      <div className="panel">
        <button type="button" className="iconbtn x" aria-label="Close" onClick={onClose}>
          <Icon d={CLEAR} />
        </button>
        <h2 id={titleId}>Stats</h2>
        <div className="statcols">
          <section aria-labelledby={`${titleId}-daily`}>
            <h3 id={`${titleId}-daily`}>Daily</h3>
            <Rows
              rows={[
                ['Played', daily.played],
                ['Solved', daily.solved],
                ['Solve rate', percent(daily.solveRate)],
                ['Current streak', daily.current],
                ['Best streak', daily.best],
                ['Average time', time(daily)],
              ]}
            />
            <Distribution summary={daily} />
          </section>
          <section aria-labelledby={`${titleId}-unlimited`}>
            <h3 id={`${titleId}-unlimited`}>Unlimited</h3>
            <Rows
              rows={[
                ['Played', unlimited.played],
                ['Solved', unlimited.solved],
                ['Solve rate', percent(unlimited.solveRate)],
                ['Average time', time(unlimited)],
              ]}
            />
            <table className="lvl-stats">
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col">Solved</th>
                  <th scope="col">Avg</th>
                </tr>
              </thead>
              <tbody>
                {wordpathV1.LEVELS.map((level) => (
                  <tr key={level}>
                    <th scope="row">
                      <LevelIcon level={level} />
                      {level[0]!.toUpperCase() + level.slice(1)}
                    </th>
                    <td>{byLevel[level].solved}</td>
                    <td>{time(byLevel[level])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Distribution summary={unlimited} />
          </section>
        </div>
        <p className="store-note">
          <Icon d={INFO} />
          <span>Saved in this browser only. Clearing your browser data, or using a private window, starts your stats fresh.</span>
        </p>
      </div>
    </dialog>
  );
}
