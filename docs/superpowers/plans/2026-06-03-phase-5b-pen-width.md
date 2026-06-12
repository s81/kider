# Phase 5b — Pen Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `penWidth(n)` builtin that sets the turtle's stroke line width, so subsequent drawing commands render at the chosen thickness.

**Architecture:** `penWidth` becomes a new `Drawing` node (`{ kind: 'penWidth'; width: number }`). The interpreter validates the number argument (must be > 0) and produces the Drawing node. The renderer emits a `setLineWidth` CanvasCommand followed by a `moveTo` to re-anchor the new path. `drawUpTo` in `stage-utils.ts` strokes and restarts the path on `setLineWidth`, then sets `ctx.lineWidth`. A `sprout_pen_width` Blockly block with a number input is added to the blocks package. Line width is a visual property — it is NOT multiplied by `scale()` factors (same decision as `color`).

**Tech Stack:** TypeScript, Vitest, Blockly

**Dependencies:** None (independent of other Phase 5 plans).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/lang/src/values.ts` | Add `penWidth` Drawing variant + `mkPenWidth` constructor |
| Modify | `packages/lang/src/interpreter.ts` | Add `penWidth` builtin (number → Drawing, validate > 0), update `isDrawing` guard |
| Modify | `packages/lang/src/renderer.ts` | Add `setLineWidth` CanvasCommand, handle `penWidth` in renderInto/scaleDrawing/measureInto |
| Modify | `packages/lang/src/index.ts` | Export `mkPenWidth` |
| Modify | `packages/lang/tests/interpreter.test.ts` | Tests for `penWidth` builtin |
| Modify | `packages/lang/tests/renderer.test.ts` | Tests for `setLineWidth` in rendered commands |
| Modify | `apps/ide/src/stage-utils.ts` | Handle `setLineWidth` command in `drawUpTo` |
| Modify | `apps/ide/tests/stage-utils.test.ts` | Tests for `setLineWidth` handling |
| Modify | `packages/blocks/src/definitions/statements.ts` | Add `sprout_pen_width` block definition |
| Modify | `packages/blocks/src/compiler.ts` | Compile `sprout_pen_width` block to `CallExpr` |
| Modify | `packages/blocks/tests/compiler.test.ts` | Test for `sprout_pen_width` block |

---

### Task 1: Add `penWidth` Drawing node + builtin to lang

**Files:**
- Modify: `packages/lang/src/values.ts`
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/lang/tests/interpreter.test.ts` (after the last `});` at the end of the file):

```typescript
// ---------------------------------------------------------------------------
// penWidth builtin
// ---------------------------------------------------------------------------
describe('penWidth builtin', () => {
  it('penWidth(3) returns a penWidth Drawing', () => {
    const prog = program(exprStmt(call('penWidth', [numLit(3)])));
    expect(interpret(prog)).toEqual(mkSequence([mkPenWidth(3)]));
  });

  it('penWidth(0.5) returns a penWidth Drawing with fractional width', () => {
    const prog = program(exprStmt(call('penWidth', [numLit(0.5)])));
    expect(interpret(prog)).toEqual(mkSequence([mkPenWidth(0.5)]));
  });

  it('penWidth with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('penWidth', [])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('penWidth with non-number argument throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('penWidth', [{ kind: 'SymbolLit' as const, name: 'thick' }])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('penWidth(0) throws SproutRuntimeError — width must be > 0', () => {
    const prog = program(exprStmt(call('penWidth', [numLit(0)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('penWidth(-1) throws SproutRuntimeError — width must be > 0', () => {
    const prog = program(exprStmt(call('penWidth', [numLit(-1)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('penWidth inside a sequence composes correctly', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('penWidth', [numLit(5)])),
      exprStmt(call('forward', [numLit(50)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([
      mkForward(100),
      mkPenWidth(5),
      mkForward(50),
    ]));
  });
});
```

Also add `mkPenWidth` to the imports at the top of the test file. The existing import block is:

```typescript
import {
  EMPTY,
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  PEN_UP,
  PEN_DOWN,
} from '../src/values.js';
```

Replace with:

```typescript
import {
  EMPTY,
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  mkPenWidth,
  PEN_UP,
  PEN_DOWN,
} from '../src/values.js';
```

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run packages/lang/tests/interpreter.test.ts
```

Expected: FAIL — `mkPenWidth` is not exported from `values.js`.

- [ ] **Step 3: Add `penWidth` Drawing node to `packages/lang/src/values.ts`**

The current `Drawing` union ends with the `color` variant before `empty`. Add `penWidth` after `color`:

Find this block:
```typescript
  | { readonly kind: 'color';    readonly color: string }
  | { readonly kind: 'empty' };
```

Replace with:
```typescript
  | { readonly kind: 'color';    readonly color: string }
  | { readonly kind: 'penWidth'; readonly width: number }
  | { readonly kind: 'empty' };
```

Update the INVARIANT comment. Find:
```typescript
// INVARIANT: Drawing.kind values ('forward','turn','penUp','penDown','sequence',
// 'beside','above','scale','color','empty') must never match SproutNumber/String/Symbol/Bool/Function kinds.
```

Replace with:
```typescript
// INVARIANT: Drawing.kind values ('forward','turn','penUp','penDown','sequence',
// 'beside','above','scale','color','penWidth','empty') must never match SproutNumber/String/Symbol/Bool/Function kinds.
```

Also update the comment block at the top of the Drawing section. Find:
```typescript
// `color`    sets the stroke color for subsequent drawing commands.
// `empty`    is the identity element for composition.
```

Replace with:
```typescript
// `color`    sets the stroke color for subsequent drawing commands.
// `penWidth` sets the stroke line width for subsequent drawing commands.
// `empty`    is the identity element for composition.
```

Add the constructor after `mkColor`. Find:
```typescript
export const mkColor = (color: string): Drawing =>
  ({ kind: 'color', color });

export const EMPTY: Drawing = { kind: 'empty' };
```

Replace with:
```typescript
export const mkColor = (color: string): Drawing =>
  ({ kind: 'color', color });

export const mkPenWidth = (width: number): Drawing =>
  ({ kind: 'penWidth', width });

export const EMPTY: Drawing = { kind: 'empty' };
```

- [ ] **Step 4: Add `penWidth` builtin to `packages/lang/src/interpreter.ts`**

Import `mkPenWidth`. Find:
```typescript
  mkColor,
  PEN_UP,
```

Replace with:
```typescript
  mkColor,
  mkPenWidth,
  PEN_UP,
```

Update `isDrawing` to include `'penWidth'`. Find:
```typescript
    case 'sequence': case 'beside': case 'above': case 'scale': case 'color': case 'empty':
```

Replace with:
```typescript
    case 'sequence': case 'beside': case 'above': case 'scale': case 'color': case 'penWidth': case 'empty':
```

Add the builtin to `BUILTINS` immediately before `['color', ...]`. Find:
```typescript
  ['color', (args) => {
```

Insert before it:
```typescript
  ['penWidth', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`penWidth expects 1 argument, got ${args.length}`);
    const w = assertNumber(args[0], 'penWidth');
    if (w.value <= 0) throw new SproutRuntimeError(`penWidth: width must be > 0, got ${w.value}`);
    return mkPenWidth(w.value);
  }],
  ['color', (args) => {
```

- [ ] **Step 5: Run tests to confirm they pass**

```
bun run vitest run packages/lang/tests/interpreter.test.ts
```

Expected: All tests pass (including the 7 new penWidth tests, total 55).

- [ ] **Step 6: Commit**

```
git add packages/lang/src/values.ts packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add penWidth() builtin and penWidth Drawing node"
```

---

### Task 2: Add `setLineWidth` CanvasCommand and handle `penWidth` in renderer

**Files:**
- Modify: `packages/lang/src/renderer.ts`
- Modify: `packages/lang/tests/renderer.test.ts`

- [ ] **Step 1: Write failing tests**

Add `mkPenWidth` to the import block at the top of `packages/lang/tests/renderer.test.ts`. Find:
```typescript
import {
  EMPTY,
  PEN_UP,
  PEN_DOWN,
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
} from '../src/values.js';
```

Replace with:
```typescript
import {
  EMPTY,
  PEN_UP,
  PEN_DOWN,
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  mkPenWidth,
} from '../src/values.js';
```

Append to `packages/lang/tests/renderer.test.ts` (after the last `});`):

```typescript
// ---------------------------------------------------------------------------
// penWidth Drawing node in renderer
// ---------------------------------------------------------------------------
describe('render(penWidth)', () => {
  it('penWidth alone emits setLineWidth + moveTo at origin', () => {
    expect(render(mkPenWidth(4))).toEqual([
      { kind: 'setLineWidth', width: 4 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('forward + penWidth + forward emits setLineWidth and moveTo re-anchor', () => {
    const drawing = mkSequence([
      mkForward(100),
      mkPenWidth(4),
      mkForward(50),
    ]);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -100),
      { kind: 'setLineWidth', width: 4 },
      { kind: 'moveTo', x: 0, y: -100 },
      lineTo(0, -150),
    ]);
  });

  it('penWidth does not affect bounding box — measure ignores it', () => {
    const drawing = mkSequence([mkPenWidth(4), mkForward(100)]);
    const result = measure(drawing);
    expect(result.height).toBeCloseTo(100, 10);
    expect(result.width).toBeCloseTo(0, 10);
  });

  it('scale does not scale penWidth — width passes through unchanged', () => {
    const drawing = mkScale(2, mkSequence([mkForward(10), mkPenWidth(3), mkForward(10)]));
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -20),
      { kind: 'setLineWidth', width: 3 },
      { kind: 'moveTo', x: 0, y: -20 },
      lineTo(0, -40),
    ]);
  });
});
```

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run packages/lang/tests/renderer.test.ts
```

Expected: FAIL — `mkPenWidth` is not exported and `setLineWidth` kind is unknown.

- [ ] **Step 3: Implement changes to `packages/lang/src/renderer.ts`**

Add `setLineWidth` to the `CanvasCommand` union. Find:
```typescript
  | { readonly kind: 'setColor'; readonly color: string };
```

Replace with:
```typescript
  | { readonly kind: 'setColor'; readonly color: string }
  | { readonly kind: 'setLineWidth'; readonly width: number };
```

In `scaleDrawing`, add `penWidth` to the no-op cases (line width is not scaled). Find:
```typescript
    case 'turn':
    case 'penUp':
    case 'penDown':
    case 'color':
    case 'empty':
      return d;
```

Replace with:
```typescript
    case 'turn':
    case 'penUp':
    case 'penDown':
    case 'color':
    case 'penWidth':
    case 'empty':
      return d;
```

In `renderInto`, add the `penWidth` case immediately after the `color` case. Find:
```typescript
    case 'color':
      out.push({ kind: 'setColor', color: drawing.color });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;

    case 'turn':
```

Replace with:
```typescript
    case 'color':
      out.push({ kind: 'setColor', color: drawing.color });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;

    case 'penWidth':
      out.push({ kind: 'setLineWidth', width: drawing.width });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;

    case 'turn':
```

In `measureInto`, add `penWidth` to the no-op early return. Find:
```typescript
    case 'empty':
    case 'penUp':
    case 'penDown':
    case 'color':
      return;
```

Replace with:
```typescript
    case 'empty':
    case 'penUp':
    case 'penDown':
    case 'color':
    case 'penWidth':
      return;
```

- [ ] **Step 4: Run tests to confirm they pass**

```
bun run vitest run packages/lang/tests/renderer.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

```
bun run vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```
git add packages/lang/src/renderer.ts packages/lang/tests/renderer.test.ts
git commit -m "feat(lang): add setLineWidth CanvasCommand; renderer handles penWidth Drawing node"
```

---

### Task 3: Update `stage-utils.ts` to handle `setLineWidth`

**Files:**
- Modify: `apps/ide/src/stage-utils.ts`
- Modify: `apps/ide/tests/stage-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `apps/ide/tests/stage-utils.test.ts` (inside the `describe('drawUpTo', ...)` block, before the closing `});`):

```typescript
  it('setLineWidth flushes current path and begins a new one with new lineWidth', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'setLineWidth', width: 4 },
      { kind: 'moveTo', x: 0, y: -100 },
      { kind: 'lineTo', x: 100, y: -100 },
    ];
    drawUpTo(ctx, commands, 4);
    // stroke called twice: once on setLineWidth, once at end
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    // beginPath called twice: once initial setup, once on setLineWidth
    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
    // lineWidth ends with the new value
    expect(ctx.lineWidth).toBe(4);
  });

  it('setLineWidth at limit boundary stops before flushing if not reached', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'setLineWidth', width: 4 },
      { kind: 'lineTo', x: 100, y: -100 },
    ];
    // limit=1: only the first lineTo, no setLineWidth
    drawUpTo(ctx, commands, 1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1); // only final stroke
    expect(ctx.lineWidth).toBe(2); // default lineWidth unchanged
  });
```

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run apps/ide/tests/stage-utils.test.ts
```

Expected: FAIL — TypeScript error: `setLineWidth` is not in the `CanvasCommand` type (it's in `@sprout/lang`), and the switch in `drawUpTo` doesn't handle it.

- [ ] **Step 3: Implement `setLineWidth` handling in `apps/ide/src/stage-utils.ts`**

In the switch inside `drawUpTo`, add a case for `setLineWidth` immediately after the `setColor` case. Find:
```typescript
      case 'setColor':
        // Flush the current path in the old color, start a new path in the new color.
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = cmd.color;
        break;
      case 'penDown':
```

Replace with:
```typescript
      case 'setColor':
        // Flush the current path in the old color, start a new path in the new color.
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = cmd.color;
        break;
      case 'setLineWidth':
        // Flush the current path with the old width, start a new path at the new width.
        ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = cmd.width;
        break;
      case 'penDown':
```

- [ ] **Step 4: Run tests to confirm they pass**

```
bun run vitest run apps/ide/tests/stage-utils.test.ts
```

Expected: All 9 tests pass.

- [ ] **Step 5: Run full test suite**

```
bun run vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```
git add apps/ide/src/stage-utils.ts apps/ide/tests/stage-utils.test.ts
git commit -m "feat(ide): drawUpTo handles setLineWidth — flushes path and restarts with new lineWidth"
```

---

### Task 4: Add `sprout_pen_width` block to blocks package

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/blocks/tests/compiler.test.ts` (after the last `});` at end of file):

```typescript
  it('compiles sprout_pen_width block to penWidth(3) CallExpr', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_pen_width');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('3', 'NUM');
    block.getInput('WIDTH')!.connection!.connect(numBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'penWidth',
          args: [{ kind: 'NumberLit', value: 3 }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });
```

Note: this test goes inside the existing `describe` block that wraps all compiler tests. Look at the end of the file — the final test is `'compiles sprout_color block...'`, and the `describe` block closes right after it. Add the new test before that closing `});`.

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run packages/blocks/tests/compiler.test.ts
```

Expected: FAIL — `sprout_pen_width` block is not registered.

- [ ] **Step 3: Add `sprout_pen_width` block to `packages/blocks/src/definitions/statements.ts`**

Add after the `sprout_color` block definition (after its closing `};`). Find:
```typescript
  Blockly.Blocks['sprout_color'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('color')
        .appendField(
          new Blockly.FieldDropdown([
            ['red',    'red'],
            ['blue',   'blue'],
            ['green',  'green'],
            ['orange', 'orange'],
            ['purple', 'purple'],
            ['black',  'black'],
            ['yellow', 'yellow'],
            ['pink',   'pink'],
          ]) as unknown as Blockly.Field,
          'COLOR',
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
    },
  };
```

Add immediately after:
```typescript
  Blockly.Blocks['sprout_pen_width'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('WIDTH').setCheck('Number').appendField('pen width');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
    },
  };
```

- [ ] **Step 4: Update `packages/blocks/src/compiler.ts`**

Add `'sprout_pen_width'` to the `compileStmt` switch, in the group of cases that delegate to `compileExprBlock`. Find:
```typescript
    case 'sprout_forward':
    case 'sprout_turn':
    case 'sprout_pen_up':
    case 'sprout_pen_down':
    case 'sprout_color':
    case 'sprout_puts':
```

Replace with:
```typescript
    case 'sprout_forward':
    case 'sprout_turn':
    case 'sprout_pen_up':
    case 'sprout_pen_down':
    case 'sprout_color':
    case 'sprout_pen_width':
    case 'sprout_puts':
```

Add to `compileExprBlock` immediately after the `sprout_color` case. Find:
```typescript
    case 'sprout_color': {
      const colorName = block.getFieldValue('COLOR') as string;
      return {
        kind: 'CallExpr',
        callee: 'color',
        args: [{ kind: 'SymbolLit', name: colorName }],
        block: null,
      };
    }
    case 'sprout_puts':
```

Replace with:
```typescript
    case 'sprout_color': {
      const colorName = block.getFieldValue('COLOR') as string;
      return {
        kind: 'CallExpr',
        callee: 'color',
        args: [{ kind: 'SymbolLit', name: colorName }],
        block: null,
      };
    }
    case 'sprout_pen_width': {
      const width = compileExpr(mustGetInput(block, 'WIDTH'));
      return { kind: 'CallExpr', callee: 'penWidth', args: [width], block: null };
    }
    case 'sprout_puts':
```

- [ ] **Step 5: Run tests to confirm they pass**

```
bun run vitest run packages/blocks/tests/compiler.test.ts
```

Expected: All tests pass (7 total).

- [ ] **Step 6: Run full test suite**

```
bun run vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add sprout_pen_width block with number input"
```

---

### Task 5: Export `mkPenWidth` from public API

**Files:**
- Modify: `packages/lang/src/index.ts`

- [ ] **Step 1: Add `mkPenWidth` to the export list**

In `packages/lang/src/index.ts`, find:
```typescript
export {
  // Drawing constructors
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  // Drawing singleton constants (zero-arg constructors replaced by constants)
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';
```

Replace with:
```typescript
export {
  // Drawing constructors
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  mkPenWidth,
  // Drawing singleton constants (zero-arg constructors replaced by constants)
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';
```

- [ ] **Step 2: Run full test suite**

```
bun run vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```
git add packages/lang/src/index.ts
git commit -m "feat(lang): export mkPenWidth from public @sprout/lang index"
```

---

## Self-Review Checklist

**Spec coverage:**
- `penWidth(3)` → `{ kind: 'penWidth', width: 3 }` Drawing ✓
- `penWidth(0)` / `penWidth(-1)` → `SproutRuntimeError` ✓
- `penWidth(:thick)` (non-number) → `SproutRuntimeError` ✓
- Renderer emits `setLineWidth` + `moveTo` re-anchor on `penWidth` node ✓
- `scaleDrawing` passes `penWidth` unchanged (width doesn't scale) ✓
- `measureInto` ignores `penWidth` (no geometry change) ✓
- `drawUpTo` strokes current path + begins new path on `setLineWidth` ✓
- `sprout_pen_width` block compiles to `penWidth(n)` CallExpr with number input ✓
- `mkPenWidth` exported from `@sprout/lang` ✓

**Placeholder scan:** No TBD, TODO, or vague steps — every step has exact code.

**Type consistency:**
- `mkPenWidth` defined in Task 1, imported in Task 2 test, exported in Task 5 ✓
- `setLineWidth` CanvasCommand defined in Task 2 renderer, consumed in Task 3 stage-utils ✓
- `sprout_pen_width` block name consistent across statements.ts / compiler.ts / compiler.test.ts ✓
- Input name `'WIDTH'` consistent between block definition and compiler ✓
