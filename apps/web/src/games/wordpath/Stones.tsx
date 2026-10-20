import { CHECK, Icon } from './icons';
import './Stones.css';

interface Props {
  /** What fills the stones so far; one stone per letter of `length`, empty sockets for the rest. */
  text: string;
  length: number;
  /** Set once the puzzle is over: green with a check when solved, ink when the answer was revealed. */
  kind?: 'solved' | 'revealed';
  /** Read aloud for the check; empty when a heading beside it already says so. */
  okLabel?: string;
}

/** The answer stones: the same row while playing and on the result. */
export function Stones({ text, length, kind, okLabel = 'Solved' }: Props) {
  return (
    <div className="stones">
      {Array.from({ length }, (_, i) => {
        const ch = text[i];
        return ch ? (
          <div key={`${i}${ch}`} className={`stoneb ${kind ?? ''}`}>
            <span>{ch}</span>
          </div>
        ) : (
          <div key={i} className="stoneb empty" aria-hidden="true" />
        );
      })}
      {kind === 'solved' && (
        <span className="ok">
          <Icon d={CHECK} />
          {okLabel && <span className="visually-hidden">{okLabel}</span>}
        </span>
      )}
    </div>
  );
}
