# Turtle Visibility Design (hideTurtle / showTurtle)

**Date:** 2026-06-10
**Status:** Approved

## Goal

The green turtle triangle is always drawn on the stage. Finished art and games
don't want a cursor sitting on top of them:

```
fill do ... end   # draw a star
hideTurtle()      # now it's just the star
```

Classic Logo/Scratch feature (`hideturtle`/`hide`), and the natural cleanup
step for every game shipped today.

## Semantics

- `hideTurtle()` / `showTurtle()` — exactly 0 arguments each. Drawing values
  (like `penUp`), composable in sequences, repeat bodies, and handlers.
  The turtle indicator starts visible on every run; the last visibility
  command before the current draw position wins.
- No parser or serializer changes (ordinary calls).

## Architecture

Visibility is part of the *render stream*, not module state, because the stage
replays commands up to a draw limit during animated playback — the turtle must
be hidden exactly from the point in the animation where `hideTurtle()` ran:

- **values.ts**: `{ kind: 'hideTurtle' }` / `{ kind: 'showTurtle' }` Drawing
  variants with `HIDE_TURTLE` / `SHOW_TURTLE` singleton constants (the
  `PEN_UP`/`PEN_DOWN` pattern).
- **interpreter.ts**: two 0-arg builtins returning the singletons; kinds added
  to the `isDrawing` case list.
- **renderer.ts**: `CanvasCommand` gains `{ kind: 'hideTurtle' }` and
  `{ kind: 'showTurtle' }`; `renderInto` emits them; `scaleDrawing` passes
  them through; `measureInto` ignores them.
- **stage-utils.ts (IDE)**: `TurtleState` gains `visible: boolean`;
  `getTurtleState` tracks it while replaying commands (default `true`);
  `drawTurtle` early-returns when `!state.visible` (its three call sites in
  Stage.tsx stay untouched); `drawUpTo` ignores both command kinds.
- **blocks**: `sprout_hide_turtle` / `sprout_show_turtle` statement blocks,
  colour 160, compiling to the 0-arg CallExprs. Toolbox: after `sprout_stamp`
  in Motion.

## Testing

- lang: `hideTurtle()` interprets to the drawing node; renderer emits the
  command in sequence order; arity errors.
- ide: `getTurtleState` reports `visible: false` after a hideTurtle command,
  `true` again after showTurtle, and respects the draw limit (a hide past the
  limit doesn't count yet).
- blocks: both blocks compile.
