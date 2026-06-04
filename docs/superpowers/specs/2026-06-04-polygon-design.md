# Polygon Design

**Date:** 2026-06-04  
**Status:** Approved

## Goal

Add `polygon(n, size)` as a filled Drawing primitive — a regular n-sided polygon centered on the turtle, filled with a semi-transparent version of the current pen color and stroked at full opacity. Follows the same pipeline as `circle`, `rect`, `ellipse`, and `triangle`.

## Function

| Function | Args | Description |
|---|---|---|
| `polygon(n, size)` | sides, side-length | Filled regular polygon centered on turtle, first vertex at top |

- `n < 3` throws `SproutRuntimeError`
- Both `n` and `size` must be numbers
- Shape is centered on the turtle position; turtle does not move

## Geometry

- Circumradius: `R = size / (2 * Math.sin(Math.PI / n))`
- Vertex k (0-indexed): `x = cx + R * cos(−π/2 + 2πk/n)`, `y = cy + R * sin(−π/2 + 2πk/n)`
- First vertex is at top (−π/2), vertices go clockwise
- Bounding box: ±R in x and y (circumscribed circle)

## Fill Behavior

Same as other filled shapes: fill at `globalAlpha = 0.35` using `ctx.strokeStyle` as `fillStyle`, then stroke at full opacity.

## Architecture

### `packages/lang/src/values.ts`

New Drawing variant:
```typescript
| { readonly kind: 'polygon'; readonly n: number; readonly size: number }
```

Constructor helper:
```typescript
export const mkPolygon = (n: number, size: number): Drawing => ({ kind: 'polygon', n, size });
```

Update INVARIANT comment to include `'polygon'`.

### `packages/lang/src/renderer.ts`

New CanvasCommand variant:
```typescript
| { readonly kind: 'drawPolygon'; readonly x: number; readonly y: number; readonly n: number; readonly size: number }
```

**`renderInto`** — new case: emit `drawPolygon` with baked-in turtle position, then `moveTo` at same position.

**`scaleDrawing`** — new case: `{ kind: 'polygon', n: d.n, size: d.size * factor }` (n is dimensionless, only size scales).

**`measureInto`** — new case: compute `R = size / (2 * Math.sin(Math.PI / n))`, extend bbox by ±R in x and y.

### `packages/lang/src/index.ts`

Export `mkPolygon` alongside the other shape constructors.

### `packages/lang/src/interpreter.ts`

Update `isDrawing` switch to include `'polygon'`.

New BUILTINS entry:
```typescript
['polygon', (args) => {
  if (args.length !== 2) throw new SproutRuntimeError(`polygon expects 2 arguments, got ${args.length}`);
  const n = assertNumber(args[0], 'polygon (n)');
  const size = assertNumber(args[1], 'polygon (size)');
  if (n.value < 3) throw new SproutRuntimeError(`polygon expects n ≥ 3, got ${n.value}`);
  return mkPolygon(n.value, size.value);
}],
```

### `apps/ide/src/stage-utils.ts`

New `drawPolygon` case in `drawUpTo`:

```typescript
case 'drawPolygon': {
  ctx.stroke();
  const cx = STAGE_W / 2 + cmd.x;
  const cy = STAGE_H / 2 + cmd.y;
  const R = cmd.size / (2 * Math.sin(Math.PI / cmd.n));
  const vertices = Array.from({ length: cmd.n }, (_, k) => ({
    x: cx + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * k) / cmd.n),
    y: cy + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * k) / cmd.n),
  }));
  const drawPath = () => {
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
    ctx.closePath();
  };
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = ctx.strokeStyle as string;
  drawPath();
  ctx.fill();
  ctx.restore();
  drawPath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  break;
}
```

### `packages/blocks/src/definitions/shapes.ts`

New `sprout_polygon` block (statement block, colour 160):
```typescript
Blockly.Blocks['sprout_polygon'] = {
  init(this: Blockly.Block) {
    this.appendValueInput('N').setCheck('Number').appendField('polygon');
    this.appendValueInput('SIZE').setCheck('Number').appendField('×');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(160);
  },
};
```

### `packages/blocks/src/compiler.ts`

Add `'sprout_polygon'` to the `compileStmt` case group. Add case to `compileExprBlock`:
```typescript
case 'sprout_polygon': {
  const n = compileExpr(mustGetInput(block, 'N'));
  const size = compileExpr(mustGetInput(block, 'SIZE'));
  return { kind: 'CallExpr', callee: 'polygon', args: [n, size], block: null };
}
```

### `apps/ide/src/BlockWorkspace.tsx`

Add `{ kind: 'block', type: 'sprout_polygon' }` to the Shapes section.

## Testing

### `packages/lang/tests/renderer.test.ts` — `describe('polygon rendering')`

- `render({ kind: 'polygon', n: 6, size: 60 })` → `[{ kind: 'drawPolygon', x: 0, y: 0, n: 6, size: 60 }, { kind: 'moveTo', x: 0, y: 0 }]`
- `measure({ kind: 'polygon', n: 6, size: 60 })` → `{ width: 120, height: 120 }` (hexagon: `R = 60 / (2 * sin(π/6)) = 60`; use `toBeCloseTo` for non-integer R values)
- `scaleDrawing(2, { kind: 'polygon', n: 6, size: 30 })` → `{ kind: 'polygon', n: 6, size: 60 }` (n unchanged)

### `packages/lang/tests/interpreter.test.ts` — `describe('polygon builtin')`

- `polygon(6, 60)` returns `mkSequence([{ kind: 'polygon', n: 6, size: 60 }])`
- `polygon()` with 0 args throws `SproutRuntimeError`
- `polygon(6)` with 1 arg throws `SproutRuntimeError`
- `polygon(2, 60)` with n < 3 throws `SproutRuntimeError`
- `polygon(true, 60)` with non-number n throws `SproutRuntimeError`
- `polygon(6, 60)` message assertion: `.toThrow(/polygon/)`

### `apps/ide/tests/stage-utils.test.ts` — `describe('polygon drawing')`

- `drawPolygon` with n=4, size=80 calls `ctx.moveTo` and `ctx.lineTo` for 4 vertices, `ctx.fill`, `ctx.closePath`
- `drawPolygon` offsets by turtle position (non-zero x/y)

### `packages/blocks/tests/compiler.test.ts` — `describe('polygon block')`

- `sprout_polygon` → `ExprStmt { expr: CallExpr { callee: 'polygon', args: [NumberLit(6), NumberLit(60)] } }`

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/values.ts` | Add `polygon` Drawing variant + `mkPolygon` constructor |
| `packages/lang/src/renderer.ts` | Add `drawPolygon` CanvasCommand; cases in `renderInto`, `scaleDrawing`, `measureInto` |
| `packages/lang/src/index.ts` | Export `mkPolygon` |
| `packages/lang/src/interpreter.ts` | Update `isDrawing`; add `polygon` builtin |
| `packages/lang/tests/renderer.test.ts` | Add `describe('polygon rendering')` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('polygon builtin')` |
| `apps/ide/src/stage-utils.ts` | Add `drawPolygon` case to `drawUpTo` |
| `apps/ide/tests/stage-utils.test.ts` | Add `describe('polygon drawing')` |
| `packages/blocks/src/definitions/shapes.ts` | Add `sprout_polygon` block |
| `packages/blocks/src/compiler.ts` | Add `sprout_polygon` to `compileStmt` and `compileExprBlock` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('polygon block')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_polygon` to Shapes section |

## Out of Scope

- Rotation parameter — polygon always points up
- Hollow polygon (stroke only) — always filled + stroked
- Non-integer n — n is validated as a number but fractional values are not explicitly rejected (Math functions handle them gracefully)
