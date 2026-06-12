# Phase 5a — Color Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `color(:red)` builtin that sets the turtle's stroke color, so subsequent drawing commands render in the chosen color.

**Architecture:** `color` becomes a new `Drawing` node (`{ kind: 'color'; color: string }`). The interpreter maps symbol names (`:red`, `:blue`, etc.) to hex strings and produces the Drawing node. The renderer emits a `setColor` CanvasCommand followed by a `moveTo` to re-anchor the new path. `drawUpTo` in `stage-utils.ts` strokes and restarts the path on `setColor`. A `sprout_color` Blockly block with a color dropdown is added to the blocks package.

**Tech Stack:** TypeScript, Vitest, Blockly

**Dependencies:** None (independent of other Phase 5 plans).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/lang/src/values.ts` | Add `color` Drawing variant + `mkColor` constructor |
| Modify | `packages/lang/src/interpreter.ts` | Add `color` builtin (symbol→hex), update `isDrawing` guard |
| Modify | `packages/lang/src/renderer.ts` | Add `setColor` CanvasCommand, handle `color` in renderInto/scaleDrawing/measureInto |
| Modify | `packages/lang/src/index.ts` | Export `mkColor`, export `setColor` in CanvasCommand type |
| Modify | `packages/lang/tests/interpreter.test.ts` | Tests for `color` builtin |
| Modify | `packages/lang/tests/renderer.test.ts` | Tests for `setColor` in rendered commands |
| Modify | `apps/ide/src/stage-utils.ts` | Handle `setColor` command in `drawUpTo` |
| Modify | `apps/ide/tests/stage-utils.test.ts` | Tests for `setColor` handling |
| Modify | `packages/blocks/src/definitions/statements.ts` | Add `sprout_color` block definition |
| Modify | `packages/blocks/src/compiler.ts` | Compile `sprout_color` block to `CallExpr` |
| Modify | `packages/blocks/tests/compiler.test.ts` | Test for `sprout_color` block |

---

### Task 1: Add `color` Drawing node + builtin to lang

**Files:**
- Modify: `packages/lang/src/values.ts`
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/lang/tests/interpreter.test.ts` (after existing tests):

```typescript
// ---------------------------------------------------------------------------
// color builtin
// ---------------------------------------------------------------------------
describe('color builtin', () => {
  it('color(:red) returns a color Drawing with hex #dc2626', () => {
    const prog = program(exprStmt(call('color', [{ kind: 'SymbolLit' as const, name: 'red' }])));
    const result = interpret(prog);
    expect(result).toEqual({ kind: 'color', color: '#dc2626' });
  });

  it('color(:blue) returns #2563eb', () => {
    const prog = program(exprStmt(call('color', [{ kind: 'SymbolLit' as const, name: 'blue' }])));
    expect(interpret(prog)).toEqual({ kind: 'color', color: '#2563eb' });
  });

  it('color with unknown symbol throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('color', [{ kind: 'SymbolLit' as const, name: 'turquoise' }])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('color with non-symbol argument throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('color', [numLit(1)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('color inside a sequence composes correctly', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('color', [{ kind: 'SymbolLit' as const, name: 'red' }])),
      exprStmt(call('forward', [numLit(50)])),
    );
    const result = interpret(prog);
    expect(result).toEqual(mkSequence([
      mkForward(100),
      { kind: 'color', color: '#dc2626' },
      mkForward(50),
    ]));
  });
});
```

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run packages/lang/tests/interpreter.test.ts
```

Expected: FAIL — `color` is not a recognized builtin.

- [ ] **Step 3: Add `color` Drawing node to `packages/lang/src/values.ts`**

Add to the `Drawing` union (after the `empty` variant):

```typescript
export type Drawing =
  | { readonly kind: 'forward';  readonly distance: number }
  | { readonly kind: 'turn';     readonly degrees: number }
  | { readonly kind: 'penUp' }
  | { readonly kind: 'penDown' }
  | { readonly kind: 'sequence'; readonly steps: readonly Drawing[] }
  | { readonly kind: 'beside';   readonly left: Drawing; readonly right: Drawing }
  | { readonly kind: 'above';    readonly top: Drawing; readonly bottom: Drawing }
  | { readonly kind: 'scale';    readonly factor: number; readonly drawing: Drawing }
  | { readonly kind: 'color';    readonly color: string }
  | { readonly kind: 'empty' };
```

Also update the comment block at the top of the Drawing section:
```typescript
// `color`    sets the stroke color for subsequent drawing commands.
```

Add the constructor at the bottom of the constructors section:

```typescript
export const mkColor = (color: string): Drawing =>
  ({ kind: 'color', color });
```

Also update the INVARIANT comment to include `'color'`:
```typescript
// INVARIANT: Drawing.kind values ('forward','turn','penUp','penDown','sequence',
// 'beside','above','scale','color','empty') must never match SproutNumber/String/Symbol/Bool/Function kinds.
```

- [ ] **Step 4: Add `color` builtin to `packages/lang/src/interpreter.ts`**

First, import `mkColor` from values:
```typescript
import {
  type SproutValue,
  type SproutNumber,
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
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';
```

Update `isDrawing` to include `'color'`:
```typescript
function isDrawing(v: SproutValue): v is Drawing {
  switch (v.kind) {
    case 'forward': case 'turn': case 'penUp': case 'penDown':
    case 'sequence': case 'beside': case 'above': case 'scale': case 'color': case 'empty':
      return true;
    default:
      return false;
  }
}
```

Add the color name→hex map and builtin to `BUILTINS` (before the closing `])`):

```typescript
const COLOR_MAP: Readonly<Record<string, string>> = {
  red:    '#dc2626',
  blue:   '#2563eb',
  green:  '#16a34a',
  orange: '#ea580c',
  purple: '#9333ea',
  black:  '#000000',
  white:  '#ffffff',
  yellow: '#ca8a04',
  pink:   '#db2777',
};
```

Add to BUILTINS (before `['puts', ...]`):

```typescript
  ['color', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`color expects 1 argument, got ${args.length}`);
    const sym = args[0];
    if (sym.kind !== 'symbol') {
      throw new SproutRuntimeError(`color expects a symbol like :red, got ${sym.kind}`);
    }
    const hex = COLOR_MAP[sym.name];
    if (hex === undefined) {
      throw new SproutRuntimeError(
        `Unknown color: :${sym.name}. Available: ${Object.keys(COLOR_MAP).map(k => ':' + k).join(', ')}`
      );
    }
    return mkColor(hex);
  }],
```

- [ ] **Step 5: Run tests to confirm they pass**

```
bun run vitest run packages/lang/tests/interpreter.test.ts
```

Expected: All tests pass (including the 5 new color tests).

- [ ] **Step 6: Commit**

```
git add packages/lang/src/values.ts packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add color() builtin and color Drawing node"
```

---

### Task 2: Add `setColor` CanvasCommand and handle `color` in renderer

**Files:**
- Modify: `packages/lang/src/renderer.ts`
- Modify: `packages/lang/tests/renderer.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/lang/tests/renderer.test.ts`:

```typescript
import { mkColor } from '../src/values.js';

// ---------------------------------------------------------------------------
// color Drawing node in renderer
// ---------------------------------------------------------------------------
describe('render(color)', () => {
  it('color alone emits setColor + moveTo at origin', () => {
    expect(render(mkColor('#dc2626'))).toEqual([
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('forward + color + forward emits setColor and moveTo re-anchor', () => {
    const drawing = mkSequence([
      mkForward(100),
      mkColor('#dc2626'),
      mkForward(50),
    ]);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -100),
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'moveTo', x: 0, y: -100 },
      lineTo(0, -150),
    ]);
  });

  it('color does not affect bounding box — measure ignores it', () => {
    const drawing = mkSequence([mkColor('#dc2626'), mkForward(100)]);
    const result = measure(drawing);
    expect(result.height).toBeCloseTo(100, 10);
    expect(result.width).toBeCloseTo(0, 10);
  });

  it('scale passes color through unchanged', () => {
    const drawing = mkScale(2, mkSequence([mkForward(10), mkColor('#dc2626'), mkForward(10)]));
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -20),
      { kind: 'setColor', color: '#dc2626' },
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

Expected: FAIL — `mkColor` is not imported and `setColor` kind is unknown.

- [ ] **Step 3: Implement changes to `packages/lang/src/renderer.ts`**

Add `setColor` to the `CanvasCommand` union:

```typescript
export type CanvasCommand =
  | { readonly kind: 'moveTo'; readonly x: number; readonly y: number }
  | { readonly kind: 'lineTo'; readonly x: number; readonly y: number }
  | { readonly kind: 'penDown' }
  | { readonly kind: 'penUp' }
  | { readonly kind: 'setColor'; readonly color: string };
```

In `scaleDrawing`, add `color` case (color is unaffected by scale):

```typescript
function scaleDrawing(factor: number, d: Drawing): Drawing {
  switch (d.kind) {
    case 'forward':
      return { kind: 'forward', distance: d.distance * factor };
    case 'turn':
    case 'penUp':
    case 'penDown':
    case 'color':
    case 'empty':
      return d;
    case 'sequence':
      return { kind: 'sequence', steps: d.steps.map(s => scaleDrawing(factor, s)) };
    case 'beside':
      return { kind: 'beside', left: scaleDrawing(factor, d.left), right: scaleDrawing(factor, d.right) };
    case 'above':
      return { kind: 'above', top: scaleDrawing(factor, d.top), bottom: scaleDrawing(factor, d.bottom) };
    case 'scale':
      return { kind: 'scale', factor: d.factor * factor, drawing: d.drawing };
  }
}
```

In `renderInto`, add `color` case after `penDown`:

```typescript
    case 'color':
      // Flush the current path with the old color, then start a new path in the new color.
      // Emit moveTo at the current turtle position to anchor the new path.
      out.push({ kind: 'setColor', color: drawing.color });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;
```

In `measureInto`, add `color` case (no geometry change):

```typescript
    case 'color':
      return;
```

Also update the `roundCmd` helper in the test file — add a branch for `setColor` so it passes through (or just leave it: `setColor` has no numeric fields to round). The current `roundCmd` function returns `c` for non-moveTo/lineTo kinds, which covers `setColor` correctly.

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
git commit -m "feat(lang): add setColor CanvasCommand; renderer handles color Drawing node"
```

---

### Task 3: Update `stage-utils.ts` to handle `setColor`

**Files:**
- Modify: `apps/ide/src/stage-utils.ts`
- Modify: `apps/ide/tests/stage-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `apps/ide/tests/stage-utils.test.ts`:

```typescript
  it('setColor flushes current path and begins a new one with new strokeStyle', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'moveTo', x: 0, y: -100 },
      { kind: 'lineTo', x: 100, y: -100 },
    ];
    drawUpTo(ctx, commands, 4);
    // stroke called twice: once on setColor, once at end
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    // beginPath called twice: once initial setup, once on setColor
    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
    // strokeStyle ends with the new color
    expect(ctx.strokeStyle).toBe('#dc2626');
  });

  it('setColor at limit boundary stops before flushing if not reached', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'lineTo', x: 100, y: -100 },
    ];
    // limit=1: only the first lineTo, no setColor
    drawUpTo(ctx, commands, 1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1); // only final stroke
    expect(ctx.strokeStyle).toBe('#2563eb'); // default color unchanged
  });
```

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run apps/ide/tests/stage-utils.test.ts
```

Expected: FAIL — `setColor` is not handled (it would hit the implicit `undefined` case in the switch and do nothing, but the assertion `stroke.toHaveBeenCalledTimes(2)` would fail).

- [ ] **Step 3: Implement `setColor` handling in `apps/ide/src/stage-utils.ts`**

Replace the entire `drawUpTo` function:

```typescript
export function drawUpTo(
  ctx: CanvasRenderingContext2D,
  commands: CanvasCommand[],
  limit: number,
): void {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  if (limit === 0) return;

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(STAGE_W / 2, STAGE_H / 2);

  for (let i = 0; i < limit; i++) {
    const cmd = commands[i];
    switch (cmd.kind) {
      case 'moveTo':
        ctx.moveTo(STAGE_W / 2 + cmd.x, STAGE_H / 2 + cmd.y);
        break;
      case 'lineTo':
        ctx.lineTo(STAGE_W / 2 + cmd.x, STAGE_H / 2 + cmd.y);
        break;
      case 'setColor':
        // Flush the current path in the old color, start a new path in the new color.
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = cmd.color;
        break;
      case 'penDown':
      case 'penUp':
        break;
    }
  }
  ctx.stroke();
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
bun run vitest run apps/ide/tests/stage-utils.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 5: Run full test suite**

```
bun run vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```
git add apps/ide/src/stage-utils.ts apps/ide/tests/stage-utils.test.ts
git commit -m "feat(ide): drawUpTo handles setColor — flushes path and restarts with new strokeStyle"
```

---

### Task 4: Add `sprout_color` block to blocks package

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/blocks/tests/compiler.test.ts`:

```typescript
  it('compiles sprout_color block to color(:red) CallExpr', () => {
    const ws = new Blockly.Workspace();
    const block = ws.newBlock('sprout_color');
    block.setFieldValue('red', 'COLOR');
    ws.topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'color',
          args: [{ kind: 'SymbolLit', name: 'red' }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });
```

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run packages/blocks/tests/compiler.test.ts
```

Expected: FAIL — `sprout_color` block is not registered.

- [ ] **Step 3: Add `sprout_color` block to `packages/blocks/src/definitions/statements.ts`**

Add after the `sprout_pen_down` block definition:

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

- [ ] **Step 4: Update `packages/blocks/src/compiler.ts`**

Add `'sprout_color'` to the `compileStmt` switch:

```typescript
    case 'sprout_forward':
    case 'sprout_turn':
    case 'sprout_pen_up':
    case 'sprout_pen_down':
    case 'sprout_color':
    case 'sprout_puts':
```

Add to `compileExprBlock` (before `default:`):

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
```

- [ ] **Step 5: Run tests to confirm they pass**

```
bun run vitest run packages/blocks/tests/compiler.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Run full test suite**

```
bun run vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add sprout_color block with color dropdown"
```

---

### Task 5: Export `mkColor` from public API

**Files:**
- Modify: `packages/lang/src/index.ts`

- [ ] **Step 1: Add `mkColor` to the export list**

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
git commit -m "feat(lang): export mkColor from public @sprout/lang index"
```

---

## Self-Review Checklist

- `color(:red)` → `{ kind: 'color', color: '#dc2626' }` Drawing ✓
- `color(:unknownColor)` → `SproutRuntimeError` ✓
- Renderer emits `setColor` + `moveTo` re-anchor on `color` node ✓
- `scaleDrawing` passes `color` unchanged (color doesn't scale) ✓
- `measureInto` ignores `color` (no geometry change) ✓
- `drawUpTo` strokes current path + begins new path on `setColor` ✓
- `sprout_color` block compiles to `color(:<name>)` CallExpr ✓
- All 9 colors: red, blue, green, orange, purple, black, white, yellow, pink ✓
- `mkColor` exported from `@sprout/lang` ✓
