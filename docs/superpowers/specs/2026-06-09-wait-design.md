# wait(seconds) — Design Spec
**Date:** 2026-06-09

## Summary

Add a `wait(seconds)` builtin and animated playback to let programs pause between drawing steps, producing Logo-style step animation.

---

## Problem

All Sprout programs execute instantaneously — the entire drawing is rendered in one pass. Programs cannot create animations where steps appear over time. `wait(1)` between turtle commands is a common kids programming pattern (Scratch, Logo).

---

## Design

### wait() as a Drawing value

`wait(seconds)` returns a `WaitDrawing` — a first-class drawing value (like `forward`) that carries a duration. When the renderer walks the Drawing tree, it emits a `wait` CanvasCommand. The IDE then plays commands back with timing.

This keeps the interpreter **synchronous** — no async/generator refactor needed.

### New Drawing variant

In `packages/lang/src/values.ts`:

```ts
export interface WaitDrawing {
  readonly kind: 'wait';
  readonly seconds: number;
}
```

Add to the `Drawing` union. Add `mkWait(seconds: number): WaitDrawing`.

### New CanvasCommand variant

In `packages/lang/src/renderer.ts`:

```ts
| { readonly kind: 'wait'; readonly durationMs: number }
```

Renderer handling:
```ts
case 'wait':
  out.push({ kind: 'wait', durationMs: drawing.seconds * 1000 });
  return;
```

No turtle state change — `wait` is pure timing.

### Interpreter builtin

```ts
['wait', (args) => {
  if (args.length !== 1) throw new SproutRuntimeError(`wait expects 1 argument, got ${args.length}`);
  const secs = assertNumber(args[0], 'wait');
  if (secs.value < 0) throw new SproutRuntimeError(`wait: seconds must be non-negative, got ${secs.value}`);
  return mkWait(secs.value);
}],
```

### isDrawing guard

Add `'wait'` to the `isDrawing` switch in `interpreter.ts`.

### scaleDrawing

Add `case 'wait': return d;` (duration is unscaled — `wait` makes no geometric sense to scale).

---

## IDE animated playback

### Logic

When `setCommands` is called with a list that contains any `wait` command, the stage enters **animated mode**:

1. Segment commands into runs: `DrawSegment[]` = consecutive non-wait commands, separated by `WaitPause` with a duration.
2. Play segments sequentially:
   - For each `DrawSegment`: call `drawUpTo` with the cumulative command index up to the end of that segment. This draws everything up to that point.
   - For each `WaitPause`: `setTimeout` for `durationMs`, then continue with next segment.
3. Turtle indicator is updated after each segment (uses existing `getTurtleState` logic).

### Segment extraction helper (in `stage-utils.ts`)

```ts
export type PlaybackSegment =
  | { kind: 'draw'; upTo: number }   // draw commands[0..upTo] inclusive
  | { kind: 'wait'; durationMs: number };

export function buildPlayback(commands: CanvasCommand[]): PlaybackSegment[] {
  const segments: PlaybackSegment[] = [];
  let drawEnd = -1;
  for (let i = 0; i < commands.length; i++) {
    if (commands[i].kind === 'wait') {
      if (drawEnd >= 0) segments.push({ kind: 'draw', upTo: drawEnd });
      segments.push({ kind: 'wait', durationMs: (commands[i] as { durationMs: number }).durationMs });
      drawEnd = -1;
    } else {
      drawEnd = i;
    }
  }
  if (drawEnd >= 0) segments.push({ kind: 'draw', upTo: drawEnd });
  return segments;
}
```

### App.tsx changes

Add an `animRef` ref (stores active timeout IDs so animation can be cancelled on re-run).

When `handleRun` sets commands:
1. Cancel any active animation (`animRef.current` timeouts)
2. If no `wait` commands: `drawUpTo(commands, commands.length)` as today
3. If `wait` commands present: call `startPlayback(commands)` which schedules segments

`startPlayback` function:
```ts
function startPlayback(commands: CanvasCommand[]) {
  const segments = buildPlayback(commands);
  let idx = 0;
  function step() {
    if (idx >= segments.length) return;
    const seg = segments[idx++];
    if (seg.kind === 'draw') {
      drawUpTo(ctx, commands, seg.upTo + 1);
      // update turtle indicator
      step(); // continue immediately
    } else {
      animRef.current = setTimeout(step, seg.durationMs);
    }
  }
  step();
}
```

### `drawUpTo` in `stage-utils.ts`

Add `case 'wait': break;` — wait commands are skipped during drawing (they are timing-only markers).

---

## Block definition

`sprout_wait` — statement block (colour 330, pinkish — matches timing/control):

```
wait [ ___ ] seconds
```

- One number input `SECS`
- `setPreviousStatement(true)`, `setNextStatement(true)`

Toolbox: add to **Control** section (near `sprout_repeat`, `sprout_while`).

Compiler:
```ts
case 'sprout_wait': {
  const secs = compileValueBlock(block.getInputTargetBlock('SECS'));
  return exprStmt({ kind: 'CallExpr', callee: 'wait', args: [secs], block: null });
}
```

---

## Testing

Test file: `packages/lang/tests/wait.test.ts`

Groups:

1. **wait returns WaitDrawing** — `wait(1)` evaluates to `{ kind: 'wait', seconds: 1 }`
2. **wait in sequence** — sequence of forward + wait + forward produces drawings with wait in middle
3. **renderer emits wait command** — render drawing with wait → CanvasCommand has `{ kind: 'wait', durationMs: 1000 }`
4. **wait 0** — `wait(0)` is valid, seconds = 0
5. **negative wait** — `wait(-1)` throws
6. **wrong arity** — `wait()` or `wait(1, 2)` throws

### buildPlayback tests (in `packages/lang/tests/wait.test.ts` or `stage-utils.test.ts`)

1. No waits → single `draw` segment covering all commands
2. Wait at start → `wait` then `draw`
3. Wait in middle → `draw`, `wait`, `draw`
4. Multiple waits → correct alternation
5. Wait at end → `draw`, `wait` (no trailing empty draw)

---

## Serializer

Add `case 'wait': return `wait(${node.seconds})`;` in the expression serializer.

Actually `wait` is a CallExpr in the AST — no serializer change needed (it serializes as a normal call).

---

## Out of scope

- Pause/resume button in IDE — out of scope
- Animation speed control — out of scope
- `wait` inside event handlers (timer, keydown) — works naturally since each handler invocation builds a new drawing; `wait` in a timer handler would play back on each tick
