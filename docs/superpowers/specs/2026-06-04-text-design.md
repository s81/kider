# Canvas Text Design

**Date:** 2026-06-04  
**Status:** Approved

## Goal

Add `text(str, size)` as a Drawing primitive — draws a string on the canvas at the turtle's position, left-baseline aligned, in the current pen color. Follows the same pipeline as `circle`, `rect`, `ellipse`, `triangle`, and `polygon`.

## Function

| Function | Args | Description |
|---|---|---|
| `text(str, size)` | string, font size in px | Draws text at turtle's left baseline; turtle does not move |

- `str` must be a string; throws `SproutRuntimeError` otherwise
- `size` must be a number > 0; throws `SproutRuntimeError` otherwise
- Uses current pen color (`ctx.strokeStyle`) as fill
- Font family fixed: `sans-serif`
- Turtle does not move after drawing

## Architecture

### `packages/lang/src/values.ts`

New Drawing variant:
```typescript
| { readonly kind: 'text'; readonly str: string; readonly size: number }
```

Constructor helper:
```typescript
export const mkText = (str: string, size: number): Drawing => ({ kind: 'text', str, size });
```

Update INVARIANT comment to include `'text'`.

### `packages/lang/src/renderer.ts`

New CanvasCommand variant:
```typescript
| { readonly kind: 'drawText'; readonly x: number; readonly y: number; readonly str: string; readonly size: number }
```

**`renderInto`** — new case: emit `drawText` at turtle position, then `moveTo` at same position.

**`scaleDrawing`** — new case: `{ kind: 'text', str: d.str, size: d.size * factor }` (str is dimensionless, only size scales).

**`measureInto`** — new case: approximate width as `str.length * size * 0.6`, height as `size`. Canvas text metrics require a rendering context so exact measurement is not possible in the renderer; this approximation is sufficient for `beside`/`above` composition.

```typescript
case 'text': {
  bbox.minX = Math.min(bbox.minX, state.x);
  bbox.maxX = Math.max(bbox.maxX, state.x + drawing.str.length * drawing.size * 0.6);
  bbox.minY = Math.min(bbox.minY, state.y - drawing.size);
  bbox.maxY = Math.max(bbox.maxY, state.y);
  return;
}
```

Note: baseline is at `state.y`, so text extends upward by `size` (minY = y - size) and rightward by the approximate width.

### `packages/lang/src/index.ts`

Export `mkText` alongside the other shape constructors.

### `packages/lang/src/interpreter.ts`

Update `isDrawing` switch to include `'text'`.

Add `assertString` helper (if not already present):
```typescript
function assertString(v: SproutValue, context: string): SproutString {
  if (v.kind !== 'string') {
    throw new SproutRuntimeError(`${context}: expected string, got ${v.kind}`);
  }
  return v;
}
```

New BUILTINS entry:
```typescript
['text', (args) => {
  if (args.length !== 2) throw new SproutRuntimeError(`text expects 2 arguments, got ${args.length}`);
  const str = assertString(args[0], 'text (str)');
  const size = assertNumber(args[1], 'text (size)');
  if (size.value <= 0) throw new SproutRuntimeError(`text expects size > 0, got ${size.value}`);
  return mkText(str.value, size.value);
}],
```

### `apps/ide/src/stage-utils.ts`

New `drawText` case in `drawUpTo`:

```typescript
case 'drawText': {
  ctx.stroke();
  const cx = STAGE_W / 2 + cmd.x;
  const cy = STAGE_H / 2 + cmd.y;
  ctx.font = `${cmd.size}px sans-serif`;
  ctx.fillStyle = ctx.strokeStyle as string;
  ctx.fillText(cmd.str, cx, cy);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  break;
}
```

No `save`/`restore` needed — `fillStyle` is set directly (text uses fill, not stroke+fill like shapes).

### `packages/blocks/src/definitions/shapes.ts`

New `sprout_text` block — uses an inline text **field** (not a value input) for the string, so users type directly in the block:

```typescript
Blockly.Blocks['sprout_text'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('text')
      .appendField(new Blockly.FieldTextInput('hello'), 'TEXT');
    this.appendValueInput('SIZE').setCheck('Number').appendField('size');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
```

### `packages/blocks/src/compiler.ts`

Add `'sprout_text'` to the `compileStmt` case group. Add case to `compileExprBlock`:

```typescript
case 'sprout_text': {
  const str = block.getFieldValue('TEXT') as string;
  const size = compileExpr(mustGetInput(block, 'SIZE'));
  return { kind: 'CallExpr', callee: 'text', args: [{ kind: 'StringLit', value: str }, size], block: null };
}
```

### `apps/ide/src/BlockWorkspace.tsx`

Add `{ kind: 'block', type: 'sprout_text' }` to the Shapes section.

## Testing

### `packages/lang/tests/renderer.test.ts` — `describe('text rendering')`

- `render(mkText('hi', 20))` → `[{ kind: 'drawText', x:0, y:0, str:'hi', size:20 }, { kind: 'moveTo', x:0, y:0 }]`
- `measure(mkText('hi', 20))` → `{ width: 2 * 20 * 0.6, height: 20 }` (width = charCount * size * 0.6)
- `scaleDrawing(2, mkText('hi', 10))` → `{ kind: 'text', str: 'hi', size: 20 }` (str unchanged)
- turtle position tracks: `sequence([forward(100), text('hi', 20)])` → drawText at (0, -100)

### `packages/lang/tests/interpreter.test.ts` — tests inside `describe('text builtin')`

- `text("hi", 20)` returns `mkSequence([mkText('hi', 20)])`
- `text()` with 0 args throws `SproutRuntimeError` matching `/text/`
- `text("hi")` with 1 arg throws `SproutRuntimeError` matching `/text/`
- `text(42, 20)` with non-string first arg throws `SproutRuntimeError`
- `text("hi", true)` with non-number size throws `SproutRuntimeError`
- `text("hi", 0)` with size ≤ 0 throws `SproutRuntimeError` matching `/text/`

### `apps/ide/tests/stage-utils.test.ts` — `describe('text drawing')`

- `drawText` calls `ctx.fillText` with correct canvas-offset position
- `drawText` sets `ctx.fillStyle` to `ctx.strokeStyle` before drawing

### `packages/blocks/tests/compiler.test.ts` — `describe('text block')`

- `sprout_text` with TEXT="hello", SIZE=20 → `ExprStmt { expr: CallExpr { callee: 'text', args: [StringLit('hello'), NumberLit(20)] } }`

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/values.ts` | Add `text` Drawing variant + `mkText` constructor |
| `packages/lang/src/renderer.ts` | Add `drawText` CanvasCommand; cases in `renderInto`, `scaleDrawing`, `measureInto` |
| `packages/lang/src/index.ts` | Export `mkText` |
| `packages/lang/src/interpreter.ts` | Add `assertString` helper; update `isDrawing`; add `text` builtin |
| `packages/lang/tests/renderer.test.ts` | Add `describe('text rendering')` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('text builtin')` |
| `apps/ide/src/stage-utils.ts` | Add `drawText` case to `drawUpTo` |
| `apps/ide/tests/stage-utils.test.ts` | Add `describe('text drawing')` |
| `packages/blocks/src/definitions/shapes.ts` | Add `sprout_text` block |
| `packages/blocks/src/compiler.ts` | Add `sprout_text` to `compileStmt` and `compileExprBlock` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('text block')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_text` to Shapes section |

## Out of Scope

- Font family selection — always `sans-serif`
- Text alignment other than left-baseline
- Bold/italic/underline styling
- Multiline text
- Exact text width measurement (requires canvas context)
