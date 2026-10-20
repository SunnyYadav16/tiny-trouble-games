import { useGSAP } from '@gsap/react';
import { wordpathV1 } from '@ttg/engine';
import { useEffect, useRef, useState } from 'react';
import { Home } from './games/wordpath/Home';
import { prefersReduced, screenEnter } from './games/wordpath/motion';
import { PlayPage } from './games/wordpath/PlayPage';
import { WordPathDaily } from './games/wordpath/WordPathDaily';
import './App.css';

type Level = wordpathV1.Level;

export type View =
  | { name: 'home' }
  | { name: 'wordpath' }
  | { name: 'daily' }
  | { name: 'unlimited'; level: Level };

const now = () => new Date();

/** Home → the Word Path page → daily or an Unlimited level; Back from a game returns to the page, Back from the page returns Home. */
export function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const screen = useRef<HTMLDivElement>(null);

  // Each change of screen rises into place; the first screen just appears.
  const shown = useRef(view);
  useGSAP(
    () => {
      if (shown.current === view) return;
      shown.current = view;
      screenEnter(screen.current!, prefersReduced());
    },
    { scope: screen, dependencies: [view], revertOnUpdate: true },
  );

  // A new screen takes keyboard and screen-reader focus on its heading; the first screen leaves focus alone.
  const focused = useRef(view);
  useEffect(() => {
    if (focused.current === view) return;
    focused.current = view;
    screen.current?.querySelector('h1')?.focus();
  }, [view]);

  const toPage = () => setView({ name: 'wordpath' });
  let body;
  if (view.name === 'home') body = <Home now={now} onOpen={toPage} />;
  else if (view.name === 'wordpath')
    body = <PlayPage now={now} onBack={() => setView({ name: 'home' })} onDaily={() => setView({ name: 'daily' })} onUnlimited={(level) => setView({ name: 'unlimited', level })} />;
  else if (view.name === 'daily') body = <WordPathDaily now={now} onBack={toPage} onUnlimited={toPage} />;
  else
    // Task 23 replaces this with the unlimited screen.
    body = (
      <main className="placeholder">
        <p>Unlimited · {view.level[0]!.toUpperCase() + view.level.slice(1)}</p>
        <button type="button" className="btn" onClick={toPage}>
          Back
        </button>
      </main>
    );

  return (
    <div className="screen" ref={screen}>
      {body}
    </div>
  );
}
