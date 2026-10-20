import { useState } from 'react';
import type { wordpathV1 } from '@ttg/engine';
import { WordPathDaily } from './games/wordpath/WordPathDaily';
import './App.css';

type Level = wordpathV1.Level;

export type View =
  | { name: 'home' }
  | { name: 'wordpath' }
  | { name: 'daily' }
  | { name: 'unlimited'; level: Level };

// Placeholder home until Task 22 replaces it with the real Home and Word Path page.
export function App() {
  const [view, setView] = useState<View>({ name: 'home' });

  if (view.name === 'home') {
    return (
      <main className="placeholder">
        <h1>Tiny Trouble Games</h1>
        <div className="btns">
          <button type="button" className="btn primary" onClick={() => setView({ name: 'wordpath' })}>
            Word Path
          </button>
          <button type="button" className="btn" onClick={() => setView({ name: 'daily' })}>
            Daily
          </button>
        </div>
      </main>
    );
  }
  if (view.name === 'daily') {
    const toPage = () => setView({ name: 'wordpath' });
    return <WordPathDaily now={() => new Date()} onBack={toPage} onUnlimited={toPage} />;
  }
  return (
    <main className="placeholder">
      <p>{view.name}</p>
      <button type="button" className="btn" onClick={() => setView({ name: 'home' })}>
        Back
      </button>
    </main>
  );
}
