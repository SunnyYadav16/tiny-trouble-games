# Tiny Trouble Games: Word Path Spec v1.0-rc1

Repository: [SunnyYadav16/tiny-trouble-games](https://github.com/SunnyYadav16/tiny-trouble-games)

Prepared October 9, 2026.

**Status:** release candidate. Once the decisions in section 13 are signed off, this becomes v1.0 and is frozen. Changes after that create v1.1 and a new rules version.

**Scope:** everything needed to build, test, and launch Word Path as a standalone game. This document supersedes section 2 of the collection spec (v0.4.1). The shared sections of that spec (input, daily lifecycle, public and private data, rules versioning) are restated here so this document stands alone.

**Changelog**

- **v1.0-rc1:** First standalone Word Path spec. Adds what the collection spec left undefined: answer eligibility rules (including a palindrome exclusion), letter-balance rules for grids, word list roles, failure handling, give-up, result screen, share text, practice mode, data schemas, repository layout, test plan, content requirements, and launch milestones.

---

## 1. The game

The player gets a clue and a full square grid of letter tiles. Every tile holds a letter from the answer, and only those letters, repeated across the grid. The player works out the answer from the clue, then taps a route of touching tiles that spells it. Exactly one route in the grid spells the answer, and no route spells any other word of the same length from the puzzle's word list.

---

## 2. Rules (`wordpath/v1`)

1. **Grid:** N×N, every cell filled, each cell holding one of the answer's distinct letters.
2. **Selecting:** the player taps tiles one at a time. Each tap must touch the previous tile up, down, left, or right. No diagonals. A tile cannot be used twice in one route.
3. **Changing the route:**
   - Tapping the last selected tile removes it.
   - Tapping an earlier selected tile cuts the route back to that tile.
   - Tapping a tile that does not touch the last one starts a new route from that tile.
4. **Checking:** when the route reaches the answer's length, it is checked automatically.
   - Correct: the puzzle is solved.
   - Wrong: the spelled word is shown for 0.9 seconds, then the route clears. Wrong attempts are counted.
5. **Hints:** up to 3 per puzzle.
   - If the current route is the start of the solution, a hint highlights the next correct tile for 1.2 seconds.
   - Otherwise, the hint clears the route first, then highlights the first tile of the solution.
6. **Clear:** empties the current route. Not counted as anything.
7. **Give up:** ends the puzzle unsolved and reveals the answer and its route. See section 9.2.
8. **No time limit and no attempt limit.**

---

## 3. Uniqueness guarantee

Let T be the target set: the answer plus every blocked word (section 4.3). A **route** is an ordered sequence of distinct, orthogonally adjacent cells whose length equals the answer's length.

A grid is valid only if **exactly one route spells any word in T, and that route spells the answer.**

Notes:

- Two routes through different cells count separately, even if they spell the same word.
- A route read backwards is a different route. If the answer reversed is a real word, it is an anagram and is therefore blocked.
- The guarantee holds relative to the puzzle's recorded word list version (`wordListVersion`). A rare word outside that list could still be traceable, so the blocking list should be broad.

---

## 4. Words

### 4.1 Two word lists with different jobs

| List | Purpose | Character |
| --- | --- | --- |
| Answer list | Where daily answers come from | Common, recognizable words only |
| Blocking list | Every word that must never be traceable | As broad as possible, including obscure words |

Recommended sources, both commonly used for word games:

- **Blocking list:** ENABLE (public domain), merged with a large SCOWL size (permissive license).
- **Answer list:** a smaller SCOWL size, or a frequency-filtered list.
- **\[Data\]** Read each list's license text before use and record the source and version in `content/wordlists/README.md`.

Both lists are versioned together as `wordListVersion` (for example `wl-2026-10-a`).

### 4.2 Answer eligibility

An answer must:

- be 5 to 7 letters long at launch;
- have at least 4 distinct letters;
- **not be a palindrome** (for example LEVEL or RADAR). A palindrome's route read backwards spells the same word, so every grid would have at least two routes and could never be valid;
- not be a proper noun, abbreviation, or offensive word;
- appear in the answer list.

Each answer is used as a daily at most once a year.

### 4.3 Blocked words

For each answer, the blocked list is every word in the blocking list that:

- has the same length as the answer, and
- uses only the answer's distinct letters,

excluding the answer itself. This includes every anagram (AMONG for MANGO) and every other same-length word (MANGA, MANNA, GAMMA for MANGO). It is fully automatic.

Words of other lengths do not matter, because a route is only checked at the answer's length.

### 4.4 Clues

- Written by an editor, in their own words. Never copied from a dictionary or quiz site.
- Must point clearly to the answer. Facts in the clue must be checked against a source, and the source recorded.
- Must not contain the answer or an obvious form of it.
- Target: hard but fair. A solver who knows the answer should recognise the clue as correct.

---

## 5. Grid generation

### 5.1 Sizes

Each daily puzzle is generated at five sizes: 6×6, 7×7, 8×8, 9×9, 10×10. All five must succeed for an answer to be scheduled. If any size fails, the answer is rejected for that date and logged.

### 5.2 Algorithm

For each size:

1. Seed a deterministic random generator from (date, size, generator version).
2. Fill every cell with a random letter from the answer's distinct letters.
3. Choose a random self-avoiding walk of the answer's length and write the answer along it. Lock those cells.
4. Count all routes spelling any word in T, using depth-first search from every cell, stopping each branch as soon as its letters stop matching the start of a word in T.
5. If more than one route exists: pick a random route other than the locked one, pick a random unlocked cell on it, and change that cell to the letter that leaves the fewest routes (with a 12% chance of a random letter instead, to escape dead ends). Repeat from step 4.
6. Accept when exactly one route remains and the quality checks in 5.3 pass.
7. Limits: 3,000 changes per attempt, 200 attempts per size. Exceeding both is a failure.

The generator is deterministic: the same inputs always produce the same grid.

### 5.3 Quality checks

A valid grid must also pass these, or the attempt is retried:

- **Letter balance:** each of the answer's distinct letters appears at least half as often as an even share. With k distinct letters on N×N cells, each letter must appear at least ⌈N²/(2k)⌉ times. This stops a rare letter from giving away the route.
- **Not a straight line:** the answer's route must contain at least one turn.

### 5.4 Difficulty metrics (recorded, not used for acceptance at launch)

- **Near misses:** routes that match the answer for its first L − 1 letters.
- **False starts:** cells holding the answer's first letter.
- **Route turns:** number of turns in the answer's route.

These are calibrated against solve times after launch.

---

## 6. Data

### 6.1 Public puzzle file (sent to every browser)

```json
{
  "id": "wp-2026-11-01",
  "game": "wordpath",
  "rulesVersion": "wordpath/v1",
  "date": "2026-11-01",
  "number": 1,
  "clue": "Alphonso and Kesar are prized varieties of this stone fruit",
  "length": 5,
  "grids": {
    "6": "MANGO...36 letters",
    "7": "...49 letters",
    "8": "...64 letters",
    "9": "...81 letters",
    "10": "...100 letters"
  }
}
```

Grids are stored as row-major strings.

### 6.2 Private record (generator, CI, and future checker only)

```json
{
  "id": "wp-2026-11-01",
  "answer": "MANGO",
  "wordListVersion": "wl-2026-10-a",
  "generatorVersion": "gen-1",
  "seed": "2026-11-01",
  "blocked": ["AMONG", "GAMMA", "MAMMA", "MANGA", "MANNA"],
  "routes": { "6": [14, 15, 21, 27, 28], "7": [], "8": [], "9": [], "10": [] },
  "routeCount": { "6": 1, "7": 1, "8": 1, "9": 1, "10": 1 },
  "metrics": { "6": { "nearMisses": 3, "falseStarts": 7, "routeTurns": 2 } },
  "clueSource": "https://example.com/source"
}
```

(Values above are illustrative.)

### 6.3 What the browser can and cannot know

At launch, the browser checks answers locally, so a determined player could work out the answer from the grid and the game's code. That is acceptable while scores stay on the device. The private record is never published. Hashing the answer would not help: a 5-letter answer from 5 letters has only 3,125 possible spellings.

---

## 7. Screen layout and sizing

### 7.1 Daily puzzle screen (top to bottom)

1. **Header:** back, title "Word Path #12", streak count with flame icon, stats button, how-to-play button.
2. **Clue card:** label "Clue" and the clue text. The answer length is not written out.
3. **Answer boxes:** one empty box per letter, filling as the player taps.
4. **Grid.**
5. **Result line:** appears only after a finished attempt ("Solved", or "MANGA is not today's answer").
6. **Buttons:** Hint (shows remaining count), Clear, Give up.

### 7.2 Size selection

- Measured once, when the puzzle starts, from the width of the board's container.
- N = the largest size from 6 to 10 that fits with tap targets of at least 44px. Tile size = min(48px, container width ÷ N).
- **Size lock:** the size stays fixed for the whole attempt and is saved with the in-progress state. If the window shrinks or the phone rotates, the board scales down to fit rather than changing size.

### 7.3 Visual design

| Element | Value |
| --- | --- |
| Tile | Circle at 87% of the tile's tap area |
| Tile colors | Checkerboard of brown `#7A4A2B` and maroon `#7A1F2E` |
| Letters | Cream `#FFF3E3`, about 39% of tile size, medium weight |
| Selected tile | Orange `#F28C28` with dark brown text `#2B1400`, plus a 2px outline so selection does not rely on color |
| Route line | Orange, drawn between selected tile centers |
| Solved | Route tiles and line turn green, with a check icon on the answer boxes |
| Hint | Orange ring around the suggested tile |
| Light and dark mode | Tile colors stay the same; page background, text, and buttons follow the theme |

### 7.4 How to play

Shown automatically on a player's first visit, and from the header button. Three short steps with an animated example on a tiny 4×4 grid.

---

## 8. Input and accessibility

- **Pointer:** tap or click. Every action is a single tap. No press-and-hold, dragging, or timed gestures.
- **Keyboard:**
  - Arrow keys move focus between cells.
  - Enter or Space selects the focused cell, exactly like a tap.
  - Escape clears the route.
  - Tab reaches every button.
- **Screen readers:** each cell is labelled with its letter and position (for example "M, row 2, column 3"), and whether it is selected. The current route, results, and hints are announced through a live region.
- **Motion:** with reduced motion enabled, the wrong-word clear and solve celebration become simple fades.
- **Color:** selection, hints, and solved state all have a non-color signal (outline, ring, icon).
- **Audit:** an automated accessibility check runs in CI, and a manual keyboard-only playthrough is done before release.

---

## 9. Daily lifecycle, results, and stats

### 9.1 Lifecycle

| Area | Rule |
| --- | --- |
| Reset | New puzzle at the player's local midnight. Puzzle number = days since launch, by local date. |
| Crossing midnight | A puzzle stays tied to the date it was started and counts for that day. |
| Refresh recovery | In-progress state (route, wrong attempts, hints used, elapsed time, size) is saved after every action, keyed by puzzle ID, and restored on reload. Reloading never resets counters. |
| Hidden tab | The timer counts only while the page is visible. |
| Finished puzzles | Reopening a finished daily shows its result screen, not a replay. |
| Clock changes | The date comes from the device clock. Acceptable while scores are local only. |

### 9.2 Give up

- Ends the puzzle unsolved, reveals the answer and draws its route.
- Breaks the streak.
- Counts as played, not solved, in stats.

### 9.3 Result screen

- Answer, clue, time, wrong attempts, hints used.
- Countdown to the next puzzle.
- Share button.
- No combined score at launch. The three numbers are shown separately, so no formula has to be invented before there is data to tune it.

### 9.4 Share text

Stats only, with no grid picture or route shape, so it cannot spoil the puzzle for others on the same size:

```
Tiny Trouble · Word Path #12
Solved in 0:41 · 1 wrong · 0 hints · 8×8
<site link>
```

Uses the device's native share sheet where available, otherwise copies to the clipboard.

### 9.5 Stats (stored on the device)

Played, solved, solve rate, current streak, best streak, average solve time, average hints, and a solve-time distribution chart.

### 9.6 Streaks

- A day counts if that date's daily is solved (hints allowed).
- Missing a day or giving up resets the current streak to 0.
- No streak freezes at launch.

### 9.7 Practice mode

- Unlimited puzzles from a separate practice pool, never from upcoming dailies.
- No effect on streaks or daily stats. Has its own simple stats.
- Replaces the prototype's "New grid" button.

---

## 10. Repository layout

```
tiny-trouble-games/
  packages/
    engine/              rules, route counting, shared by everything
      src/wordpath/v1/   frozen once released
  tools/
    generator/           daily and practice puzzle generation (Node)
    wordlists/           list import, filtering, blocked-list builder
  content/
    wordlists/           word list files plus README with sources, licenses, versions
    wordpath/
      answers.csv        answer, clue, clue source, scheduled date, status
  data/
    public/              generated public puzzle files (deployed)
    private/             generated private records (never deployed)
  apps/
    web/                 Vite, React 19, TypeScript site
  .github/workflows/     CI
```

**\[Decision\]** Whether `data/private/` lives in this public repository. Recommendation: keep private records out of the public repo (for example in a private repository or a CI secret store), because anyone can read a public repo, including future answers.

---

## 11. Tests

### 11.1 Engine (unit and property tests)

- Rule tests for every case in section 2 (each tap behavior, hint behavior, checking).
- Route counter tests on tiny hand-made grids whose routes can be listed by hand.
- Property tests on generated grids, across many seeds:
  - exactly one route spells any word in T, and it spells the answer;
  - no blocked word is traceable;
  - letter balance and not-a-straight-line checks pass;
  - the same seed always gives the same grid.
- Answer eligibility tests, including palindromes being rejected.

### 11.2 Content checks in CI

- Every scheduled puzzle is re-verified from its private record.
- Every scheduled answer passes eligibility and has a reviewed clue with a source.
- At least 30 days of puzzles are always scheduled ahead.

### 11.3 Website (end-to-end)

- Full solve by tapping and by keyboard.
- Wrong attempt, hint (both cases), clear, give up.
- Reload mid-puzzle restores state exactly.
- Midnight rollover with a fake clock.
- Hidden-tab timer pause.
- Size lock when the window is resized mid-puzzle.
- Share text format.
- Automated accessibility scan.

### 11.4 Generator benchmark

- Time per puzzle at each size, run against the full blocking list, on at least 100 real answers. Record failures and their causes.

---

## 12. Milestones

One at a time. Each has an exit criterion.

| # | Milestone | Tags | Done when |
| --- | --- | --- | --- |
| 1 | Engine: rules and route counter | Code, Verification | All section 11.1 rule and counter tests pass |
| 2 | Word lists and blocked-list builder | Data | Licenses recorded; blocked lists built for 20 sample answers |
| 3 | Generator with quality checks | Code, Verification | Property tests pass on 1,000 seeds |
| 4 | Generator benchmark | Verification | Section 11.4 run on 100 answers; failure rate and timing recorded |
| 5 | Content: first 60 puzzles | Data, Decision | 60 answers with reviewed, sourced clues |
| 6 | Website: daily screen, input, accessibility | Code | Section 11.3 tests for solving, hints, give up, keyboard pass |
| 7 | Website: lifecycle, results, stats, share, practice | Code | Remaining section 11.3 tests pass |
| 8 | Playtest | Experiment | 5 people play 5 puzzles each; notes recorded; clue and difficulty fixes made |
| 9 | Launch | Release | Live; 20 or more real players over two weeks |

---

## 13. Decisions to sign off

| # | Decision | Recommendation |
| --- | --- | --- |
| W1 | Five sizes per daily (6×6 to 10×10), chosen by container width, locked per attempt | Yes |
| W2 | Answer boxes stay visible (they reveal the length) | Yes, revisit after playtest |
| W3 | Scores and stats local only at launch; no leaderboards | Yes |
| W4 | Daily reset at local midnight; timer pauses on a hidden tab | Yes |
| W5 | Answers: 5 to 7 letters, at least 4 distinct letters, no palindromes, no proper nouns | Yes |
| W6 | Two word lists: common answer list, broad blocking list | Yes |
| W7 | Letter balance rule and not-a-straight-line rule | Yes |
| W8 | Give up is available, breaks the streak | Yes |
| W9 | Hints: 3 per puzzle; using hints does not break the streak | Yes |
| W10 | No combined score at launch; show time, wrong attempts, hints | Yes |
| W11 | Share text is stats only, no route picture | Yes |
| W12 | Practice mode from a separate pool, included at launch | Yes |
| W13 | Private records kept out of the public repository | Yes |
| W14 | 60 puzzles written before launch | Yes |

---

## 14. Verification log

| Check | Method | Result |
| --- | --- | --- |
| Palindrome exclusion | Reasoning: a route spelling a palindrome, read backwards, is a different route spelling the same word | Every palindrome grid has at least two answer routes, so palindromes can never be valid answers. |
| Blocking all same-length words (smoke test) | Generator run 30 times each at 6×6, 8×8, 10×10 for MANGO, blocking a hand-picked set (AMONG, MANGA, MANNA, GAMMA, MAMMA) | All 180 runs succeeded in about 0.01 seconds each. Not a full-dictionary test (see milestone 4). |
| Letter balance and not-a-straight-line rules (smoke test) | 40 generated MANGO grids each at 6×6, 8×8, 10×10, same blocked set, checked against section 5.3 before any retry | Letter balance already passed in 33/40, 37/40, and 40/40 grids. Straight routes appeared in 2/40, 2/40, and 1/40. Both rules are cheap to enforce by retrying. |