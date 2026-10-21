---
name: Tiny Trouble Games — Word Path
description: A walled garden plot of raised clay pavers; the answer is the one path through it.
colors:
  stone: "#DFE1D6"
  stone-2: "#D4D7CA"
  stone-3: "#C5C9BA"
  ink: "#18231C"
  ink-2: "#46564B"
  rule: "rgb(24 35 28 / .2)"
  rule-faint: "rgb(24 35 28 / .05)"
  hedge: "#24402E"
  hedge-hi: "#3A6247"
  soil: "#19211B"
  on-hedge: "#EEF1E6"
  scrim: "rgb(20 28 22 / .46)"
  good-ink: "#2F7A43"
  warn: "#7A1F2E"
  warn-ink: "#7A1F2E"
  stone-dark: "#131A15"
  stone-2-dark: "#1B241E"
  stone-3-dark: "#263129"
  ink-dark: "#E4E8DB"
  ink-2-dark: "#A8B3A6"
  hedge-dark: "#2A4733"
  hedge-hi-dark: "#3E6A4C"
  soil-dark: "#0D120F"
  good-ink-dark: "#7CC48F"
  warn-dark: "#C2566A"
  warn-ink-dark: "#E58A9B"
  brown: "#7A4A2B"
  maroon: "#7A1F2E"
  cream: "#FFF3E3"
  lantern: "#F28C28"
  lantern-ink: "#2B1400"
  leaf: "#2F7A43"
  brown-side: "#4E2D18"
  maroon-side: "#4C1019"
  lantern-side: "#A9560F"
  leaf-side: "#1B4A2B"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(56px, 6vw, 84px)"
    fontWeight: 750
    lineHeight: 0.92
    letterSpacing: "-0.035em"
    fontVariation: "\"wdth\" 80, \"opsz\" 96"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 82, \"opsz\" 48"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 84, \"opsz\" 36"
  bar-title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 88"
  clue:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 500
    lineHeight: 1.3
    fontVariation: "\"wdth\" 92, \"opsz\" 32"
  body:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.45
    fontVariation: "\"wdth\" 100"
  label:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.4
  tile-letter:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "calc(var(--t) * .39)"
    fontWeight: 650
    lineHeight: 1
    fontVariation: "\"wdth\" 88, \"opsz\" 24"
  stone-letter:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1
    fontVariation: "\"wdth\" 85"
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  2xl: "20px"
  3xl: "24px"
  full: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "44px"
components:
  button-primary:
    backgroundColor: "{colors.hedge}"
    textColor: "{colors.on-hedge}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.hedge-hi}"
    textColor: "{colors.on-hedge}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "46px"
  button-outline-hover:
    backgroundColor: "{colors.stone-2}"
  button-big:
    rounded: "{rounded.xl}"
    padding: "0 22px"
    height: "54px"
  button-on-hedge:
    backgroundColor: "{colors.on-hedge}"
    textColor: "{colors.hedge}"
    rounded: "{rounded.xl}"
    height: "54px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    size: "44px"
  streak-pill:
    backgroundColor: "{colors.stone-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  level-tag:
    backgroundColor: "{colors.lantern}"
    textColor: "{colors.lantern-ink}"
    rounded: "{rounded.full}"
    padding: "4px 9px"
  paver-brown:
    backgroundColor: "{colors.brown}"
    textColor: "{colors.cream}"
    typography: "{typography.tile-letter}"
    rounded: "{rounded.full}"
    size: "84%"
  paver-maroon:
    backgroundColor: "{colors.maroon}"
    textColor: "{colors.cream}"
    typography: "{typography.tile-letter}"
    rounded: "{rounded.full}"
    size: "84%"
  paver-selected:
    backgroundColor: "{colors.lantern}"
    textColor: "{colors.lantern-ink}"
    rounded: "{rounded.full}"
  paver-solved:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.cream}"
    rounded: "{rounded.full}"
  answer-stone:
    backgroundColor: "{colors.stone-3}"
    textColor: "{colors.ink}"
    typography: "{typography.stone-letter}"
    width: "54px"
  answer-stone-solved:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.cream}"
  answer-stone-revealed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stone}"
  dialog:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "30px 32px"
    width: "min(680px, calc(100vw - 32px))"
  cartouche:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    typography: "{typography.clue}"
    padding: "22px 22px 20px"
---

# Design System: Tiny Trouble Games — Word Path

## Overview

**Creative North Star: "The Garden Maze"**

The puzzle is a walled garden plot and the answer is the one path through it. The page is the gravel ground around that plot: a pale stone field with a faint 32px survey grid, yew-ink type, and engraved double rules. All saturated color lives on the board, where raised clay pavers sit in dark soil inside a clipped-hedge band. An orange lantern marks the path being laid; hedge green runs along the route when it is solved. The rest of the world is surveying and garden-making: a clue cartouche with a legend set into its frame, a compass rose and a map scale bar beside the board, an empty plot with its gate open when there is no puzzle.

Density is calm. A play screen is two things, the side panel and the board, and the board is always the largest thing on screen. The voice is playful but grown-up: chunky, condensed display type and tactile pavers carry the play; nothing is bubbly, cartoonish, or glossy. The world refuses the category default of a flat white page with a centered grey tile grid under a top bar.

Light and dark follow the system. Dark mode turns the ground into night stone and the ink pale; the tiles do not change at all.

**Key Characteristics:**
- Stone ground, ink type, color only on the board and its hedge.
- 3D clay pavers drawn in CSS: domed face, offset side wall, letters in cream.
- Engraved double-rule frames (1px rule plus a 1px outline offset 4–5px) for the clue, the Home card, and the Unlimited register.
- One variable family, Bricolage Grotesque, stretched condensed for display and kept upright for reading.
- Survey marks (grid, compass, scale bar) as the only ornament.
- Motion that never gates input; reduced motion means short fades.

## Colors

A muted garden palette: grey-green gravel and yew ink everywhere, with the pinned clay, lantern, and leaf colors reserved for the board.

### Primary
- **Hedge Green** (`hedge`): the clipped-hedge band around every plot, the Home card art panel, the Today's puzzle panel, primary buttons, and the "Continue" level button. Hover deepens to **Lit Hedge** (`hedge-hi`), which also fills the stats distribution bars.
- **Lantern Orange** (`lantern`, text `lantern-ink`): the path being laid. Selected pavers, the route line between them, the streak flame stroke, text selection, the "In progress" level tag, and the focus ring in dark mode. It always means "the path in progress" or "your streak"; it is never a generic accent.

### Secondary
- **Leaf Green** (`leaf`, wall `leaf-side`): the solved route, solved answer stones, and the solved check disc. Text that says "solved" uses **Good Ink** (`good-ink`), which brightens in dark mode for contrast.

### Tertiary
- **Clay Brown** and **Clay Maroon** (`brown` / `maroon`, walls `brown-side` / `maroon-side`): the paver checkerboard. **Cream** (`cream`) is every paver letter, the selected-paver outline, the keyboard focus ring on the board, and solved-stone text.
- **Warn Maroon** (`warn`, `warn-ink`): the Give up confirmation border and the no-save alert icon. Brighter in dark mode so a small icon still reads.

### Neutral
- **Gravel Stone** (`stone`): the page ground and dialog surface. **Stone 2** (`stone-2`) is hover fill, the streak pill, and `kbd` keys. **Stone 3** (`stone-3`) is filled answer stones and the notice strip.
- **Yew Ink** (`ink`): text, outline-button borders, engraved rules, and the light-mode focus ring. **Moss Ink** (`ink-2`) is secondary text, captions, icons in notes, and survey marks.
- **Rule** (`rule`) for dividers and quiet borders; **Faint Rule** (`rule-faint`) only for the survey grid.
- **Soil** (`soil`): the plot floor under the pavers. **On Hedge** (`on-hedge`): text and light buttons on hedge panels. **Scrim** (`scrim`): dialog backdrop.
- Dark-mode values (`*-dark` keys) replace the page tokens under `prefers-color-scheme: dark`; tile tokens have no dark variant.

### Named Rules
**The Pinned Clay Rule.** The tile palette is fixed by spec §7.3 and is identical in light and dark: brown `#7A4A2B` / maroon `#7A1F2E` checkerboard, cream `#FFF3E3` letters, selected lantern `#F28C28` with `#2B1400` text and an outline, solved leaf green, side walls `#4E2D18` / `#4C1019` / `#A9560F` / `#1B4A2B`. Changing any of these needs user sign-off.

**The Color Lives On The Board Rule.** Ground and type stay stone and ink. Saturated color appears only on the board, the hedge panels that frame boards or stand for them, and the lantern/leaf signals that mean path and solved.

**The Never Color Alone Rule.** Every state carried by color is also carried by shape: selected pavers get a cream outline and press down; a wrong route gets a dashed outline and reads back its word; a revealed route gets cream dots and a heavier start ring; solved stones get a check disc; the result line and alerts carry an icon or a word.

**The No Difficulty Color Rule.** Levels are told apart by name, description, and their mini plot's route shape, never by tile color.

## Typography

**Display Font:** Bricolage Grotesque (variable, self-hosted woff2, SIL OFL; weight 200–800, width 75–100%), falling back to `system-ui, sans-serif`.
**Body Font:** the same family at normal width.

**Character:** one variable grotesque doing two jobs: pulled condensed (`wdth` 80–88) and heavy (700–750) with tight tracking for titles, stones, and tile letters, so the display reads chunky and carved; left at full width and regular weight for clues and body, so reading stays easy.

### Hierarchy
- **Display** (750, `clamp(56px, 6vw, 84px)`, 0.92, `wdth` 80): the game title on the Home card only (50px on a phone).
- **Headline** (750, 44px desktop / 34px phone, 1.05, `wdth` 82): result headings ("Solved") and the no-puzzle heading; page headings ("Unlimited", "Today's puzzle") at 40px desktop / 30px phone.
- **Title** (750, 30px, `wdth` 82–84): dialog titles and Unlimited level names (22px on a phone). The top-bar title is lighter (700, 21px desktop / 17px phone, `wdth` 88) with the date beside it in `ink-2`.
- **Clue** (500, 25px desktop / 19px phone, 1.3, `wdth` 92, balanced wrap): the clue inside its cartouche.
- **Body** (400, 15.5px base, about 1.45): descriptions, notes, dialogs; descriptive paragraphs cap at 32–52ch.
- **Label** (600, 13.5px): status lines, ledger terms, scale-bar text, captions.
- **Tile letter** (650, 39% of the tile, `wdth` 88, 1px dark text shadow): paver letters. **Stone letter** (700, 27px desktop / 23px phone, `wdth` 85): answer stones.
- Numbers that change (streak, times, counts, stats) use `tabular-nums`.

### Named Rules
**The One Family Rule.** Bricolage Grotesque is the only typeface. Hierarchy comes from width, weight, and size on its variable axes, never from a second family.

**The Fixed Steps Rule.** Type sizes are fixed px steps per breakpoint (`--text-xs` 12 through `--text-2xl` 32, plus the display and headline sizes above); only the Home title clamps. Tile letters scale with the tile, at 39% of it.

## Layout

Phone first, one breakpoint that matters: **900px**. Below it a play screen is a single column ordered clue, answer stones, board, result line, then Clear and Give up in a two-column bottom row above a top rule. From 900px the play screen is a grid: a **470px side panel** (padding 44px / 32px, 26px gaps, a 1px rule on its right) beside a stage that centers the board with a scale bar under it and a compass rose at its top right.

The stage is the measured board slot. Mouse devices get a 15×15 plot with tiles 36–48px (falling back to the largest of 10×10–6×6 only when the window is too small); touch keeps 6×6–10×10 with 44–48px tiles. Board size is locked for an attempt; only the tile scales after that. The top bar is 64px (54px on a phone) with a bottom rule.

Home centers one card, `min(1000px, 100vw - 60px)`, split 44/56 between the hedge art panel and the text from 900px, stacked on a phone. The Word Path page is a single 860px column from 900px and two columns from **1180px** (a `clamp(340px, 30vw, 430px)` Today panel beside the Unlimited register). How to play puts its example beside the steps from 820px; Stats goes two-column from 700px.

Spacing follows a 4px-based scale (4, 8, 12, 16, 24, 32, 44). The page ground carries a 32px survey grid in `rule-faint` on every screen.

## Elevation & Depth

Depth is physical and belongs to the garden. The page is flat stone; the board is the one raised object. Pavers are lifted off the soil by a solid side wall (an offset shadow of the wall color, 9.5% of the tile deep) with a soft cast shadow and a top-left highlight on a domed radial-gradient face. Pressing a paver sinks it: the wall drops to 30% and the face moves down. The hedge band has its own inset light and a long soft drop; the soil is inset. Elsewhere, shadow is ambient and rare: dialogs float over a scrim, the Home card lifts on hover, and answer stones carry a small inset base.

### Shadow Vocabulary
- **Paver wall** (`0 var(--d) 0 var(--side), 0 calc(var(--d) + 1px) 0 rgb(0 0 0 / .3), 0 calc(var(--d) + 3px) 6px rgb(0 0 0 / .5), inset 0 1.5px 0 rgb(255 255 255 / .22)` with `--d: calc(var(--t) * .095)`): every board tile at rest.
- **Hedge band** (`inset 0 2px 0 rgb(255 255 255 / .06), inset 0 -3px 0 rgb(0 0 0 / .25), 0 18px 40px -18px rgb(10 20 12 / .55), 0 2px 6px rgb(10 20 12 / .2)`): the frame around a plot and the hedge panels.
- **Soil inset** (`inset 0 2px 6px rgb(0 0 0 / .5)`): the plot floor.
- **Dialog** (`0 30px 80px -20px rgb(0 0 0 / .5), 0 2px 8px rgb(0 0 0 / .2)`): modal dialogs only.
- **Card lift** (`0 22px 44px -26px rgb(10 20 12 / .45)`): Home card on hover only.

### Named Rules
**The Paver Is Drawn Rule.** Tiles are 3D clay pavers drawn in CSS (domed face plus offset side wall), never images, WebGL, or a flat square. The side wall is the paver's own darker clay, not a black drop shadow.

**The Flat Ground Rule.** Nothing on the stone ground is raised except the board, the hedge panels, and modal dialogs. Panels on the ground are framed with rules, not shadows.

## Shapes

Two families of form. The garden objects are round and soft: pavers are circles at **84% of the tap area**, answer stones are tall rounded blocks (`14px 14px 17px 17px`), the hedge band rounds at 16px (24px from 900px) around a soil plot at 10px, the solved check is a disc. The survey layer is square and engraved: the clue cartouche, Home card, and Unlimited register have square corners and a double rule (1px solid ink border plus a 1px ink outline offset 4–5px), and the clue's legend sits in a gap of the inner rule like a map cartouche title. Controls sit between: buttons and icon buttons at 12px, big buttons at 14px, dialogs at 20px, the level tag a full pill. Empty answer slots are outlined sockets; a wrong word and a coming-soon level use a dashed rule.

## Components

### Buttons
- **Shape:** gently rounded (12px); big call-to-action buttons 14px.
- **Primary:** hedge fill, on-hedge text, 46px tall (54px big), 600 weight, a 22px inline-SVG icon before or after the word.
- **Outline:** transparent with a 1.5px ink border; **Quiet:** the same with a `rule` border (Give up). **On hedge:** an on-hedge fill with hedge text, used inside the Today panel.
- **Hover / Focus:** hover (pointer devices only) fills stone-2, or lit hedge for primary, in 150ms; press scales to 0.97 in 120ms `--ease-out`; focus is a 3px ring offset 2px in ink (lantern in dark). Arrow icons slide 3–4px on hover. Reduced motion drops the scale and shows the hover fill instead. Disabled at 45% opacity.
- **Icon button:** 44×44, transparent, 22px stroke icon at 1.75 width.

### Chips
- **Streak pill:** stone-2 fill, 36px tall, 10px radius, a lantern-stroked flame and the count in bold tabular figures; on a hedge panel it becomes a dark translucent fill.
- **Level tag:** a lantern pill with lantern-ink text ("In progress") beside the level name.
- **Keys:** `kbd` caps in stone-2 with a rule border, 6px radius, 12px semibold.

### Cards / Containers
- **Home game card:** one link over the whole card; engraved double rule; hedge art panel with a 4×4 example board and caption; title, description, a ruled status line, and a big primary call to action. Hover opens the outer rule from 5px to 8px and lifts the card.
- **Unlimited register:** an engraved double-rule frame with one row per level, rows divided by `rule`; each row is one button (mini plot, name, description, solved and average, Play or Continue). Hover tints the row 5% ink.
- **Hedge panel:** the Today's puzzle panel and the Home art panel reuse the hedge band's texture and inset light.
- **Dialog:** a native modal `<dialog>` on stone, 20px radius, rule border, dialog shadow over a scrim; opens from scale 0.96 and opacity 0 in 200ms; close button top right.
- **Notice strip:** a full-width stone-3 band under the top bar with an 18px icon (warn-ink for no-save, ink-2 for the replay notice) and a Dismiss button (an X icon on a phone).

### Navigation
- **Top bar:** 64px, bottom rule; Back icon button, the title with the date in ink-2, a spacer, then streak, stats, and how-to-play icon buttons. On a phone the title stacks over the date and the streak's unit word is visually hidden.

### Clue Cartouche (signature)
A square double-ruled frame on stone holding the clue at the clue step, with a small "Clue" legend (12px, 700, uppercase, 0.14em tracking, ink-2) set into a gap of the top rule. The legend names the region; it belongs to this frame only.

### Board (signature)
Hedge band, soil plot, and a checkerboard of brown and maroon pavers with cream letters. The route line runs under the pavers in lantern (leaf when solved) so it reads as bridges between them; on a given-up board it rises above them with cream dots, and the first tile wears a 4px ring. Selected pavers turn lantern, press into the soil, and take a 2px cream outline; a wrong route gets a dashed cream outline and desaturates; on a finished board the pavers off the route drop to 72% opacity. Keyboard focus is a cream ring around the whole tile, readable on soil. Pointer hover lifts a paver by its full wall depth in 150ms.

### Answer Stones (signature)
A row of sockets that fill with the route's letters as it is laid (each letter rises 4px in 140ms), turn leaf green with a check disc when solved, and turn ink when the answer is revealed. 54px wide from 900px, 46px on a phone.

### Result Ledger
Time and wrong tries side by side between rules, each a label over a 30px bold tabular number that counts up over 600ms on a fresh finish; never added together.

### Motion
GSAP (`motion.ts`, eases `power4.out` / `power4.inOut` as twins of the CSS `--ease-out` / `--ease-in-out`) and CSS transitions only, animating transform and opacity. Tap: paver pops from scale 0.86 in 160ms while the new route segment grows from its tile in 120ms. Wrong: route shakes ±6px for 280ms, then fades to 55%. Solve: route pavers pop to 1.16 in sequence 45ms apart, then petals (cream, blush, apricot, and orange blossoms, green leaves, tan seeds) bloom from every route tile and a shower drifts left to right across the plot, a third settling flat on the pavers; the layer is `aria-hidden`, takes no input, clips to the board, and is done within 5s. Screens rise 8px over 200ms. Demo routes on Home and How to play lay one tap per 0.45s, once, and replay on request. Reduced motion: no movement, 150ms fades, no petals.

## Do's and Don'ts

### Do:
- **Do** keep the board the largest thing on any play screen, inside its hedge band, with the scale bar under it on desktop.
- **Do** use the pinned §7.3 tile tokens exactly, in light and dark alike.
- **Do** pair every color state with an outline, ring, dot, icon, or word.
- **Do** frame flat content on the ground with the engraved double rule (1px border plus 1px outline at 4–5px offset) rather than a shadowed card.
- **Do** set all type in Bricolage Grotesque, using `wdth` 80–88 for display and stones and full width for reading text.
- **Do** draw icons as inline SVG strokes (`currentColor`, 1.75–2.4 width, round caps and joins).
- **Do** animate only transform and opacity, let the next tap interrupt any animation, and swap movement for 150ms fades under reduced motion.
- **Do** give hover effects only to `(hover: hover)` devices, and keep a 3px focus ring on every control (ink in light, lantern in dark; cream on the board).

### Don't:
- **Don't** change the tile palette, letter size (about 39% of the tile), or paver size (84% of the tap area) without user sign-off.
- **Don't** use tile color or any visual cue to signal difficulty.
- **Don't** draw tiles as images, WebGL, or flat squares.
- **Don't** add a second typeface, a font CDN, an icon library, Tailwind, or another animation library.
- **Don't** use emoji anywhere, or add a mascot (the hedgehog is parked until the user picks it up).
- **Don't** spread lantern or leaf onto the ground as decoration; lantern means the path in progress or the streak, leaf means solved.
- **Don't** let motion gate play, press-and-hold, drag, or block input; the petal burst is decoration that a click or key skips.
- **Don't** add uppercase tracked labels above headings; the clue cartouche's legend and table column heads are the only uppercase text.
