# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Decided in the approved plan (`docs/superpowers/plans/2026-10-18-word-path-v1.md`): Vite + React 19 single-page app, TypeScript, plain CSS with custom-property tokens, GSAP with `@gsap/react` as the only animation library, inline SVG icons, self-hosted fonts, static hosting on Cloudflare Pages. No Tailwind, Framer Motion, icon library, or font CDN.

## Users

Casual daily puzzlers: adults who play a quick word game in a desktop browser during a work break or in the evening, Wordle-style, and then often play a few more puzzles in Unlimited. Phones are supported but secondary.

## Product Purpose

Word Path is the first game of a small puzzle collection. Each puzzle shows a clue and a square grid of letter tiles. The player works out the answer from the clue, then taps a route of touching tiles that spells it. Success: the player comes back each day for the daily puzzle and keeps a streak, and plays more in Unlimited when they want more.

## Positioning

Every tile holds only the answer's letters, and exactly one route in the grid spells the answer (no other route spells any other word of that length). So the challenge is two-step and fair: decode the clue, then find the single path, and the game can tell the player that a wrong route spelled a different word.

## Operating Context

- Played with a mouse and keyboard on desktop first; touch on phones also works.
- Home is a collection page showing each game as a designed card; Word Path is the only game so far.
- Daily mode: one puzzle per local date, a streak, stats; a new puzzle at local midnight.
- Unlimited mode: puzzle after puzzle with no daily limit, separate stats, never affects the streak.
- No accounts, no leaderboards, no sharing. Scores and progress stay in this browser's local storage. The Stats dialog says so, and a notice appears when the browser blocks saving.
- Clues are written and reviewed by AI models; there is no human editor.

## Capabilities and Constraints

- Grid sizes 6×6 to 10×10 on touch devices; a 15×15 grid on mouse devices (falling back to 10×10 or smaller only when the window is too small). Chosen from the available space and locked for an attempt.
- No hints. A Clear action and Give up (with a confirmation; it reveals the answer and breaks the streak). No time limit, no attempt limit; a timer runs only while the page is visible.
- Three levels: Easy, Normal, Hard. Dailies are Normal. The Home card opens a Word Path page where players start the daily or pick an Unlimited level; Back from a game returns there to switch level. Difficulty comes from twistier routes, more dead-end trails, and less direct clues, never from tile colors.
- After a wrong full-length route, the spelled word is shown for 0.9 s.
- Result shows answer, clue, time, and wrong attempts separately; no combined score.
- Rules and copy come from the Word Path spec v1.0-rc1 and the plan's Decisions table.
- Undecided: the final name of the collection and any logo.

## Brand Commitments

- "Tiny Trouble Games" is a working name and may change. Do not build the look around the name.
- Voice: playful but grown-up. Not childish (no bubbly kid styling), not cold or corporate.
- No mascot in v1. A small low-poly hedgehog mascot is parked as a later development (plan, L1); if picked up it stays in the garden palette, reacts only to events, and has no speech bubbles or idle loops.
- Pinned by the spec (§7.3): tiles form a checkerboard of brown `#7A4A2B` and maroon `#7A1F2E` with cream `#FFF3E3` letters; the selected tile is orange `#F28C28` with dark brown `#2B1400` text and an outline; solved route turns green. Changing these needs user sign-off.
- No emoji anywhere.

## Evidence on Hand

None yet: no logo, no screenshots, no player data, no testimonials. Puzzles do not exist until the content pipeline runs. Do not invent player counts, reviews, or press.

## Product Principles

1. The grid is the hero. While a puzzle is open, nothing competes with reading the letters and the route.
2. Fair and solvable. One route, a checked clue, and clear feedback for every wrong try.
3. Instant response. Input never waits for an animation.
4. A daily ritual with room for more. The daily puzzle is the anchor; Unlimited is there when the player wants it.
5. Nothing generic. The look should be specific to this game, not a template.

## Accessibility & Inclusion

WCAG 2.2 AA. Every action is a single click or tap and works from the keyboard (arrows, Enter/Space, Escape, Tab). Each cell is labelled ("M, row 2, column 3"); route and results are announced through a live region. Reduced motion turns movement into short fades. Color is never the only signal: selection, wrong paths, and solved state also use outline, ring, or icon.
