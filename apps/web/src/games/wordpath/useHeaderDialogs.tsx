import { useState, type ReactNode } from 'react';
import { HowToPlay } from './HowToPlay';
import type { Stats } from './stats';
import { StatsDialog } from './StatsDialog';

/** The Stats and How to play dialogs behind a play screen's header buttons: render `dialogs` once, wire the openers. */
export function useHeaderDialogs(stats: Stats, howToOpen = false): { openStats: () => void; openHowTo: () => void; dialogs: ReactNode } {
  const [showStats, setShowStats] = useState(false);
  const [showHowTo, setShowHowTo] = useState(howToOpen);
  return {
    openStats: () => setShowStats(true),
    openHowTo: () => setShowHowTo(true),
    dialogs: (
      <>
        {showStats && <StatsDialog {...stats} onClose={() => setShowStats(false)} />}
        {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}
      </>
    ),
  };
}
