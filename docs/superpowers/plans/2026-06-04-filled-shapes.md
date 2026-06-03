# Filled Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `circle(r)`, `rect(w, h)`, `ellipse(rx, ry)`, and `triangle(size)` as filled Drawing primitives with interpreter builtins, renderer support, canvas rendering, Blockly blocks, and IDE toolbox entries.

**Architecture:** Four new Drawing union variants in `values.ts` map to four new `CanvasCommand` variants in `renderer.ts`; `renderInto` bakes turtle position into each shape command and emits a follow-up `moveTo`. `drawUpTo` in `stage-utils.ts` fills at 35% opacity (using current stroke color) then strokes at full opacity. Interpreter builtins and Blockly statement blocks follow the same pattern as `forward`/`turn`.

**Tech Stack:** TypeScript, Vitest, Blockly, Canvas2D API

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/values.ts` | Add 4 Drawing variants + 4 constructor helpers |
| `packages/lang/src/renderer.ts` | Add 4 CanvasCommand types; 4 new cases in renderInto, scaleDrawing, measureInto |
| `packages/lang/src/index.ts` | Export 4 new constructor helpers + new CanvasCommand types |
| `packages/lang/tests/renderer.test.ts` | Add describe('shape rendering') |
| `packages/lang/src/interpreter.ts` | Update isDrawing; add 4 shape builtins to BUILTINS map |
| `packages/lang/tests/interpreter.test.ts` | Add describe('shape builtins') |
| `apps/ide/src/stage-utils.ts` | Add 4 shape cases to drawUpTo |
| `apps/ide/tests/stage-utils.test.ts` | Add describe('shape drawing') |
| `packages/blocks/src/definitions/shapes.ts` | New — registerShapeBlocks() |
| `packages/blocks/src/definitions/index.ts` | Import + call registerShapeBlocks() |
| `packages/blocks/src/compiler.ts` | Add 4 cases to compileStmt and compileExprBlock |
| `packages/blocks/tests/compiler.test.ts` | Add describe('shape blocks') |
| `apps/ide/src/BlockWorkspace.tsx` | Add Shapes section to toolbox |

---

### Task 1: Lang core — Drawing nodes, CanvasCommands, renderer (TDD)

**Files:**
- Modify: `packages/lang/src/values.ts`
- Modify: `packages/lang/src/renderer.ts`
- Modify: `packages/lang/src/index.ts`
- Modify: `packages/lang/tests/renderer.test.ts`

**Background:**

`values.ts` holds the `Drawing` discriminated union and constructor helpers. Currently ends with `mkPenWidth` and `EMPTY`. The INVARIANT comment on line ~91 must be kept in sync.

`renderer.ts` has three switches to update:
1. `renderInto` — emits CanvasCommands, mutates turtle state
2. `scaleDrawing` — recursively rewrites distances by factor
3. `measureInto` — computes bounding box without emitting commands

All three currently handle: `empty`, `penUp`, `penDown`, `color`, `penWidth`, `turn`, `forward`, `sequence`, `beside`, `above`, `scale`. Add 4 shape cases to each.

The `render` function is already exported from `index.ts`. New helpers (`mkCircle` etc.) and new `CanvasCommand` shape variants must also be exported.

- [ ] **Step 1: Write the failing renderer tests**

Append this `describe` block to `packages/lang/tests/renderer.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// Shape rendering
// ---------------------------------------------------------------------------

describe('shape rendering', () => {
  it('render(circle(50)) emits drawCircle at origin + moveTo', () => {
    expect(render({ kind: 'circle', radius: 50 })).toEqual([
      { kind: 'drawCircle', x: 0, y: 0, radius: 50 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('render(rect(80, 40)) emits drawRect at origin + moveTo', () => {
    expect(render({ kind: 'rect', width: 80, height: 40 })).toEqual([
      { kind: 'drawRect', x: 0, y: 0, width: 80, height: 40 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('render(ellipse(60, 30)) emits drawEllipse at origin + moveTo', () => {
    expect(render({ kind: 'ellipse', rx: 60, ry: 30 })).toEqual([
      { kind: 'drawEllipse', x: 0, y: 0, rx: 60, ry: 30 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('render(triangle(50)) emits drawTriangle at origin + moveTo', () => {
    expect(render({ kind: 'triangle', size: 50 })).toEqual([
      { kind: 'drawTriangle', x: 0, y: 0, size: 50 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('shape position tracks turtle — forward then circle', () => {
    expect(render({ kind: 'sequence', steps: [mkForward(100), { kind: 'circle', radius: 10 }] })).toEqual([
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'drawCircle', x: 0, y: -100, radius: 10 },
      { kind: 'moveTo', x: 0, y: -100 },
    ]);
  });

  it('measure(circle(50)) → { width: 100, height: 100 }', () => {
    expect(measure({ kind: 'circle', radius: 50 })).toEqual({ width: 100, height: 100 });
  });

  it('measure(rect(80, 40)) → { width: 80, height: 40 }', () => {
    expect(measure({ kind: 'rect', width: 80, height: 40 })).toEqual({ width: 80, height: 40 });
  });

  it('scale(2) doubles circle radius', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: { kind: 'circle', radius: 10 } })).toEqual([
      { kind: 'drawCircle', x: 0, y: 0, radius: 20 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
bun test packages/lang/tests/renderer.test.ts
```

Expected: 8 new failures — TypeScript type errors about unknown `kind` values and missing properties.

- [ ] **Step 3: Add 4 Drawing variants to `packages/lang/src/values.ts`**

Find the `Drawing` type union (ends with `| { readonly kind: 'empty' }`). Insert before `| { readonly kind: 'empty' }`:

```typescript
  | { readonly kind: 'circle';   readonly radius: number }
  | { readonly kind: 'rect';     readonly width: number; readonly height: number }
  | { readonly kind: 'ellipse';  readonly rx: number; readonly ry: number }
  | { readonly kind: 'triangle'; readonly size: number }
```

Update the INVARIANT comment to include the new kinds:
```typescript
// INVARIANT: Drawing.kind values ('forward','turn','penUp','penDown','sequence',
// 'beside','above','scale','color','penWidth','empty','circle','rect','ellipse','triangle')
// must never match SproutNumber/String/Symbol/Bool/Function/Var kinds.
```

Append 4 constructor helpers after `mkPenWidth`:

```typescript
export const mkCircle = (radius: number): Drawing =>
  ({ kind: 'circle', radius });

export const mkRect = (width: number, height: number): Drawing =>
  ({ kind: 'rect', width, height });

export const mkEllipse = (rx: number, ry: number): Drawing =>
  ({ kind: 'ellipse', rx, ry });

export const mkTriangle = (size: number): Drawing =>
  ({ kind: 'triangle', size });
```

- [ ] **Step 4: Add 4 CanvasCommand variants to `packages/lang/src/renderer.ts`**

Find the `CanvasCommand` type union (currently ends with `| { readonly kind: 'setLineWidth'; ... }`). Append:

```typescript
  | { readonly kind: 'drawCircle';   readonly x: number; readonly y: number; readonly radius: number }
  | { readonly kind: 'drawRect';     readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly kind: 'drawEllipse';  readonly x: number; readonly y: number; readonly rx: number; readonly ry: number }
  | { readonly kind: 'drawTriangle'; readonly x: number; readonly y: number; readonly size: number }
```

- [ ] **Step 5: Add 4 cases to `scaleDrawing` in `packages/lang/src/renderer.ts`**

Find the `scaleDrawing` switch (currently ends with `case 'scale': return ...`). Insert before the closing `}`:

```typescript
    case 'circle':
      return { kind: 'circle', radius: d.radius * factor };
    case 'rect':
      return { kind: 'rect', width: d.width * factor, height: d.height * factor };
    case 'ellipse':
      return { kind: 'ellipse', rx: d.rx * factor, ry: d.ry * factor };
    case 'triangle':
      return { kind: 'triangle', size: d.size * factor };
```

- [ ] **Step 6: Add 4 cases to `renderInto` in `packages/lang/src/renderer.ts`**

Find the `renderInto` switch (currently ends with `case 'scale': return ...`). Insert before the closing `}`:

```typescript
    case 'circle':
      out.push({ kind: 'drawCircle', x: state.x, y: state.y, radius: drawing.radius });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;

    case 'rect':
      out.push({ kind: 'drawRect', x: state.x, y: state.y, width: drawing.width, height: drawing.height });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;

    case 'ellipse':
      out.push({ kind: 'drawEllipse', x: state.x, y: state.y, rx: drawing.rx, ry: drawing.ry });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;

    case 'triangle':
      out.push({ kind: 'drawTriangle', x: state.x, y: state.y, size: drawing.size });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;
```

- [ ] **Step 7: Add 4 cases to `measureInto` in `packages/lang/src/renderer.ts`**

Find the `measureInto` switch (currently ends with `case 'scale': return ...`). Insert before the closing `}`:

```typescript
    case 'circle':
      bbox.minX = Math.min(bbox.minX, state.x - drawing.radius);
      bbox.maxX = Math.max(bbox.maxX, state.x + drawing.radius);
      bbox.minY = Math.min(bbox.minY, state.y - drawing.radius);
      bbox.maxY = Math.max(bbox.maxY, state.y + drawing.radius);
      return;

    case 'rect':
      bbox.minX = Math.min(bbox.minX, state.x - drawing.width / 2);
      bbox.maxX = Math.max(bbox.maxX, state.x + drawing.width / 2);
      bbox.minY = Math.min(bbox.minY, state.y - drawing.height / 2);
      bbox.maxY = Math.max(bbox.maxY, state.y + drawing.height / 2);
      return;

    case 'ellipse':
      bbox.minX = Math.min(bbox.minX, state.x - drawing.rx);
      bbox.maxX = Math.max(bbox.maxX, state.x + drawing.rx);
      bbox.minY = Math.min(bbox.minY, state.y - drawing.ry);
      bbox.maxY = Math.max(bbox.maxY, state.y + drawing.ry);
      return;

    case 'triangle': {
      const halfW = drawing.size / 2;
      const tipY  = drawing.size * Math.sqrt(3) / 3;   // centroid to tip (upward)
      const baseY = drawing.size * Math.sqrt(3) / 6;   // centroid to base (downward)
      bbox.minX = Math.min(bbox.minX, state.x - halfW);
      bbox.maxX = Math.max(bbox.maxX, state.x + halfW);
      bbox.minY = Math.min(bbox.minY, state.y - tipY);
      bbox.maxY = Math.max(bbox.maxY, state.y + baseY);
      return;
    }
```

- [ ] **Step 8: Export new helpers from `packages/lang/src/index.ts`**

Add `mkCircle`, `mkRect`, `mkEllipse`, `mkTriangle` to the existing values export block:

```typescript
export {
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  mkPenWidth,
  mkCircle,
  mkRect,
  mkEllipse,
  mkTriangle,
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';
```

- [ ] **Step 9: Run tests to verify they pass**

```
bun test
```

Expected: all tests pass, total increases by 8.

- [ ] **Step 10: Commit**

```
git add packages/lang/src/values.ts packages/lang/src/renderer.ts packages/lang/src/index.ts packages/lang/tests/renderer.test.ts
git commit -m "feat(lang): add circle, rect, ellipse, triangle Drawing nodes and CanvasCommands"
```

---

### Task 2: Interpreter shape builtins (TDD)

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

**Background:**

`interpreter.ts` imports named constructors from `values.ts` at the top (currently: `mkForward`, `mkTurn`, etc.). Add `mkCircle`, `mkRect`, `mkEllipse`, `mkTriangle` to that import.

The `isDrawing` function (around line 63) checks `v.kind` — the switch must include all Drawing kinds. Currently ends with `case 'empty': return true`. Add the 4 new shape kinds.

The `BUILTINS` map (around line 118) currently ends with the math builtins. Add 4 shape entries before the closing `]);`.

Test pattern: shape builtins return `Drawing` values directly. Use `interpret(program(exprStmt(call('circle', [numLit(50)]))))` and assert the raw Drawing object.

- [ ] **Step 1: Write the failing tests**

Append to `packages/lang/tests/interpreter.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// Shape builtins
// ---------------------------------------------------------------------------

describe('shape builtins', () => {
  it('circle(50) returns circle Drawing', () => {
    expect(interpret(program(exprStmt(call('circle', [numLit(50)]))))).toEqual({ kind: 'circle', radius: 50 });
  });
  it('rect(80, 40) returns rect Drawing', () => {
    expect(interpret(program(exprStmt(call('rect', [numLit(80), numLit(40)]))))).toEqual({ kind: 'rect', width: 80, height: 40 });
  });
  it('ellipse(60, 30) returns ellipse Drawing', () => {
    expect(interpret(program(exprStmt(call('ellipse', [numLit(60), numLit(30)]))))).toEqual({ kind: 'ellipse', rx: 60, ry: 30 });
  });
  it('triangle(50) returns triangle Drawing', () => {
    expect(interpret(program(exprStmt(call('triangle', [numLit(50)]))))).toEqual({ kind: 'triangle', size: 50 });
  });
  it('circle throws with 0 args', () => {
    expect(() => interpret(program(exprStmt(call('circle', []))))).toThrow(SproutRuntimeError);
  });
  it('rect throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('rect', [numLit(100)]))))).toThrow(SproutRuntimeError);
  });
  it('ellipse throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('ellipse', [numLit(10)]))))).toThrow(SproutRuntimeError);
  });
  it('triangle throws with 0 args', () => {
    expect(() => interpret(program(exprStmt(call('triangle', []))))).toThrow(SproutRuntimeError);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
bun test packages/lang/tests/interpreter.test.ts
```

Expected: 8 new failures — `SproutRuntimeError: Unbound identifier` or similar (builtins don't exist yet).

- [ ] **Step 3: Update `isDrawing` in `packages/lang/src/interpreter.ts`**

Find the `isDrawing` function (around line 63). The switch currently is:

```typescript
    case 'forward': case 'turn': case 'penUp': case 'penDown':
    case 'sequence': case 'beside': case 'above': case 'scale': case 'color': case 'penWidth': case 'empty':
      return true;
```

Replace with:

```typescript
    case 'forward': case 'turn': case 'penUp': case 'penDown':
    case 'sequence': case 'beside': case 'above': case 'scale': case 'color': case 'penWidth': case 'empty':
    case 'circle': case 'rect': case 'ellipse': case 'triangle':
      return true;
```

- [ ] **Step 4: Add `mkCircle`, `mkRect`, `mkEllipse`, `mkTriangle` to the interpreter import**

Find the import from `'./values.js'` (around line 28). Add the 4 new constructors:

```typescript
import {
  type SproutValue,
  type SproutNumber,
  type SproutVar,
  type SproutFunction,
  type Drawing,
  type Env,
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  mkPenWidth,
  mkCircle,
  mkRect,
  mkEllipse,
  mkTriangle,
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';
```

- [ ] **Step 5: Add 4 shape builtins to `BUILTINS` map in `packages/lang/src/interpreter.ts`**

Find the closing `]);` of the `BUILTINS` map (after the `pi` entry). Insert immediately before it:

```typescript
  // --- Shape builtins ---
  ['circle', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`circle expects 1 argument, got ${args.length}`);
    const r = assertNumber(args[0], 'circle');
    return mkCircle(r.value);
  }],
  ['rect', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`rect expects 2 arguments, got ${args.length}`);
    const w = assertNumber(args[0], 'rect (width)');
    const h = assertNumber(args[1], 'rect (height)');
    return mkRect(w.value, h.value);
  }],
  ['ellipse', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`ellipse expects 2 arguments, got ${args.length}`);
    const rx = assertNumber(args[0], 'ellipse (rx)');
    const ry = assertNumber(args[1], 'ellipse (ry)');
    return mkEllipse(rx.value, ry.value);
  }],
  ['triangle', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`triangle expects 1 argument, got ${args.length}`);
    const size = assertNumber(args[0], 'triangle');
    return mkTriangle(size.value);
  }],
```

- [ ] **Step 6: Run tests to verify they pass**

```
bun test
```

Expected: all tests pass, total increases by 8.

- [ ] **Step 7: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add circle, rect, ellipse, triangle interpreter builtins"
```

---

### Task 3: stage-utils shape rendering (TDD)

**Files:**
- Modify: `apps/ide/src/stage-utils.ts`
- Modify: `apps/ide/tests/stage-utils.test.ts`

**Background:**

`drawUpTo` in `stage-utils.ts` loops over `CanvasCommand[]` and renders to a canvas. The switch currently handles: `moveTo`, `lineTo`, `setColor`, `setLineWidth`, `penDown`, `penUp`. Add 4 shape cases.

Shape rendering pattern per command:
1. `ctx.stroke()` — flush the current turtle path
2. Compute `cx = STAGE_W/2 + cmd.x`, `cy = STAGE_H/2 + cmd.y`
3. `ctx.save()` → set `ctx.globalAlpha = 0.35` and `ctx.fillStyle = ctx.strokeStyle as string` → draw path → `ctx.fill()` → `ctx.restore()`
4. Draw path again → `ctx.stroke()`
5. `ctx.beginPath()` → `ctx.moveTo(cx, cy)` — resume turtle path at shape center

For triangle: tip is at `(cx, cy - size*√3/3)`, bottom-left at `(cx - size/2, cy + size*√3/6)`, bottom-right at `(cx + size/2, cy + size*√3/6)`. Use `ctx.closePath()` to close the triangle.

The existing `makeMockCtx()` helper in the test file does not include shape methods. Add a separate `makeShapeMockCtx()` helper.

- [ ] **Step 1: Write the failing shape tests**

Append to `apps/ide/tests/stage-utils.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// Shape drawing
// ---------------------------------------------------------------------------

function makeShapeMockCtx() {
  let globalAlphaValue = 1;
  let fillStyleValue: string = '';
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    ellipse: vi.fn(),
    closePath: vi.fn(),
    get globalAlpha() { return globalAlphaValue; },
    set globalAlpha(v: number) { globalAlphaValue = v; },
    get fillStyle() { return fillStyleValue; },
    set fillStyle(v: string) { fillStyleValue = v; },
    strokeStyle: '#2563eb' as CanvasRenderingContext2D['strokeStyle'],
    lineWidth: 2,
    lineCap: 'round' as CanvasRenderingContext2D['lineCap'],
    lineJoin: 'round' as CanvasRenderingContext2D['lineJoin'],
  } as unknown as CanvasRenderingContext2D;
}

describe('shape drawing', () => {
  it('drawCircle calls arc with correct center and radius', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawCircle', x: 0, y: 0, radius: 50 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.arc).toHaveBeenCalledWith(W / 2, H / 2, 50, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('drawCircle offsets by turtle position', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawCircle', x: 20, y: -30, radius: 10 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.arc).toHaveBeenCalledWith(W / 2 + 20, H / 2 - 30, 10, 0, Math.PI * 2);
  });

  it('drawRect calls rect with correct centered bounds', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawRect', x: 0, y: 0, width: 80, height: 40 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.rect).toHaveBeenCalledWith(W / 2 - 40, H / 2 - 20, 80, 40);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('drawEllipse calls ellipse with correct radii', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawEllipse', x: 0, y: 0, rx: 60, ry: 30 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.ellipse).toHaveBeenCalledWith(W / 2, H / 2, 60, 30, 0, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('drawTriangle calls moveTo/lineTo for triangle vertices', () => {
    const ctx = makeShapeMockCtx();
    const size = 60;
    const commands: CanvasCommand[] = [{ kind: 'drawTriangle', x: 0, y: 0, size }];
    drawUpTo(ctx, commands, 1);
    const cx = W / 2;
    const cy = H / 2;
    const tipY  = size * Math.sqrt(3) / 3;
    const baseY = size * Math.sqrt(3) / 6;
    const halfW = size / 2;
    // Triangle path: tip → bottom-right → bottom-left, then closePath
    // moveTo is called for the tip AND for resuming path at center — check tip call
    expect(ctx.moveTo).toHaveBeenCalledWith(cx, cy - tipY);
    expect(ctx.lineTo).toHaveBeenCalledWith(cx + halfW, cy + baseY);
    expect(ctx.lineTo).toHaveBeenCalledWith(cx - halfW, cy + baseY);
    expect(ctx.fill).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
bun test apps/ide/tests/stage-utils.test.ts
```

Expected: 5 new failures — TypeScript errors about unknown `kind` values on CanvasCommand.

- [ ] **Step 3: Add 4 shape cases to `drawUpTo` in `apps/ide/src/stage-utils.ts`**

Find the `switch (cmd.kind)` in `drawUpTo` (currently the last case before the closing `}` of the loop is `penUp`/`penDown`). Insert before the closing `}` of the switch:

```typescript
      case 'drawCircle': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.arc(cx, cy, cmd.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, cmd.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
      case 'drawRect': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.rect(cx - cmd.width / 2, cy - cmd.height / 2, cmd.width, cmd.height);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.rect(cx - cmd.width / 2, cy - cmd.height / 2, cmd.width, cmd.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
      case 'drawEllipse': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cmd.rx, cmd.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(cx, cy, cmd.rx, cmd.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
      case 'drawTriangle': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        const tipY  = cmd.size * Math.sqrt(3) / 3;
        const baseY = cmd.size * Math.sqrt(3) / 6;
        const halfW = cmd.size / 2;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.moveTo(cx, cy - tipY);
        ctx.lineTo(cx + halfW, cy + baseY);
        ctx.lineTo(cx - halfW, cy + baseY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(cx, cy - tipY);
        ctx.lineTo(cx + halfW, cy + baseY);
        ctx.lineTo(cx - halfW, cy + baseY);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
```

- [ ] **Step 4: Run tests to verify they pass**

```
bun test
```

Expected: all tests pass, total increases by 5.

- [ ] **Step 5: Commit**

```
git add apps/ide/src/stage-utils.ts apps/ide/tests/stage-utils.test.ts
git commit -m "feat(ide): render filled shapes in drawUpTo (circle, rect, ellipse, triangle)"
```

---

### Task 4: Blockly shape blocks + compiler (TDD)

**Files:**
- Create: `packages/blocks/src/definitions/shapes.ts`
- Modify: `packages/blocks/src/definitions/index.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/tests/compiler.test.ts`

**Background:**

Shape blocks are **statement blocks** (like `forward`/`turn`) — they use `setPreviousStatement(true, null)` and `setNextStatement(true, null)`. They do NOT use `setOutput`. Colour `160` (green/teal for shape actions).

In `compiler.ts`, statement blocks are handled in `compileStmt` and then dispatched to `compileExprBlock`. Add the 4 type strings to the existing `case` list in `compileStmt`, then add 4 cases to `compileExprBlock`.

Compiler test pattern: create a workspace, create blocks, connect them (shape blocks connect via `previousConnection`/`nextConnection`), then call `compileWorkspace(ws)` and assert the AST.

- [ ] **Step 1: Write the failing compiler tests**

Append to `packages/blocks/tests/compiler.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// Shape blocks
// ---------------------------------------------------------------------------

describe('shape blocks', () => {
  it('sprout_circle compiles to circle CallExpr', () => {
    const ws = makeWorkspace();
    const circleBlock = ws.newBlock('sprout_circle');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('50', 'NUM');
    circleBlock.getInput('R')!.connection!.connect(numBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: { kind: 'CallExpr', callee: 'circle', args: [{ kind: 'NumberLit', value: 50 }], block: null },
      }],
    });
  });

  it('sprout_rect compiles to rect CallExpr with width and height', () => {
    const ws = makeWorkspace();
    const rectBlock = ws.newBlock('sprout_rect');
    const wNum = ws.newBlock('sprout_number');
    wNum.setFieldValue('80', 'NUM');
    const hNum = ws.newBlock('sprout_number');
    hNum.setFieldValue('40', 'NUM');
    rectBlock.getInput('W')!.connection!.connect(wNum.outputConnection!);
    rectBlock.getInput('H')!.connection!.connect(hNum.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'rect',
          args: [{ kind: 'NumberLit', value: 80 }, { kind: 'NumberLit', value: 40 }],
          block: null,
        },
      }],
    });
  });

  it('sprout_ellipse compiles to ellipse CallExpr with rx and ry', () => {
    const ws = makeWorkspace();
    const ellipseBlock = ws.newBlock('sprout_ellipse');
    const rxNum = ws.newBlock('sprout_number');
    rxNum.setFieldValue('60', 'NUM');
    const ryNum = ws.newBlock('sprout_number');
    ryNum.setFieldValue('30', 'NUM');
    ellipseBlock.getInput('RX')!.connection!.connect(rxNum.outputConnection!);
    ellipseBlock.getInput('RY')!.connection!.connect(ryNum.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'ellipse',
          args: [{ kind: 'NumberLit', value: 60 }, { kind: 'NumberLit', value: 30 }],
          block: null,
        },
      }],
    });
  });

  it('sprout_triangle compiles to triangle CallExpr', () => {
    const ws = makeWorkspace();
    const triBlock = ws.newBlock('sprout_triangle');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('50', 'NUM');
    triBlock.getInput('SIZE')!.connection!.connect(numBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: { kind: 'CallExpr', callee: 'triangle', args: [{ kind: 'NumberLit', value: 50 }], block: null },
      }],
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
bun test packages/blocks/tests/compiler.test.ts
```

Expected: 4 new failures — `Unknown statement block type: sprout_circle` etc.

- [ ] **Step 3: Create `packages/blocks/src/definitions/shapes.ts`**

```typescript
import * as Blockly from 'blockly/node';

export function registerShapeBlocks(): void {
  Blockly.Blocks['sprout_circle'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('R').setCheck(null).appendField('circle');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_rect'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('W').setCheck(null).appendField('rect');
      this.appendValueInput('H').setCheck(null).appendField('×');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_ellipse'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('RX').setCheck(null).appendField('ellipse');
      this.appendValueInput('RY').setCheck(null).appendField('×');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_triangle'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('SIZE').setCheck(null).appendField('triangle');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
}
```

- [ ] **Step 4: Update `packages/blocks/src/definitions/index.ts`**

```typescript
import { registerStatementBlocks } from './statements.js';
import { registerValueBlocks } from './values.js';
import { registerConditionalBlocks } from './conditionals.js';
import { registerVariableBlocks } from './variables.js';
import { registerMathBlocks } from './math.js';
import { registerShapeBlocks } from './shapes.js';

let registered = false;

export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  registerStatementBlocks();
  registerValueBlocks();
  registerConditionalBlocks();
  registerVariableBlocks();
  registerMathBlocks();
  registerShapeBlocks();
}
```

- [ ] **Step 5: Add 4 cases to `compileStmt` in `packages/blocks/src/compiler.ts`**

Find the `compileStmt` switch. The existing list includes `sprout_forward`, `sprout_turn`, etc. Add the 4 shape types to the same group that calls `compileExprBlock`:

```typescript
    case 'sprout_forward':
    case 'sprout_turn':
    case 'sprout_pen_up':
    case 'sprout_pen_down':
    case 'sprout_color':
    case 'sprout_pen_width':
    case 'sprout_puts':
    case 'sprout_repeat':
    case 'sprout_on_event':
    case 'sprout_call_stmt':
    case 'sprout_beside':
    case 'sprout_above':
    case 'sprout_scale':
    case 'sprout_if':
    case 'sprout_while':
    case 'sprout_circle':
    case 'sprout_rect':
    case 'sprout_ellipse':
    case 'sprout_triangle':
      return { kind: 'ExprStmt', expr: compileExprBlock(block) };
```

- [ ] **Step 6: Add 4 cases to `compileExprBlock` in `packages/blocks/src/compiler.ts`**

Find the `compileExprBlock` switch. The `default:` throw is the last case. Insert immediately before it:

```typescript
    case 'sprout_circle': {
      const r = compileExpr(mustGetInput(block, 'R'));
      return { kind: 'CallExpr', callee: 'circle', args: [r], block: null };
    }
    case 'sprout_rect': {
      const w = compileExpr(mustGetInput(block, 'W'));
      const h = compileExpr(mustGetInput(block, 'H'));
      return { kind: 'CallExpr', callee: 'rect', args: [w, h], block: null };
    }
    case 'sprout_ellipse': {
      const rx = compileExpr(mustGetInput(block, 'RX'));
      const ry = compileExpr(mustGetInput(block, 'RY'));
      return { kind: 'CallExpr', callee: 'ellipse', args: [rx, ry], block: null };
    }
    case 'sprout_triangle': {
      const size = compileExpr(mustGetInput(block, 'SIZE'));
      return { kind: 'CallExpr', callee: 'triangle', args: [size], block: null };
    }
```

- [ ] **Step 7: Run tests to verify they pass**

```
bun test
```

Expected: all tests pass, total increases by 4.

- [ ] **Step 8: Commit**

```
git add packages/blocks/src/definitions/shapes.ts packages/blocks/src/definitions/index.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add shape block definitions and compiler cases"
```

---

### Task 5: Add Shapes section to toolbox

**Files:**
- Modify: `apps/ide/src/BlockWorkspace.tsx`

**Background:**

The `TOOLBOX` constant in `BlockWorkspace.tsx` has a flat `contents` array. The "Math" section ends with `sprout_pi`. The "Output" section starts with `sprout_puts`. Add a "Shapes" section between them.

- [ ] **Step 1: Update the toolbox in `apps/ide/src/BlockWorkspace.tsx`**

Find the `// Output` comment (the line before `{ kind: 'block', type: 'sprout_puts' }`). Insert immediately before it:

```typescript
    // Shapes
    { kind: 'block', type: 'sprout_circle' },
    { kind: 'block', type: 'sprout_rect' },
    { kind: 'block', type: 'sprout_ellipse' },
    { kind: 'block', type: 'sprout_triangle' },
```

- [ ] **Step 2: Run tests**

```
bun test
```

Expected: all tests pass (no count change — toolbox has no unit tests).

- [ ] **Step 3: Commit**

```
git add apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(ide): add Shapes section to toolbox"
```

---

## Done

After all five tasks, users can:
- Call `circle(50)`, `rect(80, 40)`, `ellipse(60, 30)`, `triangle(50)` in the text editor
- Drag shape blocks from the Shapes section in the block editor
- Shapes render filled (35% opacity, current color) + stroked at the turtle's current position
- `color()` controls both fill and stroke color for shapes
- `scale()` correctly scales shape dimensions
- `beside()` and `above()` correctly lay out drawings that include shapes
