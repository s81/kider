# Clear Canvas Design

**Date:** 2026-06-05  
**Status:** Approved

## Goal

Add a `clearCanvas()` builtin that wipes the canvas and resets the turtle to its initial state. Enables animation loops where each timer tick draws a fresh frame.

## Function

| Call | Effect |
|---|---|
| `clearCanvas()` | Wipes canvas; resets turtle to (0,0) facing up, pen down |

No arguments accepted — throws `SproutRuntimeError` for any args.

## User Experience

Typical animation loop:

```
on(:timer, do
  clearCanvas()
  background(:white)
  forward(x)
  x = x + 5
end)
```

Each timer tick: canvas wiped, turtle reset to center, new frame drawn from scratch. Key and click handlers work identically — `clearCanvas()` inside any handler wipes and resets.

## Architecture

### Memory Management

Timer and keydown handlers currently accumulate: `mkSequence([accDrawingRef.current, delta])`. For animation this grows unboundedly. Fix: after calling `render(delta)`, check if the command list contains a `clearCanvas` command. If yes, replace `accDrawingRef.current = delta` (discard history). If no, append as before. This applies to both timer and keydown handlers in `App.tsx`.

### `packages/lang/src/values.ts`

New Drawing variant after `background`:
```typescript
| { readonly kind: 'clearCanvas' }
```

New constructor:
```typescript
export const mkClearCanvas = (): Drawing => ({ kind: 'clearCanvas' });
```

Update the INVARIANT comment to include `'clearCanvas'`.

### `packages/lang/src/renderer.ts`

New CanvasCommand after `fillBackground`:
```typescript
| { readonly kind: 'clearCanvas' }
```

`renderInto` — new case: emit `clearCanvas`, reset turtle state, emit `moveTo`:
```typescript
case 'clearCanvas':
  out.push({ kind: 'clearCanvas' });
  state.x = 0;
  state.y = 0;
  state.angle = 0;
  state.penDown = true;
  out.push({ kind: 'moveTo', x: 0, y: 0 });
  return;
```

`scaleDrawing` — pass through unchanged:
```typescript
case 'clearCanvas':
  return d;
```

`measureInto` — no bounding box contribution:
```typescript
case 'clearCanvas':
  return;
```

### `packages/lang/src/interpreter.ts`

New builtin after `background`:
```typescript
['clearCanvas', (args) => {
  if (args.length !== 0) throw new SproutRuntimeError(`clearCanvas expects 0 arguments, got ${args.length}`);
  return mkClearCanvas();
}],
```

`isDrawing` switch: add `'clearCanvas'`.

Import `mkClearCanvas` from `values.js`.

### `apps/ide/src/stage-utils.ts`

New case in `drawUpTo` after `fillBackground`:
```typescript
case 'clearCanvas': {
  ctx.stroke();
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  ctx.beginPath();
  ctx.moveTo(STAGE_W / 2, STAGE_H / 2);
  break;
}
```

### `apps/ide/src/App.tsx`

Extract a helper used in both timer and keydown handlers:

```typescript
function applyHandlerDelta(delta: Drawing) {
  const deltaCommands = render(delta);
  const usesClear = deltaCommands.some(c => c.kind === 'clearCanvas');
  const next = usesClear ? delta : mkSequence([accDrawingRef.current!, delta]);
  accDrawingRef.current = next;
  setCommands(usesClear ? deltaCommands : render(next));
}
```

Replace the inline accumulation logic in both the timer `setInterval` callback and the keydown `onKeyDown` handler with `applyHandlerDelta(delta)`.

### `packages/blocks/src/definitions/statements.ts`

New `sprout_clear_canvas` block after `sprout_background`:
```typescript
Blockly.Blocks['sprout_clear_canvas'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('clear canvas');
    this.setTooltip('Wipes the canvas and resets the turtle to the center.');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(20);
  },
};
```

### `packages/blocks/src/compiler.ts`

Add `'sprout_clear_canvas'` to the `compileStmt` case group (after `'sprout_background'`).

Add case in `compileExprBlock`:
```typescript
case 'sprout_clear_canvas':
  return { kind: 'CallExpr', callee: 'clearCanvas', args: [], block: null };
```

### `apps/ide/src/BlockWorkspace.tsx`

Add `{ kind: 'block', type: 'sprout_clear_canvas' }` after `sprout_background` in the Pen section.

## Testing

### `packages/lang/tests/renderer.test.ts` — `describe('clearCanvas rendering')`

- `render(mkClearCanvas())` → `[{ kind: 'clearCanvas' }, { kind: 'moveTo', x: 0, y: 0 }]`
- `render(mkSequence([mkForward(50), mkClearCanvas(), mkForward(30)]))` — after clearCanvas the second forward starts from (0,0)
- `scale(2, mkClearCanvas())` → `[{ kind: 'clearCanvas' }, { kind: 'moveTo', x: 0, y: 0 }]` (unchanged by scale)
- `measure(mkClearCanvas())` → `{ width: 0, height: 0 }`

### `packages/lang/tests/interpreter.test.ts` — `describe('clearCanvas builtin')`

- `clearCanvas()` returns `mkSequence([mkClearCanvas()])`
- `clearCanvas(1)` throws `SproutRuntimeError` matching `/clearCanvas/`
- `clearCanvas()` inside a sequence is accumulated correctly

### `apps/ide/tests/stage-utils.test.ts` — `describe('clearCanvas drawing')`

- `clearCanvas` command calls `ctx.clearRect(0, 0, STAGE_W, STAGE_H)`
- `clearCanvas` command calls `ctx.stroke()` before clearing
- `clearCanvas` command calls `ctx.beginPath()` and `ctx.moveTo(STAGE_W/2, STAGE_H/2)` after

### `packages/blocks/tests/compiler.test.ts` — `describe('clearCanvas block')`

- `sprout_clear_canvas` → `ExprStmt { expr: CallExpr { callee: 'clearCanvas', args: [] } }`

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/values.ts` | Add `clearCanvas` Drawing variant and `mkClearCanvas` |
| `packages/lang/src/renderer.ts` | Add `clearCanvas` CanvasCommand; handle in `renderInto`/`scaleDrawing`/`measureInto` |
| `packages/lang/src/interpreter.ts` | Add `clearCanvas` builtin; update `isDrawing` |
| `packages/lang/tests/renderer.test.ts` | Add `describe('clearCanvas rendering')` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('clearCanvas builtin')` |
| `apps/ide/src/stage-utils.ts` | Handle `clearCanvas` in `drawUpTo` |
| `apps/ide/tests/stage-utils.test.ts` | Add `describe('clearCanvas drawing')` |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_clear_canvas` block |
| `packages/blocks/src/compiler.ts` | Add `sprout_clear_canvas` to `compileStmt` and `compileExprBlock` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('clearCanvas block')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_clear_canvas` to toolbox |
| `apps/ide/src/App.tsx` | Add `applyHandlerDelta` helper; use in timer and keydown handlers |

## Out of Scope

- Clearing only part of the canvas
- Preserving pen color/width across `clearCanvas()` — pen color and width are not reset, only turtle position and pen-down state
- `clearCanvas()` affecting the `measure()` bounding box calculation
