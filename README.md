# Tiny Trouble Games

Five small puzzle games, built one at a time. Word Path is the first: a daily puzzle plus unlimited play at three difficulty levels. It runs entirely in the browser, with progress kept in `localStorage`; puzzles are generated offline and served as static JSON.

Rules and scope live in the specs: [Word Path spec](docs/superpowers/plans/Tiny%20Trouble%20Games_%20Word%20Path%20Spec%20v1.0-rc1.md), [plan](docs/superpowers/plans/2026-10-18-word-path-v1.md) (its Decisions table records every change to the spec), and [Games spec](Tiny-Trouble-Games-Spec-v0.4.1.md) for the other games. Project rules for contributors and agents are in [CLAUDE.md](CLAUDE.md).

## Setup

Needs Node 22 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

## Commands

```sh
pnpm dev               # web app with hot reload
pnpm build             # production build in apps/web/dist
pnpm test              # unit and component tests, all packages
pnpm lint              # oxlint
pnpm typecheck         # tsc in every package
pnpm e2e               # Playwright and axe, desktop and phone (first run: pnpm --filter @ttg/web exec playwright install chromium)
pnpm verify            # re-check every puzzle, the word list hashes, and the schedule
pnpm bench             # generator timing per board size
pnpm wordlists build   # rebuild content/wordlists from upstream sources
pnpm content refill [--level easy|normal|hard] [--limit N]
```

Run `pnpm lint && pnpm typecheck && pnpm test` before committing.

## Puzzles

Puzzle files are committed under `data/public/wordpath/`: one `<date>.json` per daily, and `unlimited/<level>/<n>.json` plus `unlimited/index.json` for Unlimited play. Vite serves that folder as the site's public directory, so `data/public/wordpath/2026-10-19.json` is available at `/wordpath/2026-10-19.json`. Never edit a puzzle file by hand; to replace one, delete it and run a refill.

`pnpm verify` checks every puzzle, the word list hashes, and that the store holds 30 dailies from today and 40 Unlimited puzzles per level. It fails while content is short.

## Refilling content

`pnpm content refill` asks AI models for new answers and clues and saves only puzzles that pass every check. It fills missing dailies first (today onward), then each Unlimited level. `--level` fills one Unlimited level only; `--limit N` stops after N new puzzles, which is a cheap way to try it out.

It needs one API key, set in the environment or in a git-ignored `.env` file at the repo root (the key is never written anywhere else):

- `OPENROUTER_API_KEY` (preferred; the defaults are free models, with a daily request cap on the free tier, and the run stops cleanly when the cap or the provider's capacity runs out, so just run it again later), or
- `GEMINI_API_KEY`, or
- `ANTHROPIC_API_KEY`.

Existing puzzle files are never overwritten, and an answer is never reused.

## Deploying to Cloudflare Pages

Connect the repository to a Pages project and set:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Build output directory | `apps/web/dist` |
| Root directory | `/` (the repo root) |
| Node version | 22 (environment variable `NODE_VERSION` = `22`) |
| Production branch | `main` |

Puzzles need no extra step: `pnpm build` copies `data/public` into `apps/web/dist` (Vite's `publicDir`), so they deploy with the app and a push that adds puzzle files redeploys the site. On a preview deploy, check that `/wordpath/<today>.json` returns puzzle JSON, then that the Home card, the daily, and each Unlimited level work. The full list is in the release checklist.
