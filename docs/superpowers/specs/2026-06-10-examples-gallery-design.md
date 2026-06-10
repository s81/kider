# Examples Gallery Design

**Date:** 2026-06-10
**Status:** Approved

## Goal

Kids currently open the IDE to a blank canvas and ~90 toolbox blocks with no
starting point. An "Examples" dropdown in the toolbar loads complete starter
programs — including a full game that shows off this session's features
(keyDown + touching + beep + stopTimer) — so a kid's first minute is "run
something cool, then tinker".

## Approach

- **`apps/ide/src/examples.ts`** — a pure data module:
  `Example { name: string; code: string }` and `EXAMPLES: Example[]` with
  five programs written in Sprout text syntax (with `#` comments):
  1. **Square** — `repeat 4` basics.
  2. **Filled Star** — `fill do repeat 5 ... turn(144) end`.
  3. **Random Art** — `repeat 30` of randomColor + goto(random…) + circle.
  4. **Melody** — `playNote` phrase (Twinkle Twinkle opening).
  5. **Catch Game** — the complete loop: `let` state, `on timer`, `keyDown`
     movement, `touching` + `beep` scoring, `show` HUD, win text + `stopTimer`.
- **App.tsx** — a `<select>` in the toolbar ("Examples…" placeholder). Choosing
  one loads its code into the text editor and switches to editor mode — the
  exact behavior Import already has (no overwrite confirmation, consistent
  with Import). The select resets to the placeholder after loading so the same
  example can be picked twice.
- Examples load as **text** (not blocks): there is no text→blocks converter,
  and the text panel is already the medium for shared/imported programs.

## Examples as integration tests

`apps/ide/tests/examples.test.ts` asserts for every example:
- `parse(code)` succeeds, and
- `interpretFull(parse(code))` runs without throwing (handlers from the game
  example register; `callHandler` on its `:timer` handler also runs clean).

This is the real payoff beyond onboarding: the gallery becomes an end-to-end
regression suite spanning lexer → parser → interpreter for realistic programs.
If a future language change breaks any shipped example, CI fails.

## Testing

- ide: per-example parse + interpret tests as above; the timer handler of the
  Catch Game invokes without error.
- No new lang/blocks/parser work — this is content + one toolbar control.
