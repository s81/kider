# stopTimer Design (game over)

**Date:** 2026-06-10
**Status:** Approved

## Goal

Let games end. The timer loop (`on timer every N`) currently runs forever, so a
kid's game has no "game over" or "you win" state — the scene keeps redrawing
even after the player loses:

```
on timer every 50 do
  ...move, check collisions...
  if lives == 0 do
    clearCanvas()
    text("GAME OVER", 40)
    stopTimer()
  end
end
```

Completes today's game-loop arc: start (Run), play (timer + keyDown + touching
+ beep), end (stopTimer).

## Semantics

- `stopTimer()` — exactly 0 arguments. Sets a stop flag and returns the EMPTY
  drawing (composes anywhere a statement can appear). The flag is consumed by
  the host after the current run/handler completes — drawing produced in the
  same handler invocation still renders (so "GAME OVER" text drawn alongside
  the call shows up).
- Callable from any handler (timer, click, key) and from the main program.
  From the main program it means "don't start the timer at all".
- Stopping an already-stopped (or never-started) timer is a no-op, not an
  error.
- No parser or serializer changes (ordinary call).

## Architecture

Rides the same module-state channel as `show()`/HUD:

- **interpreter.ts**: module-level `_stopTimer` flag, reset at the start of
  `interpret`/`interpretFull` and `callHandler`; `stopTimer` builtin sets it.
  `callHandler`'s result object and `interpretFull`'s result gain
  `stopTimer: boolean`. (`interpretFullWithInputs` inherits via interpretFull.)
- **App.tsx (IDE)**: `applyHandlerDelta` clears `timerRef`'s interval when the
  result carries `stopTimer: true` (covers timer, click, and key handlers);
  `handleRun` skips starting the timer when the main run set the flag.
- **blocks**: `sprout_stop_timer` statement block, label "stop timer",
  colour 65 (the event colour, next to `sprout_on_timer`). Compiles to
  `CallExpr stopTimer []`.
- **toolbox**: after `sprout_on_timer` in Control.

## Testing

- lang: a `:click` handler calling `stopTimer()` → `callHandler` result has
  `stopTimer: true` and still returns its drawing; a handler that doesn't call
  it → `false`; the flag resets between handler invocations; `interpretFull`
  of a program with top-level `stopTimer()` → `stopTimer: true`, without →
  `false`; arity error with 1 arg.
- blocks: `sprout_stop_timer` compiles to the right CallExpr.
- ide: timer-clearing behavior not unit-tested (App has no test harness),
  consistent with the rest of App.tsx.
