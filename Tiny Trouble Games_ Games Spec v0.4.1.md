# Tiny Trouble Games: Games Spec v0.4.1

Repository: [SunnyYadav16/tiny-trouble-games](https://github.com/SunnyYadav16/tiny-trouble-games)

Prepared October 9, 2026. Covers the first five games: Word Path, Preview Shuffle, Mirror Collapse, Echo Lights, Zigzag Maze.

**Status:** draft for review. Items marked **\[Decision\]** in section 8 need your sign-off before implementation.

**Changelog**

- **v0.4.1:** Project named Tiny Trouble Games, with repository `tiny-trouble-games` (D19 decided; section 10 updated). No rule changes.
- **v0.4:** Incorporates the v0.3 validation review. All seven corrections accepted:
  - Word Path's one-answer guarantee is now stated relative to a versioned word list (sections 2.1, 2.3).
  - Input rules now require keyboard support and drop tap-and-hold (sections 1, 4.5).
  - New daily lifecycle contract: reset time, refresh recovery, hidden-tab timer policy (section 1.2).
  - Mirror Collapse mask wording clarified for asymmetric starting holes (section 4.7).
  - Generator benchmarks added to milestones (section 7).
  - Rules versioning strengthened with version-specific implementations and archive replay tests (section 1.3).
  - The 180 Word Path trials relabelled as a smoke test (section 9).
  - Also recorded: the reviewer's independent reproduction of the Echo Lights table (section 9), and naming checks (section 10).
- **v0.3:** Word Path now guarantees exactly one answer per puzzle. Every word of the answer's length that can be spelled from the answer's letters is blocked, anagrams included. Decoy words and the editor's blocking review are removed (sections 2.1, 2.3, 2.5, 7, 8, 9).
- **v0.2:** Incorporates the external review (issues A to D and eight gameplay issues) and two independent checks.
  - Echo Lights no longer requires a unique solution. An exhaustive count of all 65,535 starting boards confirmed the review and showed that no board needing 4 or more presses has a unique shortest solution (section 5.6).
  - Puzzle data is split into public and private files, so solutions are not shipped to browsers (section 1).
  - Word Path's rival-word check now covers every word spelled from the answer's letters, not only anagrams, followed by a human clue review (section 2.3).
  - Mirror Collapse uses an 18-bit mask instead of 36 bits, which avoids JavaScript's 32-bit limit without BigInt. It also gets a danger marker on cells that would trap the player, and better difficulty measures (section 4).
  - Zigzag Maze difficulty tiers are redefined so the Medium budget actually allows other routes (section 6.4).
  - Word Path hints and screen-size locking are defined. Preview Shuffle's Relaxed mode becomes unranked, and a smaller practice board is added.
  - New sampling of Mirror Collapse boards shows unique-route puzzles are rare but can be generated (section 4.7).
- **v0.1:** First formal spec.

---

## 1. Shared foundations

| Area | Rule |
| --- | --- |
| Rules engine | One TypeScript package holds each game's rules and simulation. The generator, solver, website, and any server-side checker import the same code. This greatly reduces the risk of the rules drifting apart, but does not remove it on its own (see section 1.3). |
| Puzzle generation | Offline only. Players' browsers never generate puzzles. |
| Rules versioning | `rulesVersion` is stored per puzzle. See section 1.3. |
| Daily puzzle | One per game per day, identical for everyone in the same size bucket. |
| Input | Tap or click is the primary input, and every action is a single tap. Every action also works from the keyboard: arrow keys move focus between cells, Enter or Space activates the focused cell exactly like a tap, and Tab reaches every button. No action requires press-and-hold, dragging, or a timed gesture. This follows WCAG 2.2's requirement that functionality be keyboard-operable. |
| Screen readers | Every cell has a label (for example "M, row 2, column 3"). Results and state changes are announced through a live region. |
| Motion | Respect `prefers-reduced-motion`: replace slides with short fades plus a static indicator of what moved. |
| Color | Never use color alone to carry meaning. Pair it with a shape, icon, outline, or label. |
| Restart | Always available. Counted where the game's score uses it. |

### 1.1 Public and private puzzle data

| Public file (sent to every browser) | Private record (generator, CI, and checker only) |
| --- | --- |
| Puzzle ID, game, `rulesVersion` | Answer or solution |
| Board data | Verified routes or sequences |
| Clue or goal | Solution count |
| Difficulty tier | Solver metrics |
| Date and size bucket | Generation seed and metadata |

**Launch (no leaderboards):** each game checks the player's result in the browser and keeps scores on the device only. To check answers locally, the browser must hold enough logic or data to work out the answer. That is acceptable while scores stay personal.

**Leaderboards (later):** a server-side checker re-runs the shared rules engine against the private record before accepting a score. Explicit solutions are never sent to the browser.

**Hashing does not hide the answer.** A Word Path answer is a short string over a tiny alphabet: 5 letters from 5 symbols is only 3,125 combinations. Any hash of it can be cracked instantly. Do not rely on hashing for leaderboard integrity.

**Script-assisted solving** cannot be fully prevented even with a server checker. Plausibility checks on solve time remain the main defense.

**Suggested stack:** Vite, React 19, TypeScript, oxlint, fast-check for property-based engine tests, Cloudflare Pages for the site and public puzzle files. The private records live outside the public bucket.

### 1.2 Daily lifecycle

| Area | Rule |
| --- | --- |
| Reset time | A new daily puzzle starts at midnight in the player's local time zone. The puzzle number is the count of days since launch, using the player's local date. |
| Crossing midnight | A puzzle stays tied to the date it was started. A player who is mid-game at midnight finishes that puzzle, and it counts for the day it was started. |
| Streaks | A streak is the number of consecutive local dates with a solved daily puzzle. |
| Clock changes | The date comes from the device clock, so a player can change it to play early. This is acceptable while scores are local only (section 1.1). Leaderboards will need server time. |
| Refresh recovery | After every action, the in-progress state (moves so far, misses or restarts, elapsed time, whether the preview has been shown) is saved in the browser, keyed by game and puzzle ID. Reloading restores it. Reloading never resets the counters. |
| Preview Shuffle preview | Shown once per puzzle. Reloading after the preview does not show it again. |
| Hidden tab | The timer counts only while the page is visible, using the browser's page-visibility events. It pauses when the tab is hidden and resumes on return. If the tab is hidden during the Preview Shuffle preview, the preview ends immediately. |
| Finished puzzles | Reopening a solved daily shows its result, not a replay. Unlimited replays live in practice mode. |

### 1.3 Rules versioning

- Every rule set has a version, for example `wordpath/v1`. Once a version is released, its code is never edited. A rule change creates a new version alongside it.
- Each puzzle records the version it was generated under and is always played and checked with that version.
- A CI job replays a sample of archived puzzles, with their stored solutions, against their recorded versions. It fails if any result changes.

---

## 2. Word Path (game 1)

### 2.1 Rules

1. The grid is full. Every cell holds a letter from the answer's distinct letters.
2. The player taps tiles one at a time. Each tap must touch the previous tile up, down, left, or right. No diagonals, no reuse.
3. Tapping the last selected tile removes it. Tapping an earlier selected tile cuts the route back to it. Tapping a tile that does not touch the last one starts a new route there.
4. When the route reaches the answer's length, it is checked. A correct route wins. A wrong one shows the spelled word briefly and clears.
5. **Exactly one answer:** exactly one route spells the answer, and no route spells any other word of the same length in the puzzle's versioned word list (section 2.3).

### 2.2 Hints and screen size

- **Hints:** up to 3 per puzzle. If the current route is not the start of the solution, the hint first clears it, then highlights the next tile of the verified solution. If it is a correct start, the hint highlights the next tile without clearing.
- **Size lock:** the size bucket (6×6 to 10×10) is chosen when the puzzle starts and stays fixed for that attempt. If the window shrinks or the phone rotates mid-game, the board scales down to fit instead of regenerating.
- Leaderboards (later) are kept per size bucket.

### 2.3 Rival words: one answer only

Every puzzle has exactly one answer. A player can never trace a different word of the same length from the puzzle's word list, so no puzzle can have a second valid answer.

**What the guarantee covers:** uniqueness is guaranteed relative to the specified word list, and that list's version (`wordListVersion`) is recorded in every puzzle's private record. No finite list contains every real word, so a very rare word outside the list could still be traceable. Choose a broad list to keep that risk small.

Anagram checking alone is not enough, because a word can use only the answer's letters without being an anagram. Examples: ANION from PIANO's letters, and MANGA, MANNA, or GAMMA from MANGO's letters. So the blocked list covers all of them:

- **Blocked rivals:** every word in the licensed word list that has the answer's length and uses only the answer's letters. This includes every anagram (such as AMONG for MANGO) and every other same-length word (such as MANGA).
- **No decoys:** no other real word of that length can be spelled anywhere in the grid.
- **Other lengths do not matter:** a route is only checked when it reaches the answer's length, so shorter or longer words are never accepted as answers.

Process for each answer:

1. **\[Data\]** Filter the licensed, versioned word list by length and alphabet. The result, minus the answer itself, is the blocked list. This is fully automatic.
2. **\[Verification\]** The generator rejects any grid where a blocked word can be traced. CI re-checks every scheduled puzzle.
3. **\[Decision\]** An editor still reviews each clue, but only for quality: the clue must point clearly to the answer. Blocking no longer depends on the editor.

A larger word list blocks more obscure words. That is harmless for gameplay. The smoke test in section 9 found no noticeable generation cost for MANGO's extra words, but generation speed must be re-measured against the full word list (section 7).

### 2.4 Score

Time, wrong attempts, and hints used.

### 2.5 Solver

The existing route counter (depth-first search with prefix pruning), run against the answer plus every blocked rival. A grid is accepted only when exactly one route spells any of these words, and that route spells the answer.

---

## 3. Preview Shuffle (game 2)

A memory match game where the face-down cards move after every mistake.

### 3.1 Boards

- **Standard:** 8 pairs, 16 cards, in a 4×4 grid.
- **Practice:** 6 pairs, 12 cards, in a 3×4 grid (3 rows, 4 columns). Offered to first-time players before their first daily puzzle.
- Card faces are distinct symbols, each with its own shape and color.
- The daily layout is seeded, so everyone gets the same arrangement.

### 3.2 Preview

- **Standard mode:** all faces are shown for a fixed time with a countdown bar, then flip face down. The proposed time is 3.0 seconds, to be settled by the experiment in section 7.
- **Relaxed mode (accessibility):** faces stay visible until the player taps "I'm ready." Relaxed results are **unranked**. They appear in personal stats only, because unlimited study time would not compete fairly with a timed preview.

### 3.3 A turn

1. The player taps a face-down card, then a second one.
2. **Match:** both cards are removed. Their slots show a faint outline. No rotation happens.
3. **Miss:** both cards stay face up for 1.0 second, flip face down, and then the rotation runs. Input is locked until it finishes.

### 3.4 Rotation (exact definition)

Each board is split into rings, read clockwise. Coordinates are (row, column), starting at the top left.

**Standard 4×4 board**

- Outer ring (12 slots): (0,0) (0,1) (0,2) (0,3) (1,3) (2,3) (3,3) (3,2) (3,1) (3,0) (2,0) (1,0)
- Inner ring (4 slots): (1,1) (1,2) (2,2) (2,1)

**Practice 3×4 board**

- Outer ring (10 slots): (0,0) (0,1) (0,2) (0,3) (1,3) (2,3) (2,2) (2,1) (2,0) (1,0)
- Inner ring (2 slots): (1,1) (1,2). With two cards, one clockwise step swaps them.

After a miss, for each ring separately:

1. List the slots in that ring that still hold a card, in clockwise order: p0, p1, ..., pk-1.
2. Every card moves from pi to p(i+1) mod k. Empty slots are skipped, so every remaining card moves exactly one occupied position forward.
3. If a ring has 0 or 1 cards left, it does not move.

Cards never move between rings. The two cards just missed rotate along with the others.

### 3.5 Animation

- Each card slides clockwise along its ring's path to its new slot (passing over empty slots), in 450ms. All cards move at once.
- Reduced motion: a 200ms fade to the new positions, plus a brief clockwise arrow on each ring.

### 3.6 Winning and scoring

- Win when all pairs are removed.
- Primary score: misses (fewer is better). Tie-break: time.

### 3.7 Verification

No solver needed. Property tests on the rotation function, for both board shapes:

- It never adds, removes, or duplicates a card.
- It is deterministic.
- k applications on a ring with k cards return it to the start.

### 3.8 Known limitation

A screenshot during the preview beats the game. Memory scores are effectively honor-system.

---

## 4. Mirror Collapse (game 3)

A path puzzle where every square you leave collapses, along with its mirror image across the board's center.

### 4.1 Board

- 6×6 grid. The size must be even (see 4.4).
- Cell types: floor, hole (already collapsed), start, exit, gem. Puzzles use 3 gems and some holes.
- **Mirror** means point reflection through the center: cell (r, c) mirrors to (5 − r, 5 − c). Numbering cells 0 to 35 in reading order, the mirror of cell i is cell 35 − i.

### 4.2 Moving

1. The player starts on the start cell.
2. Tap an orthogonally adjacent cell that is still standing to move there.
3. When you leave cell X, both X and mirror(X) collapse. If mirror(X) is already collapsed, nothing extra happens.
4. Entering a gem collects it.
5. The exit is locked until all gems are collected.

### 4.3 Illegal moves and failing

- A move is illegal if it would collapse an uncollected gem or the exit.
- The square that collapses depends only on the cell you are leaving, not your direction. So if mirror(current cell) is an uncollected gem or the exit, you cannot leave at all.
- If no legal move exists, the attempt fails and the player restarts. Restarts are counted.

### 4.4 Simultaneous collapse

On an even-sized board, no cell is ever orthogonally adjacent to its own mirror, so stepping into a square that collapses on the same move cannot happen. The rule is still recorded for future variants: **entering a square that collapses on the same move is forbidden.**

### 4.5 Previews and warnings

- **Current cell:** its mirror is always shown with a translucent cracked overlay. That square collapses on the next move, whichever direction is chosen.
- **Trap warning before entry:** any neighboring cell whose mirror is an uncollected gem or the exit gets a small danger marker. Entering it would leave the player unable to move. This is a one-step warning only. Longer-range traps are the planning challenge and are not marked.
- **Show mirrors toggle:** a button that, while switched on, makes tapping or focusing any cell highlight its mirror instead of moving there. Switching it off returns to normal play. It is reachable by keyboard like every other button.

### 4.6 Winning and scoring

- Win by entering the exit with all gems collected.
- Primary score: restarts. Tie-break: time.
- No move limit.

### 4.7 Solver

- **State:** player position plus an **18-bit mask**, one bit per mirror pair. The mask records only collapses that happen during play, and every one of those takes a cell and its mirror together. Holes placed at the start are tracked separately in a fixed lookup, and they need not be symmetric: a starting hole's mirror can still be standing. A cell is standing if it is not a starting hole and its pair bit is clear.
- **Why 18 bits:** JavaScript's bitwise operators work on 32-bit integers, so a 36-bit mask would silently lose information. The pair mask fits in 32 bits with room to spare, and needs no BigInt. If a future variant breaks the pairing, switch to BigInt or two 32-bit integers.
- **Gem collection is implied:** a gem cell collapses only after it is collected, because collapsing an uncollected gem is illegal.
- **Search:** depth-first search counting winning routes, memoized on (position, pair mask).
- **Acceptance by tier:** Hard requires exactly one winning route. Easy and Medium allow several, with a target range per tier to be set by playtests.

**Sampling result (v0.2 check).** 400 random 6×6 boards per hole count, with random start, exit, and 3 gems:

| Holes | Solvable | Exactly one route | Median routes (solvable boards) |
| --- | --- | --- | --- |
| 0 | 130 / 400 | 2 (0.5%) | 29 |
| 4 | 75 / 400 | 7 (1.8%) | 8 |
| 8 | 19 / 400 | 3 (0.8%) | 3 |

Unique-route boards are rare, about 1 in 55 to 1 in 200 random boards, but each check takes milliseconds, so offline generation is practical. Before release, review a sample of accepted unique boards to make sure they are not strange-looking.

**Difficulty metrics** (replacing "count of dead ends"):

- Decision points: steps on the solution where two or more legal moves exist.
- Misleading branches: legal moves off the solution that eventually lead to a trap.
- Failed-route depth: on average, how many moves a wrong route lasts before the player is trapped.
- All three are calibrated against playtest completion rates.

---

## 5. Echo Lights (game 4)

A Lights Out variant where each press is followed, one press later, by an echo that copies a value onto neighbors.

### 5.1 Board

- 4×4 grid of lights, each on or off.
- Goal: turn every light off in **exactly k presses**, where k is the verified minimum for that board (section 5.6). The puzzle states k.

### 5.2 What a press does

When the player presses cell P, these steps happen in order:

1. **Flip:** P toggles.
2. **Fire the pending echo**, if there is one from the previous press: every orthogonal neighbor of the previous press's cell is set to the value captured on that press. This can overwrite the flip from step 1 if P is one of those neighbors.
3. **Capture and schedule:** P's state right now is captured. An echo is scheduled to set P's orthogonal neighbors to that value on the next press.

The first press has no pending echo, so step 2 is skipped.

### 5.3 Rule details

- **Capture time:** at the moment of the press (step 3). The value is fixed and shown on the board.
- **Collisions:** only one echo is ever pending, so two echoes never collide within a single step. A flip and an echo on the same cell resolve flip first, echo second.
- **After the final press:** the final turn has two echo effects. First the previous press's echo fires (step 2, as on every press). Then, after a short pause, the final press's own echo fires automatically. The win check runs after both. The instructions and animation must show both effects separately, in that order.

### 5.4 Display

- Each neighbor with a pending echo shows a small dot in the color it will be set to.
- On the final press, step 2's echo animates, there is a short pause, then the final echo animates, then the result appears.

### 5.5 Winning and scoring

- Win if every light is off after the final echo.
- After k presses, if the board is not clear, the attempt fails and resets. Restarts are counted.
- Primary score: restarts. Tie-break: time.
- Any winning sequence of length k is accepted. There is no single "intended" solution.

### 5.6 Why uniqueness was dropped (verified)

The review's sampled counts were confirmed by an exhaustive count. Every 4×4 board was analysed under the rules in 5.2 and 5.3, counting every winning press sequence of each length:

| Minimum presses needed | Boards | Boards with exactly one shortest solution | Median number of shortest solutions |
| --- | --- | --- | --- |
| 1 | 120 | 96 | 1 |
| 2 | 3,385 | 256 | 2 |
| 3 | 24,364 | 160 | 12 |
| 4 | 33,917 | **0** | 114 |
| 5 | 3,730 | **0** | 1,286 |
| 6 | 19 | **0** | 18,522 |

Every board can be cleared within 6 presses. The one remaining pattern, the all-off board, needs no presses and is never used as a puzzle. In the intended 4 to 6 press range, no board has a unique shortest solution, so the v0.1 acceptance rule could never be satisfied there.

Uniqueness was the wrong measure anyway. For a board whose minimum is 4, the median 114 winning sequences out of 65,536 possible sequences means random pressing succeeds about 0.2% of the time.

### 5.7 Generator and acceptance

- A 4×4 board has only 65,536 possible starting patterns, and the whole table of minimum lengths and solution counts takes seconds to compute. **The generator is a lookup into this precomputed table**, not a search.
- **Acceptance:** k equals the board's verified minimum, so no shorter solution exists.
- **Tiers (starting point):** Easy, minimum 3. Medium, minimum 4. Hard, minimum 5. The 19 boards that need 6 presses are a possible special "Expert" set.
- **Difficulty metrics:**
  - Random success rate: winning sequences divided by 16^k.
  - Misleading first presses: first presses from which the board can no longer be won in the remaining k − 1 presses.
  - Playtest completion rates.

---

## 6. Zigzag Maze (game 5)

A maze where your turns must alternate left and right.

### 6.1 Board

- 8×8 cells with walls between some cells. The maze includes loops, so a player can circle around to change which turn comes next.
- Start cell with a fixed initial facing (shown as an arrow). Exit cell.

### 6.2 Moving

1. Tap an open neighboring cell to move there. The move is read relative to the player's facing: straight, left turn, or right turn.
2. **U-turns are never allowed.** The cell directly behind the player is never a legal move.
3. **Turns must alternate:** after a left turn the next turn must be right, and the reverse. Straight moves do not change this. The first turn may be either way.
4. Cells can be revisited. Looping around is how a player fixes a turn that is out of order.
5. **Move budget:** the exit must be reached within M moves. A move counter is shown.
6. Reaching the exit ends the puzzle immediately.

### 6.3 Display

- A "Next turn: Right" (or Left, or "Any") indicator is always visible.
- Illegal neighboring cells are dimmed.

### 6.4 Difficulty tiers (redefined)

In v0.1, Medium allowed 2 extra moves but still required exactly one route within the budget. That meant the only winning route was the same shortest route, so the extra moves helped no one. Tiers are now:

| Tier | Budget M | Routes allowed within M | Other levers |
| --- | --- | --- | --- |
| Easy | Shortest + 4 | Any number | Few misleading branches |
| Medium | Shortest + 2 | At least 2 | Limited detours |
| Hard | Shortest | Exactly 1 | More loops, complex turn planning |

Every tier verifies the puzzle can be solved within M and records the route count as a difficulty metric. Only Hard requires uniqueness.

### 6.5 Winning and scoring

- Win on reaching the exit within M moves.
- If the budget runs out, the attempt fails and resets. Restarts are counted.
- Primary score: restarts. Tie-break: time.

### 6.6 Solver

- **State:** cell, facing, last turn (left, right, or none), moves used.
- **Search:** count routes to the exit step by step up to M (dynamic programming over states per step).
- **Open check:** how often Hard mazes have exactly one route has not been measured yet (see section 7).

---

## 7. Build milestones

One task at a time. Each game ships before the next one starts.

### Word Path

1. \[Code\] Move the prototype's rules into the shared engine package.
2. \[Code\] Split puzzle output into public files and private records.
3. \[Data\] Choose and license-check a word list. Build the alphabet-and-length filter that produces each answer's blocked list.
4. \[Decision\] Editor review of each clue for quality.
5. \[Code\] Generator writes daily puzzles at all five sizes, blocking every same-length word, and records `wordListVersion`.
6. \[Verification\] Benchmark generation against the full word list at every size, across a sample of real answers.
7. \[Verification\] CI re-verifies every scheduled puzzle from the private records, and replays archived puzzles against their rules versions.
8. \[Code\] Shared daily lifecycle (section 1.2) and keyboard input (section 1), built once for all games.
9. \[Code\] Website: daily puzzle, size lock, hint rule, streak, stats, share card.
10. \[Release\] Launch. Exit criterion: 20 or more real players over two weeks.

### Preview Shuffle

1. \[Decision\] Sign off on section 8 items for this game.
2. \[Code\] Rotation function for both board shapes, with property tests.
3. \[Code\] UI with standard and Relaxed modes, practice board, and reduced-motion animation.
4. \[Experiment\] Playtest with five first-time players: practice board first, then standard previews of 2, 3, and 4 seconds. Pick the preview length with the best spread of misses.
5. \[Release\] Ship as game two.

### Mirror Collapse

1. \[Decision\] Prior-art search for collapsing-mirror path puzzles.
2. \[Code\] Rules engine and solver with (position, 18-bit pair mask) state.
3. \[Verification\] Check solver counts by hand on tiny boards where every route can be listed manually.
4. \[Code\] Generator with per-tier acceptance and the three difficulty metrics.
5. \[Verification\] Benchmark the TypeScript generator: time per accepted board for each tier.
6. \[Verification\] Visually review 20 accepted Hard boards for strange layouts.
7. \[Code\] UI with collapse preview, pre-entry danger markers, and the Show mirrors toggle.
8. \[Experiment\] Playtest accepted boards at each tier.
9. \[Release\] Ship.

### Echo Lights

1. \[Decision\] Prior-art search for delayed or copying Lights Out variants.
2. \[Code\] Rules engine implementing the three-step press order exactly as in 5.2, plus the final-echo rule in 5.3.
3. \[Verification\] Golden tests: hand-worked sequences with known final boards. Reproduce the section 5.6 table in CI as a regression test.
4. \[Code\] Precompute the full 65,536-board table. Generator selects by tier.
5. \[Code\] UI with pending-echo dots and the two-step final animation.
6. \[Experiment\] Playtest whether multiple winning sequences make the game feel too easy at each tier.
7. \[Release\] Ship.

### Zigzag Maze

1. \[Decision\] Prior-art search for alternating-turn mazes.
2. \[Code\] Maze generator with loops.
3. \[Code\] Solver counting all routes within budget M.
4. \[Verification\] Measure how often Hard mazes have exactly one route, before relying on the Hard tier.
5. \[Code\] UI with next-turn indicator and move counter.
6. \[Release\] Ship.

---

## 8. Decisions needing your sign-off

| # | Game | Decision | Recommendation | Changed in v0.2 |
| --- | --- | --- | --- | --- |
| D1 | Word Path | Size bucket chosen per screen width, separate leaderboards per size, locked at puzzle start | Yes | Size lock added |
| D2 | Word Path | Keep the empty answer boxes, which reveal the answer's length | Keep for now; revisit after playtests |  |
| D3 | Word Path | Exactly one answer: block every same-length word spelled from the answer's letters, anagrams included; no decoys | **Approved** | Changed in v0.3 (was anagrams plus editor-marked words) |
| D4 | Preview Shuffle | Matched cards are removed (rather than staying face up) | Removed |  |
| D5 | Preview Shuffle | Separate rings rotate independently | Yes |  |
| D6 | Preview Shuffle | Relaxed mode is unranked, personal stats only | Yes | Changed (was a separate leaderboard) |
| D7 | Preview Shuffle | Practice board of 6 pairs for first-time players | Yes | New |
| D8 | Mirror Collapse | Moves that would collapse a gem or the exit are illegal | Illegal, with warnings |  |
| D9 | Mirror Collapse | Point mirror through the center | Yes |  |
| D10 | Mirror Collapse | One-step danger markers before entry | Yes | New |
| D11 | Echo Lights | k equals the verified minimum; any winning sequence of length k is accepted | Yes | Changed (was exactly one sequence) |
| D12 | Echo Lights | Echo value captured at press time | Yes |  |
| D13 | Zigzag Maze | Cells can be revisited | Yes |  |
| D14 | Zigzag Maze | Tiers as in 6.4 (only Hard requires a unique route) | Yes | Changed |
| D15 | All | Local scoring at launch; server-side checking only once leaderboards exist | Yes |  |
| D16 | All | Daily reset at the player's local midnight | Yes | New in v0.4 |
| D17 | All | Timer pauses while the tab is hidden | Yes | New in v0.4 |
| D18 | Mirror Collapse | Show mirrors toggle replaces tap-and-hold | Yes | New in v0.4 |
| D19 | All | Project name: Tiny Trouble Games, repository `SunnyYadav16/tiny-trouble-games` | **Decided** | Decided in v0.4.1 |

---

## 9. Verification log

| Check | Method | Result |
| --- | --- | --- |
| Echo Lights uniqueness | Exhaustive dynamic-programming count over every 4×4 board and pending-echo state, under the rules in 5.2 and 5.3, for 1 to 7 presses | Table in 5.6. No unique shortest solutions at 4 or more presses. Every board solvable within 6. Also reproduced the review's sampled pattern: of 2,000 random boards at 3 presses, 6 had exactly one solution (the review found 3). |
| Mirror Collapse uniqueness | Memoized depth-first search on 1,200 random 6×6 boards (400 each at 0, 4, and 8 holes), under the rules in 4.2 and 4.3 | Table in 4.7. Unique-route boards exist at about 0.5% to 1.8% of random boards. |
| Word Path rival words | Reasoning check only; no dictionary was available in the test environment | Confirmed the review's point with further examples (MANGA, MANNA, GAMMA from MANGO's letters). Needs a real dictionary run per answer. |
| Word Path generation with all same-length words blocked (v0.3) — **smoke test only** | Ran the generator 30 times each on 6×6, 8×8, and 10×10 boards, blocking a hand-picked set (AMONG, MANGA, MANNA, GAMMA, MAMMA) alongside MANGO, compared against blocking AMONG only | All 180 runs produced a valid grid in about 0.01 seconds or less. This uses one answer and a hand-picked rival set, so it is not a full-dictionary validation (see section 7). |
| Echo Lights table, independent reproduction (v0.4) | External reviewer's separate C++ dynamic-programming implementation of the same rules | All six rows matched: board counts, unique-shortest counts, and median solution counts. |

Both checks were one-off Python scripts. Rebuild them as tests in the TypeScript engine so the results are reproduced from the real rules code.

---

## 10. Naming notes

**Decided:** Tiny Trouble Games. Repository: `SunnyYadav16/tiny-trouble-games` (public; at the time of writing it holds only a README and a .gitignore).

Checks on the chosen name (web search, October 9, 2026):

| Finding | Risk |
| --- | --- |
| Two small itch.io projects use similar names: "Tiny Troubles," a Windows adventure prototype, and "Touhou Tiny Trouble," a 2022 platformer. | Low. Small hobby projects in different genres. |
| "Trouble" is Hasbro's registered trademark for its Pop-O-Matic board game. | Worth checking. A name containing "Trouble" for games could draw attention from the mark's owner. Run a USPTO search on "Tiny Trouble" in the games classes before buying a domain or launching publicly. |

Still to do before public launch:

- \[Decision\] USPTO trademark search for "Tiny Trouble."
- \[Decision\] Domain check with a registrar.

Earlier candidates, for the record: One Bad Rule (no exact-match game found; close to the publisher Bad Rule Games), Unbore Me (an existing GitHub event-finder project of that name; an Amazon app reported by the reviewer could not be confirmed).