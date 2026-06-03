# Filled Shapes Design

**Date:** 2026-06-04
**Status:** Approved

## Goal

Add four filled shape primitives (`circle`, `rect`, `ellipse`, `triangle`) as interpreter builtins and Blockly statement blocks. Shapes are centered on the turtle position, filled with a semi-transparent version of the current pen color, and stroked with the full pen color.

## Function Set

| Function | Args | Description |
|---|---|---|
| `circle(r)` | radius | Filled circle centered on turtle |
| `rect(w, h)` | width, height | Filled rectangle centered on turtle |
| `ellipse(rx, ry)` | x-radius, y-radius | Filled ellipse centered on turtle |
| `triangle(size)` | side length | Filled equilateral triangle pointing up, centered on turtle |

Shapes are **statement-level** Drawing values — they draw at the current turtle position without moving the turtle.

## Fill Behavior

`color()` controls both fill and stroke. Fill is rendered at `globalAlpha = 0.35` using the current `strokeStyle` as `fillStyle`, then stroked at full opacity. No color parsing required — the browser handles the alpha compositing.

## Architecture

### `packages/lang/src/values.ts`

Add 4 nodes to the `Drawing` union and 4 constructor helpers:

```typescript
| { readonly kind: 'circle';   readonly radius: number }
| { readonly kind: 'rect';     readonly width: number; readonly height: number }
| { readonly kind: 'ellipse';  readonly rx: number; readonly ry: number }
| { readonly kind: 'triangle'; readonly size: number }
```

Constructor helpers:
- `mkCircle(radius: number): Drawing`
- `mkRect(width: number, height: number): Drawing`
- `mkEllipse(rx: number, ry: number): Drawing`
- `mkTriangle(size: number): Drawing`

### `packages/lang/src/renderer.ts`

**New `CanvasCommand` variants:**
```typescript
| { readonly kind: 'drawCircle';   readonly x: number; readonly y: number; readonly radius: number }
| { readonly kind: 'drawRect';     readonly x: number; readonly y: number; readonly width: number; readonly height: number }
| { readonly kind: 'drawEllipse';  readonly x: number; readonly y: number; readonly rx: number; readonly ry: number }
| { readonly kind: 'drawTriangle'; readonly x: number; readonly y: number; readonly size: number }
```

**`renderInto`** — 4 new cases. Each bakes the current turtle `(state.x, state.y)` into the command and emits a follow-up `moveTo` at the same position to reconnect the canvas path (same pattern as `color` and `penWidth`). Turtle state does not change.

**`scaleDrawing`** — 4 new cases scaling dimensions by `factor`:
- `circle`: `radius * factor`
- `rect`: `width * factor`, `height * factor`
- `ellipse`: `rx * factor`, `ry * factor`
- `triangle`: `size * factor`

**`measureInto`** — 4 new cases extending the bbox from current turtle position (no state change):
- `circle(r)`: extends ±r in x and y
- `rect(w, h)`: extends ±w/2 in x, ±h/2 in y
- `ellipse(rx, ry)`: extends ±rx in x, ±ry in y
- `triangle(size)`: x extends ±size/2; y extends from −size·√3/3 (tip) to +size·√3/6 (base)

### `apps/ide/src/stage-utils.ts`

**`drawUpTo`** — 4 new cases. Pattern for each shape command:
1. `ctx.stroke()` — flush current turtle path
2. `ctx.save()`
3. `ctx.globalAlpha = 0.35; ctx.fillStyle = ctx.strokeStyle as string`
4. Draw the fill path and `ctx.fill()`
5. `ctx.restore()`
6. Draw the stroke path and `ctx.stroke()`
7. `ctx.beginPath(); ctx.moveTo(cx, cy)` — resume path at shape center

canvas2D calls:
- circle: `ctx.arc(cx, cy, radius, 0, Math.PI * 2)`
- rect: `ctx.rect(cx - width/2, cy - height/2, width, height)`
- ellipse: `ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)`
- triangle: path with vertices at `(cx, cy - size*√3/3)`, `(cx - size/2, cy + size*√3/6)`, `(cx + size/2, cy + size*√3/6)`

where `cx = STAGE_W/2 + cmd.x`, `cy = STAGE_H/2 + cmd.y`.

### `packages/lang/src/interpreter.ts`

4 new entries in the `BUILTINS` map, each validating arity and returning a Drawing:

- `circle(r)`: 1 arg → `{ kind: 'circle', radius: r.value }`
- `rect(w, h)`: 2 args → `{ kind: 'rect', width: w.value, height: h.value }`
- `ellipse(rx, ry)`: 2 args → `{ kind: 'ellipse', rx: rx.value, ry: ry.value }`
- `triangle(size)`: 1 arg → `{ kind: 'triangle', size: size.value }`

### `packages/blocks/src/definitions/shapes.ts` (new file)

`registerShapeBlocks()` registers 4 Blockly **statement** blocks (colour `160`):
- `sprout_circle`: 1 value input `'R'` labelled `'circle'`
- `sprout_rect`: 2 value inputs `'W'` (labelled `'rect'`) and `'H'` (labelled `'×'`), inline
- `sprout_ellipse`: 2 value inputs `'RX'` (labelled `'ellipse'`) and `'RY'` (labelled `'×'`), inline
- `sprout_triangle`: 1 value input `'SIZE'` labelled `'triangle'`

All blocks: `setPreviousStatement(true, null)`, `setNextStatement(true, null)`.

### `packages/blocks/src/definitions/index.ts`

Import and call `registerShapeBlocks()` inside `registerAllBlocks()`.

### `packages/blocks/src/compiler.ts`

4 new cases in `compileStmt`:
- `sprout_circle`: `{ kind: 'CallExpr', callee: 'circle', args: [compileExpr(mustGetInput(block, 'R'))], block: null }`
- `sprout_rect`: args `[compileExpr(mustGetInput(block, 'W')), compileExpr(mustGetInput(block, 'H'))]`
- `sprout_ellipse`: args `[compileExpr(mustGetInput(block, 'RX')), compileExpr(mustGetInput(block, 'RY'))]`
- `sprout_triangle`: `{ kind: 'CallExpr', callee: 'triangle', args: [compileExpr(mustGetInput(block, 'SIZE'))], block: null }`

### `apps/ide/src/BlockWorkspace.tsx`

Add a "Shapes" section to the toolbox after "Pen":
```typescript
// Shapes
{ kind: 'block', type: 'sprout_circle' },
{ kind: 'block', type: 'sprout_rect' },
{ kind: 'block', type: 'sprout_ellipse' },
{ kind: 'block', type: 'sprout_triangle' },
```

## Testing

### `packages/lang/tests/interpreter.test.ts` — `describe('shape builtins')`

- `circle(50)` returns `{ kind: 'circle', radius: 50 }`
- `rect(80, 40)` returns `{ kind: 'rect', width: 80, height: 40 }`
- `ellipse(60, 30)` returns `{ kind: 'ellipse', rx: 60, ry: 30 }`
- `triangle(50)` returns `{ kind: 'triangle', size: 50 }`
- Arity errors: `circle()` with 0 args, `rect(100)` with 1 arg, `ellipse(10)` with 1 arg, `triangle()` with 0 args — all throw `SproutRuntimeError`

### `packages/lang/tests/renderer.test.ts` — `describe('shape rendering')`

- `render({ kind: 'circle', radius: 50 })` → `[{ kind: 'drawCircle', x: 0, y: 0, radius: 50 }, { kind: 'moveTo', x: 0, y: 0 }]`
- Same pattern for rect, ellipse, triangle — x/y baked in, moveTo follows
- `measure({ kind: 'circle', radius: 50 })` → `{ width: 100, height: 100 }`
- `measure({ kind: 'rect', width: 80, height: 40 })` → `{ width: 80, height: 40 }`
- `scaleDrawing(2, { kind: 'circle', radius: 10 })` → `{ kind: 'circle', radius: 20 }`

### `packages/blocks/tests/compiler.test.ts` — `describe('shape blocks')`

- `sprout_circle` → `ExprStmt { expr: CallExpr { callee: 'circle', args: [NumberLit(50)] } }`
- `sprout_rect` → `CallExpr { callee: 'rect', args: [NumberLit(80), NumberLit(40)] }`
- `sprout_ellipse` → `CallExpr { callee: 'ellipse', args: [NumberLit(60), NumberLit(30)] }`
- `sprout_triangle` → `CallExpr { callee: 'triangle', args: [NumberLit(50)] }`

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/values.ts` | Add 4 Drawing nodes + 4 constructor helpers |
| `packages/lang/src/renderer.ts` | Add 4 CanvasCommand types; 4 new cases in renderInto, scaleDrawing, measureInto |
| `apps/ide/src/stage-utils.ts` | Add 4 cases to drawUpTo |
| `packages/lang/src/interpreter.ts` | Add 4 shape builtins to BUILTINS map |
| `packages/lang/src/index.ts` | Export new Drawing constructors and CanvasCommand types |
| `packages/blocks/src/definitions/shapes.ts` | New — registerShapeBlocks() |
| `packages/blocks/src/definitions/index.ts` | Import + call registerShapeBlocks() |
| `packages/blocks/src/compiler.ts` | Add 4 cases to compileStmt |
| `packages/blocks/tests/compiler.test.ts` | Add describe('shape blocks') with 4 tests |
| `packages/lang/tests/interpreter.test.ts` | Add describe('shape builtins') |
| `packages/lang/tests/renderer.test.ts` | Add describe('shape rendering') |
| `apps/ide/src/BlockWorkspace.tsx` | Add Shapes section to toolbox |

## Out of Scope

- `polygon(n, size)` — not in the agreed set
- Separate `fillColor()` builtin — color() controls both fill (semi-transparent) and stroke
- Shape rotation parameter — shapes always use canonical orientation
- Hollow shapes (stroke only) — all shapes are filled + stroked
