# Tiny Trouble Games

Five puzzle games, built one at a time. Each has a daily puzzle; Word Path also has unlimited play.

- Word Path rules: [Word Path Spec v1.0-rc1](docs/superpowers/plans/Tiny%20Trouble%20Games_%20Word%20Path%20Spec%20v1.0-rc1.md). Source of truth for *what*, except where the plan's Decisions table departs from it.
- Word Path plan: [docs/superpowers/plans/2026-10-18-word-path-v1.md](docs/superpowers/plans/2026-10-18-word-path-v1.md). Source of truth for *how*. Its Decisions table records every spec change the user approved.
- Other games: [Games Spec v0.4.1](Tiny%20Trouble%20Games_%20Games%20Spec%20v0.4.1.md). Its §2 (Word Path) is superseded by the Word Path spec.
- Never copy game rules into this file.

## Current phase

**Word Path**, rebuilt from scratch (the first build was deleted on 2026-10-18). Plan approved on 2026-10-18 (preview screens, 3D pavers, petal shower, difficulty levels); no code yet. Coding starts only when the user says so.

One game at a time. Do not start, scaffold, or stub the next game until the current one has shipped. Update this section when a phase ends.

| # | Game | Status |
| --- | --- | --- |
| 1 | Word Path | planned |
| 2 | Preview Shuffle | — |
| 3 | Mirror Collapse | — |
| 4 | Echo Lights | — |
| 5 | Zigzag Maze | — |

## Stack

pnpm workspace · Node ≥22 · TypeScript strict · Vite · React 19 · Vitest + jsdom + Testing Library · fast-check · oxlint · tsx · Playwright + axe · GSAP + `@gsap/react` (apps/web only) · `@anthropic-ai/sdk` (tools/content only) · GitHub Actions · Cloudflare Pages.

## Commands

Each command exists once the plan task that adds it has landed.

```sh
pnpm install
pnpm test              # vitest run, all packages
pnpm lint              # oxlint
pnpm typecheck         # tsc, every package
pnpm dev               # web app
pnpm build             # production web build (apps/web/dist)
pnpm e2e               # Playwright + axe, desktop and phone projects
pnpm wordlists build   # rebuild content/wordlists from upstream sources
pnpm content refill    # AI fills missing dailies and grows the unlimited pool; needs ANTHROPIC_API_KEY
pnpm verify            # re-check every public puzzle, word list hashes, and the schedule
pnpm bench             # generator timing per size
```

Run `pnpm lint && pnpm typecheck && pnpm test` before saying anything is done.

## Layout

```
packages/engine/          pure rules, route finder, generator, schemas. No DOM, no React, no runtime deps.
  src/shared/             seeded rng, grid helpers
  src/wordpath/v1/        rules, routes, words, quality, generate, check, puzzle. Frozen once released.
tools/wordlists/          builds the answer list and blocking list
tools/generator/          puzzle store, candidate gates, verify and bench CLIs
tools/content/            AI pipeline: proposer, reviewer, source fetch, refill CLI
content/wordlists/        committed lists, README (sources, licenses, hashes), VERSION
data/public/wordpath/     committed and deployed: <date>.json dailies, unlimited/<level>/<n>.json + index.json
apps/web/                 React UI
  src/shared/             dates, safe storage, visibility timer, live region
  src/games/wordpath/
  e2e/                    Playwright specs
.github/workflows/        ci.yml; refill.yml (daily AI refill, pushes to main)
PRODUCT.md, DESIGN.md     impeccable product context and design system (DESIGN.md is written from the built UI)
```

## Hard rules

### Engine
- Rules are pure functions: `(state, action) => state`. UI never decides legality itself; it asks the engine.
- Generator, verifier, AI pipeline, and UI import the same engine code. Never re-implement a rule elsewhere.
- Released `vN/` folders are never edited. Rule change = new `vN+1/` folder; loaders dispatch on `rulesVersion` and refuse unknown versions.
- Every puzzle stores `rulesVersion` (e.g. `wordpath/v1`) and is played and checked with that version only.
- Puzzle generation is offline only. Browsers never generate puzzles and never call AI.
- All randomness in engine and tools goes through the seeded rng, never `Math.random`.
- Difficulty comes from the generator's level rules (route shape, near misses) and the clue style. Never from tile colors or other visual cues.
- Mirror Collapse mask stays within 32 bits (18-bit pair mask). No BigInt unless pairing breaks.

### Data
- There are no private records. Public puzzle files have no answer field, but the answer can be recovered from `checks` plus the grid. That is obfuscation for local checking, not security, and it is accepted while scores stay on the device. Hashing does not hide answers either. When leaderboards land, move checking to a server with its own private data.
- Every puzzle file records `meta.clueSource`, `meta.wordListVersion`, and `meta.generatorVersion`.
- Never edit a puzzle file by hand. To replace a bad puzzle, delete its file and run `pnpm content refill`; refill never overwrites an existing file.
- An answer is never reused, across dailies and unlimited.
- Player stats and progress live only in this browser's `localStorage`; no accounts or sync. Every storage read and write goes through `apps/web/src/shared/storage.ts`, so sync can be added later in one place.
- Word lists live in `content/wordlists/`. Any edit needs a new label in `VERSION`; then run `pnpm verify` and regenerate puzzles whose `wordListVersion` no longer matches.

### AI content
- Only `tools/content` calls AI or depends on `@anthropic-ai/sdk`.
- `ANTHROPIC_API_KEY` comes from the environment only. Never write it to a file, a log, or a commit.
- Proposer and reviewer are different models. Nothing is published unless every stage passes: deterministic gates; the source page is fetched and contains the answer; the reviewer finds the clue supported and not offensive; the reviewer solves the clue blind with the answer as its first guess; the built puzzle verifies and replays at every size.
- Tests never call a real model or the network. AI sits behind the `Llm` interface with a fake.
- Read the `claude-api` skill for current model IDs and tool names before changing `anthropic.ts`.

### Accessibility (every game)
- Every action is a single tap/click and works from the keyboard: arrows move focus, Enter/Space activate, Escape clears, Tab reaches every button.
- No press-and-hold, drag, or timed gesture.
- Every cell has an aria label ("M, row 2, column 3"). State changes announced via live region.
- Honour `prefers-reduced-motion`: fades + static indicator instead of slides.
- Never use color alone. Pair with shape, icon, outline, or label.
- axe runs in `pnpm e2e`, in light and dark mode, on desktop and phone.

### Desktop and mobile
- A desktop browser is the primary target; phones must still work.
- Detect the device with media queries (`(pointer: fine) and (hover: hover)`) and measured sizes. Never use the user-agent string.
- Touch keeps the spec's board: 6×6 to 10×10, tiles 44–48px. Mouse devices get a 15×15 board with tiles 36–48px, falling back to the largest of 6×6–10×10 only when the window is too small. Board size is locked for an attempt; only the tile scales after that.

### Frontend design
- Before any UI edit, load `/impeccable` and follow the direction contract in its surface brief. Use `/emil-design-eng` for motion and component details and `/design-taste-frontend-v1` for its bans and pre-flight check.
- The project stack wins over a skill's default stack: plain CSS with tokens, inline SVG icons, self-hosted fonts (at most two families). No Tailwind, Framer Motion, icon library, or font CDN.
- GSAP is the only animation library. Use `useGSAP` with a `scope` ref and `contextSafe` for event-time tweens (`/gsap-skills:gsap-react`). Animate only `transform` and `opacity`. Simple state changes use CSS transitions.
- Motion never gates the game: engine timers decide state, the next tap interrupts any animation, and reduced motion gets short fades. Demos play once and replay on request.
- No emoji anywhere.
- Tiles are 3D clay pavers drawn in CSS (domed face plus an offset side wall), not images or WebGL. The petal burst on a solve is decorative: `aria-hidden`, never blocks input (a click or key skips it), absent under reduced motion.
- No mascot in v1. The hedgehog is parked in the plan's Later developments (L1); do not build or stub it until the user picks it up.
- The §7.3 tile palette is pinned; changing it needs user sign-off.

### Play modes and lifecycle (shared, built once in Word Path)
- Daily: one puzzle per date, new at the player's local midnight, tied to the date it started. Streaks come from daily results only.
- Unlimited: puzzle after puzzle with no daily limit. Own saved progress and stats; never touches daily results or streaks; no repeats until every puzzle has been seen.
- Levels: Easy, Normal, Hard. Dailies are always Normal. Unlimited has a level switch; each level has its own pool, saved puzzle, and no-repeat cycle.
- Save in-progress state after every action, keyed by mode. Reload never resets counters.
- Timer runs only while the page is visible.
- A finished daily reopens to its result, not a replay.

## Workflow

1. TDD: write a failing test from the spec rule, make it pass, refactor.
2. Engine first, then tools, then UI. UI work starts only after engine tests pass.
3. Before committing engine, tools, or workflow changes (and the web app's non-visual `.ts` logic), run `/ponytail:ponytail-review` on the diff and apply its findings unless they remove trust-boundary validation, spec behavior, accessibility, or a required test. Name skipped findings in the commit body.
4. Small commits, one concern each. Conventional Commits (`feat(wordpath): ...`).
5. Spec changes and `[Decision]` items need user sign-off. Record them in the plan's Decisions table. Ask; don't assume.
6. If a spec is ambiguous or contradicts itself, stop and ask. Do not guess rules.

## Keep it lean

- No abstraction until a second real use exists. Shared code moves to `shared/` when the second game needs it, not before.
- No new dependency when a few lines or the platform covers it. Approved so far: Playwright, axe, `@anthropic-ai/sdk`, `gsap`, `@gsap/react`.
- No speculative config, feature flags, or leaderboard/server code until leaderboards are scheduled.
- Delete dead code; don't comment it out.
- Files over ~300 lines are a smell. Split by responsibility.

## Out of scope (for now)

Leaderboards, server checker, accounts, analytics, i18n, native apps, sharing, puzzle numbers and launch dates.
