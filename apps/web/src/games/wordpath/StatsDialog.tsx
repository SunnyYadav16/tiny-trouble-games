import { wordpathV1 } from '@ttg/engine';
import { useId, type ReactNode } from 'react';
import { formatDuration } from '../../shared/daily';
import { Dialog } from './Dialog';
import { INFO, Icon, LevelIcon } from './icons';
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
  const titleId = useId();

  return (
    <Dialog className="stats" labelledBy={titleId} onClose={onClose}>
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
    </Dialog>
  );
}
