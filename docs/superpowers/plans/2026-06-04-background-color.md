# Background Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `background()` builtin that fills the canvas with a solid color, accepting named palette symbols (`:red` etc.) or arbitrary hex strings (`"#ff4400"`).

**Architecture:** New `background` Drawing variant in `values.ts` emits a new `fillBackground` CanvasCommand via the renderer; stage-utils handles it with `ctx.fillRect`. A `sprout_background` Blockly block with a 9-color dropdown compiles to `background(:colorName)`. No lang API surface changes — `callHandler` and `interpretFull` are untouched.

**Tech Stack:** TypeScript, Vitest, Blockly 10, pnpm monorepo (`@sprout/lang`, `@sprout/blocks`, `@sprout/ide`)

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/values.ts` | Add `background` Drawing variant and `mkBackground` constructor |
| `packages/lang/src/renderer.ts` | Add `fillBackground` CanvasCommand; handle in `scaleDrawing`, `renderInto`, `measureInto` |
| `packages/lang/tests/renderer.test.ts` | Add `describe('background rendering')` |
| `packages/lang/src/interpreter.ts` | Add `background` builtin; import `mkBackground`; add `'background'` to `isDrawing` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('background builtin')`; import `mkBackground` |
| `apps/ide/src/stage-utils.ts` | Add `fillBackground` case to `drawUpTo` |
| `apps/ide/tests/stage-utils.test.ts` | Add `fillRect` to `makeShapeMockCtx`; add `describe('background drawing')` |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_background` block after `sprout_color` |
| `packages/blocks/src/compiler.ts` | Add `sprout_background` to `compileStmt` and `compileExprBlock` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('background block')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_background` to toolbox after `sprout_color` |

---

### Task 1: `background` Drawing variant + renderer

**Files:**
- Modify: `packages/lang/src/values.ts`
- Modify: `packages/lang/src/renderer.ts`
- Test: `packages/lang/tests/renderer.test.ts`

- [ ] **Step 1: Write the failing tests**

Append after the last `describe` block at the end of `packages/lang/tests/renderer.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// background rendering
// ---------------------------------------------------------------------------
describe('background rendering', () => {
  it('render(background) emits fillBackground — no moveTo', () => {
    expect(render(mkBackground('#dc2626'))).toEqual([
      { kind: 'fillBackground', color: '#dc2626' },
    ]);
  });

  it('scale(2, background) leaves color unchanged', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: mkBackground('#2563eb') })).toEqual([
      { kind: 'fillBackground', color: '#2563eb' },
    ]);
  });

  it('sequence [background, forward] emits fillBackground then lineTo', () => {
    expect(render(mkSequence([mkBackground('#dc2626'), mkForward(50)]))).toEqual([
      { kind: 'fillBackground', color: '#dc2626' },
      { kind: 'lineTo', x: 0, y: -50 },
    ]);
  });

  it('measure(background) returns width=0, height=0', () => {
    expect(measure(mkBackground('#dc2626'))).toEqual({ width: 0, height: 0 });
  });
});
```

Note: `mkBackground` is not yet imported. Add it to the existing import from `'../src/values.js'` at the top of the file. The import line currently reads something like:
```typescript
import { ..., mkText } from '../src/values.js';
```
Add `mkBackground` to that list.

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\lang && bun test tests/renderer.test.ts
```

Expected: FAIL — `mkBackground` is not exported from values.ts.

- [ ] **Step 3: Add `background` to `values.ts`**

In `packages/lang/src/values.ts`:

**a)** Add the `background` variant to the `Drawing` union after the `text` line (line 80):

```typescript
  | { readonly kind: 'text';       readonly str: string; readonly size: number }
  | { readonly kind: 'background'; readonly color: string }
  | { readonly kind: 'empty' };
```

**b)** Update the INVARIANT comment (lines 97–98) to include `'background'`:

```typescript
// INVARIANT: Drawing.kind values ('forward','turn','penUp','penDown','sequence',
// 'beside','above','scale','color','penWidth','empty','circle','rect','ellipse','triangle','polygon','text','background')
// must never match SproutNumber/String/Symbol/Bool/Function/Var kinds.
```

**c)** Add the `mkBackground` constructor after `mkText` (after line 158):

```typescript
export const mkBackground = (color: string): Drawing =>
  ({ kind: 'background', color });
```

- [ ] **Step 4: Add `fillBackground` to `renderer.ts`**

In `packages/lang/src/renderer.ts`:

**a)** Add `fillBackground` to the `CanvasCommand` union after the `drawText` line (line 24):

```typescript
  | { readonly kind: 'drawText';       readonly x: number; readonly y: number; readonly str: string; readonly size: number }
  | { readonly kind: 'fillBackground'; readonly color: string };
```

**b)** Add `background` case to `scaleDrawing` (after the `text` case at line 73–74):

```typescript
    case 'text':
      return { kind: 'text', str: d.str, size: d.size * factor };
    case 'background':
      return d;
```

**c)** Add `background` case to `renderInto` (after the `text` case at lines 203–206):

```typescript
    case 'text':
      out.push({ kind: 'drawText', x: state.x, y: state.y, str: drawing.str, size: drawing.size });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;

    case 'background':
      out.push({ kind: 'fillBackground', color: drawing.color });
      return;
```

**d)** Add `background` case to `measureInto` (after the `text` case at lines 331–336). The `background` variant doesn't move the turtle or contribute to the bounding box:

```typescript
    case 'text':
      bbox.minX = Math.min(bbox.minX, state.x);
      bbox.maxX = Math.max(bbox.maxX, state.x + drawing.str.length * drawing.size * 0.6);
      bbox.minY = Math.min(bbox.minY, state.y - drawing.size);
      bbox.maxY = Math.max(bbox.maxY, state.y);
      return;

    case 'background':
      return;
```

- [ ] **Step 5: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\lang && bun test tests/renderer.test.ts
```

Expected: All renderer tests PASS.

- [ ] **Step 6: Commit**

```
git add packages/lang/src/values.ts packages/lang/src/renderer.ts packages/lang/tests/renderer.test.ts
git commit -m "feat(lang): add background Drawing variant and fillBackground CanvasCommand"
```

---

### Task 2: `background` builtin in interpreter

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Test: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/lang/tests/interpreter.test.ts`:

**a)** Add `mkBackground` to the import from `'../src/values.js'`. The import currently has `mkText` as the last mk-constructor; add `mkBackground` after it:

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
  mkPolygon,
  mkText,
  mkBackground,
  PEN_UP,
  PEN_DOWN,
} from '../src/values.js';
```

**b)** Append after the last `describe` block (after the closing `});` of `describe('text builtin', ...)`):

```typescript
// ---------------------------------------------------------------------------
// background builtin
// ---------------------------------------------------------------------------
describe('background builtin', () => {
  it('background(:red) returns a background Drawing with the palette hex', () => {
    expect(interpret(program(exprStmt(call('background', [symLit('red')]))))).toEqual(
      mkSequence([mkBackground('#dc2626')])
    );
  });

  it('background(:white) returns a background Drawing with #ffffff', () => {
    expect(interpret(program(exprStmt(call('background', [symLit('white')]))))).toEqual(
      mkSequence([mkBackground('#ffffff')])
    );
  });

  it('background("#ff4400") accepts a hex string directly', () => {
    expect(interpret(program(exprStmt(call('background', [strLit('#ff4400')]))))).toEqual(
      mkSequence([mkBackground('#ff4400')])
    );
  });

  it('background(:unknown) throws SproutRuntimeError', () => {
    expect(() =>
      interpret(program(exprStmt(call('background', [symLit('unknown')]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(program(exprStmt(call('background', [symLit('unknown')]))))
    ).toThrow(/background/);
  });

  it('background(1) throws SproutRuntimeError', () => {
    expect(() =>
      interpret(program(exprStmt(call('background', [numLit(1)]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(program(exprStmt(call('background', [numLit(1)]))))
    ).toThrow(/background/);
  });

  it('background() with no args throws SproutRuntimeError', () => {
    expect(() =>
      interpret(program(exprStmt(call('background', []))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(program(exprStmt(call('background', []))))
    ).toThrow(/background/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: FAIL — `background` is not a builtin.

- [ ] **Step 3: Add `background` builtin to `interpreter.ts`**

In `packages/lang/src/interpreter.ts`:

**a)** Add `mkBackground` to the import from `'./values.js'`. Find the line that imports `mkText`:
```typescript
  mkText,
```
Add `mkBackground` after it:
```typescript
  mkText,
  mkBackground,
```

**b)** Add `'background'` to `isDrawing` (around line 75). The current last case in that switch is `'text'`:
```typescript
    case 'circle': case 'rect': case 'ellipse': case 'triangle': case 'polygon': case 'text':
```
Change to:
```typescript
    case 'circle': case 'rect': case 'ellipse': case 'triangle': case 'polygon': case 'text': case 'background':
```

**c)** Add the `background` builtin entry to BUILTINS after the `randomColor` entry (after line ~212, the closing `}],` of `randomColor`):

```typescript
  ['background', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`background expects 1 argument, got ${args.length}`);
    const arg = args[0];
    if (arg.kind === 'symbol') {
      const hex = COLOR_MAP[arg.name];
      if (hex === undefined) {
        throw new SproutRuntimeError(
          `Unknown color: :${arg.name}. Available: ${Object.keys(COLOR_MAP).map(k => ':' + k).join(', ')}`
        );
      }
      return mkBackground(hex);
    }
    if (arg.kind === 'string') {
      return mkBackground(arg.value);
    }
    throw new SproutRuntimeError(`background expects a color symbol or hex string, got ${arg.kind}`);
  }],
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: All interpreter tests PASS.

- [ ] **Step 5: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add background() builtin"
```

---

### Task 3: `fillBackground` in stage-utils

**Files:**
- Modify: `apps/ide/src/stage-utils.ts`
- Test: `apps/ide/tests/stage-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/ide/tests/stage-utils.test.ts`:

**a)** Add `fillRect: vi.fn()` to `makeShapeMockCtx`. Find the function (around line 209) and add `fillRect` after the existing mock methods:

```typescript
function makeShapeMockCtx() {
  let globalAlphaValue = 1;
  let fillStyleValue: string = '';
  let fontValue: string = '';
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
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
    get font() { return fontValue; },
    set font(v: string) { fontValue = v; },
    strokeStyle: '#2563eb' as CanvasRenderingContext2D['strokeStyle'],
    lineWidth: 2,
    lineCap: 'round' as CanvasRenderingContext2D['lineCap'],
    lineJoin: 'round' as CanvasRenderingContext2D['lineJoin'],
  } as unknown as CanvasRenderingContext2D;
}
```

**b)** Append after the last `describe` block (after the closing `});` of `describe('text drawing', ...)`):

```typescript
describe('background drawing', () => {
  it('fillBackground calls ctx.fillRect(0, 0, STAGE_W, STAGE_H)', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'fillBackground', color: '#dc2626' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, STAGE_W, STAGE_H);
  });

  it('fillBackground sets fillStyle to the given color', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'fillBackground', color: '#ff4400' }];
    drawUpTo(ctx, commands, 1);
    expect((ctx as unknown as { fillStyle: string }).fillStyle).toBe('#ff4400');
  });

  it('fillBackground calls ctx.save() and ctx.restore()', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'fillBackground', color: '#dc2626' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\apps\ide && bun test tests/stage-utils.test.ts
```

Expected: FAIL — `fillBackground` is not handled in `drawUpTo` (TypeScript may also complain about the unknown kind).

- [ ] **Step 3: Add `fillBackground` to `drawUpTo` in `stage-utils.ts`**

In `apps/ide/src/stage-utils.ts`, find the `drawText` case in the `drawUpTo` switch (around line 195). Add the `fillBackground` case immediately after it:

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
      case 'fillBackground': {
        ctx.save();
        ctx.fillStyle = cmd.color;
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        ctx.restore();
        break;
      }
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd D:\Projects\kider\apps\ide && bun test tests/stage-utils.test.ts
```

Expected: All stage-utils tests PASS.

- [ ] **Step 5: Commit**

```
git add apps/ide/src/stage-utils.ts apps/ide/tests/stage-utils.test.ts
git commit -m "feat(ide): handle fillBackground in drawUpTo"
```

---

### Task 4: `sprout_background` block, compiler, and toolbox

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `apps/ide/src/BlockWorkspace.tsx`
- Test: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write the failing tests**

Append after the last `describe` block at the end of `packages/blocks/tests/compiler.test.ts` (after `describe('on event block — new events', ...)`):

```typescript
describe('background block', () => {
  it('sprout_background with COLOR="red" compiles to background(:red)', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_background');
    block.setFieldValue('red', 'COLOR');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'background',
          args: [{ kind: 'SymbolLit', name: 'red' }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_background with COLOR="white" compiles to background(:white)', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_background');
    block.setFieldValue('white', 'COLOR');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'background',
          args: [{ kind: 'SymbolLit', name: 'white' }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\blocks && bun test tests/compiler.test.ts
```

Expected: FAIL — `sprout_background` block type unknown.

- [ ] **Step 3: Add `sprout_background` block to `statements.ts`**

In `packages/blocks/src/definitions/statements.ts`, add the following after the closing `};` of `sprout_color` (after `sprout_random_color` — find where `sprout_random_color` ends and add after it):

```typescript
  Blockly.Blocks['sprout_background'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('background')
        .appendField(
          new Blockly.FieldDropdown([
            ['white',  'white'],
            ['black',  'black'],
            ['red',    'red'],
            ['blue',   'blue'],
            ['green',  'green'],
            ['orange', 'orange'],
            ['purple', 'purple'],
            ['yellow', 'yellow'],
            ['pink',   'pink'],
          ]) as unknown as Blockly.Field,
          'COLOR',
        );
      this.setTooltip('Sets the canvas background color. In text mode, hex strings like "#ff4400" are also accepted.');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
    },
  };
```

- [ ] **Step 4: Add `sprout_background` to the compiler**

In `packages/blocks/src/compiler.ts`:

**a)** Add `'sprout_background'` to the `compileStmt` case group (after `'sprout_random_color'`):

```typescript
    case 'sprout_color':
    case 'sprout_random_color':
    case 'sprout_background':
    case 'sprout_pen_width':
```

**b)** Add the case to `compileExprBlock` after the `sprout_random_color` case:

```typescript
    case 'sprout_background': {
      const color = block.getFieldValue('COLOR') as string;
      return { kind: 'CallExpr', callee: 'background', args: [{ kind: 'SymbolLit', name: color }], block: null };
    }
```

- [ ] **Step 5: Add `sprout_background` to the toolbox**

In `apps/ide/src/BlockWorkspace.tsx`, add `sprout_background` after `sprout_random_color` in the Pen section:

```typescript
    // Pen
    { kind: 'block', type: 'sprout_pen_up' },
    { kind: 'block', type: 'sprout_pen_down' },
    { kind: 'block', type: 'sprout_color' },
    { kind: 'block', type: 'sprout_random_color' },
    { kind: 'block', type: 'sprout_background' },
    { kind: 'block', type: 'sprout_pen_width' },
```

- [ ] **Step 6: Run the full test suite**

```
cd D:\Projects\kider && bun test
```

Expected: All tests PASS (410+ tests, 0 failures).

- [ ] **Step 7: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(blocks): add sprout_background block and toolbox entry"
```
