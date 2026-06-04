# Clear Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `clearCanvas()` builtin that wipes the canvas and resets the turtle to (0,0) facing up, enabling proper animation loops where each timer tick draws a fresh frame.

**Architecture:** New `clearCanvas` Drawing variant in `values.ts` emits a `clearCanvas` CanvasCommand from the renderer; `drawUpTo` in stage-utils calls `ctx.clearRect` + path reset; `App.tsx` timer and keydown handlers replace the accumulated drawing (instead of appending) when the delta contains a `clearCanvas` command, preventing unbounded memory growth.

**Tech Stack:** TypeScript, Vitest, Blockly 10, pnpm monorepo (`@sprout/lang`, `@sprout/blocks`, `@sprout/ide`)

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/values.ts` | Add `clearCanvas` Drawing variant and `mkClearCanvas` constructor |
| `packages/lang/src/renderer.ts` | Add `clearCanvas` CanvasCommand; handle in `scaleDrawing`, `renderInto`, `measureInto` |
| `packages/lang/src/index.ts` | Export `mkClearCanvas` |
| `packages/lang/tests/renderer.test.ts` | Add `describe('clearCanvas rendering')` |
| `packages/lang/src/interpreter.ts` | Add `clearCanvas` builtin; update `isDrawing`; import `mkClearCanvas` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('clearCanvas builtin')`; import `mkClearCanvas` |
| `apps/ide/src/stage-utils.ts` | Add `clearCanvas` case to `drawUpTo` |
| `apps/ide/tests/stage-utils.test.ts` | Add `describe('clearCanvas drawing')` |
| `apps/ide/src/App.tsx` | Add `applyHandlerDelta` helper; use in timer and keydown handlers |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_clear_canvas` block |
| `packages/blocks/src/compiler.ts` | Add `sprout_clear_canvas` to `compileStmt` and `compileExprBlock` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('clearCanvas block')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_clear_canvas` to toolbox |

---

### Task 1: `clearCanvas` Drawing variant + renderer

**Files:**
- Modify: `packages/lang/src/values.ts`
- Modify: `packages/lang/src/renderer.ts`
- Modify: `packages/lang/src/index.ts`
- Test: `packages/lang/tests/renderer.test.ts`

- [ ] **Step 1: Write the failing tests**

Append after the last `describe` block at the end of `packages/lang/tests/renderer.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// clearCanvas rendering
// ---------------------------------------------------------------------------
describe('clearCanvas rendering', () => {
  it('render(clearCanvas) emits clearCanvas then moveTo(0,0)', () => {
    expect(render(mkClearCanvas())).toEqual([
      { kind: 'clearCanvas' },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('sequence [forward(50), clearCanvas, forward(30)] — second forward restarts from (0,0)', () => {
    expect(render(mkSequence([mkForward(50), mkClearCanvas(), mkForward(30)]))).toEqual([
      { kind: 'lineTo', x: 0, y: -50 },
      { kind: 'clearCanvas' },
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'lineTo', x: 0, y: -30 },
    ]);
  });

  it('scale(2, clearCanvas) leaves it unchanged', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: mkClearCanvas() })).toEqual([
      { kind: 'clearCanvas' },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('measure(clearCanvas) returns width=0, height=0', () => {
    expect(measure(mkClearCanvas())).toEqual({ width: 0, height: 0 });
  });
});
```

Add `mkClearCanvas` to the import from `'../src/values.js'` at the top of the file. The current last import is `mkBackground`:
```typescript
import { ..., mkBackground, mkClearCanvas, PEN_UP, PEN_DOWN, EMPTY } from '../src/values.js';
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\lang && bun test tests/renderer.test.ts
```

Expected: FAIL — `mkClearCanvas` is not exported from values.ts.

- [ ] **Step 3: Add `clearCanvas` to `values.ts`**

In `packages/lang/src/values.ts`:

**a)** Add the `clearCanvas` variant to the `Drawing` union after the `background` line (line 81) and before `empty`:

```typescript
  | { readonly kind: 'background'; readonly color: string }
  | { readonly kind: 'clearCanvas' }
  | { readonly kind: 'empty' };
```

**b)** Update the INVARIANT comment (line 98) to include `'clearCanvas'`:

```typescript
// INVARIANT: Drawing.kind values ('forward','turn','penUp','penDown','sequence',
// 'beside','above','scale','color','penWidth','empty','circle','rect','ellipse','triangle','polygon','text','background','clearCanvas')
// must never match SproutNumber/String/Symbol/Bool/Function/Var kinds.
```

**c)** Add the `mkClearCanvas` constructor after `mkBackground` (after line 162):

```typescript
export const mkClearCanvas = (): Drawing =>
  ({ kind: 'clearCanvas' });
```

- [ ] **Step 4: Add `clearCanvas` CanvasCommand and renderer handlers to `renderer.ts`**

In `packages/lang/src/renderer.ts`:

**a)** Add `clearCanvas` to the `CanvasCommand` union after the `fillBackground` line (line 25):

```typescript
  | { readonly kind: 'fillBackground'; readonly color: string }
  | { readonly kind: 'clearCanvas' };
```

**b)** Add `clearCanvas` case to `scaleDrawing` (after the `background` case at line 77):

```typescript
    case 'background':
      return d;
    case 'clearCanvas':
      return d;
```

**c)** Add `clearCanvas` case to `renderInto` (after the `background` case at lines 211–213). The `clearCanvas` case emits the command, resets the turtle state to its initial position, then emits a `moveTo` so subsequent commands start from center:

```typescript
    case 'background':
      out.push({ kind: 'fillBackground', color: drawing.color });
      return;

    case 'clearCanvas':
      out.push({ kind: 'clearCanvas' });
      state.x = 0;
      state.y = 0;
      state.angle = 0;
      state.penDown = true;
      out.push({ kind: 'moveTo', x: 0, y: 0 });
      return;
```

**d)** Add `clearCanvas` case to `measureInto` (after the `background` case at line 346):

```typescript
    case 'background':
      return;

    case 'clearCanvas':
      return;
```

- [ ] **Step 5: Export `mkClearCanvas` from `index.ts`**

In `packages/lang/src/index.ts`, add `mkClearCanvas` to the Drawing constructors export block (after `mkBackground`, line 58):

```typescript
  mkBackground,
  mkClearCanvas,
  // Drawing singleton constants (zero-arg constructors replaced by constants)
```

- [ ] **Step 6: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\lang && bun test tests/renderer.test.ts
```

Expected: All renderer tests PASS (54+ tests).

- [ ] **Step 7: Commit**

```
git add packages/lang/src/values.ts packages/lang/src/renderer.ts packages/lang/src/index.ts packages/lang/tests/renderer.test.ts
git commit -m "feat(lang): add clearCanvas Drawing variant and CanvasCommand"
```

---

### Task 2: `clearCanvas` builtin in interpreter

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Test: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/lang/tests/interpreter.test.ts`:

**a)** Add `mkClearCanvas` to the import from `'../src/values.js'` (after `mkBackground`):

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
  mkClearCanvas,
  PEN_UP,
  PEN_DOWN,
} from '../src/values.js';
```

**b)** Append after the closing `});` of `describe('background builtin', ...)` at the end of the file:

```typescript
// ---------------------------------------------------------------------------
// clearCanvas builtin
// ---------------------------------------------------------------------------
describe('clearCanvas builtin', () => {
  it('clearCanvas() returns a clearCanvas Drawing', () => {
    expect(interpret(program(exprStmt(call('clearCanvas', []))))).toEqual(
      mkSequence([mkClearCanvas()])
    );
  });

  it('clearCanvas(1) throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('clearCanvas', [numLit(1)]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/clearCanvas/);
  });

  it('clearCanvas inside a sequence is accumulated correctly', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(50)])),
      exprStmt(call('clearCanvas', [])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(50), mkClearCanvas()]));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: FAIL — `clearCanvas` is not a builtin.

- [ ] **Step 3: Add `clearCanvas` builtin to `interpreter.ts`**

In `packages/lang/src/interpreter.ts`:

**a)** Add `mkClearCanvas` to the import from `'./values.js'` (after `mkBackground`):

```typescript
  mkBackground,
  mkClearCanvas,
```

**b)** Add `'clearCanvas'` to `isDrawing` (line 76). The current last case is `'background'`:

```typescript
    case 'circle': case 'rect': case 'ellipse': case 'triangle': case 'polygon': case 'text': case 'background': case 'clearCanvas':
```

**c)** Add the `clearCanvas` builtin after the `background` entry (after its closing `}],`):

```typescript
  ['clearCanvas', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`clearCanvas expects 0 arguments, got ${args.length}`);
    return mkClearCanvas();
  }],
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: All interpreter tests PASS (150+ tests).

- [ ] **Step 5: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add clearCanvas() builtin"
```

---

### Task 3: `clearCanvas` in stage-utils + App.tsx memory management

**Files:**
- Modify: `apps/ide/src/stage-utils.ts`
- Modify: `apps/ide/src/App.tsx`
- Test: `apps/ide/tests/stage-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/ide/tests/stage-utils.test.ts`, append after the closing `});` of `describe('background drawing', ...)`:

```typescript
describe('clearCanvas drawing', () => {
  it('clearCanvas calls ctx.stroke() before clearRect', () => {
    const ctx = makeShapeMockCtx();
    let strokeCalledBeforeClear = false;
    (ctx.stroke as ReturnType<typeof vi.fn>).mockImplementation(() => {
      strokeCalledBeforeClear = true;
    });
    (ctx.clearRect as ReturnType<typeof vi.fn>).mockImplementation(() => {
      expect(strokeCalledBeforeClear).toBe(true);
    });
    const commands: CanvasCommand[] = [{ kind: 'clearCanvas' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('clearCanvas calls ctx.clearRect(0, 0, STAGE_W, STAGE_H)', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'clearCanvas' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, STAGE_W, STAGE_H);
  });

  it('clearCanvas calls ctx.beginPath() and ctx.moveTo(STAGE_W/2, STAGE_H/2)', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'clearCanvas' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(STAGE_W / 2, STAGE_H / 2);
  });
});
```

Note: `clearRect: vi.fn()` is already in `makeShapeMockCtx` (it was there from the start — `drawUpTo` always calls `ctx.clearRect` at the top of every call). No changes needed to the mock function.

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\apps\ide && bun test tests/stage-utils.test.ts
```

Expected: FAIL — `clearCanvas` is not handled in `drawUpTo`.

- [ ] **Step 3: Add `clearCanvas` to `drawUpTo` in `stage-utils.ts`**

In `apps/ide/src/stage-utils.ts`, add the `clearCanvas` case immediately after the `fillBackground` case (after line 218):

```typescript
      case 'fillBackground': {
        ctx.stroke();
        ctx.save();
        ctx.fillStyle = cmd.color;
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        ctx.restore();
        ctx.beginPath();
        break;
      }
      case 'clearCanvas': {
        ctx.stroke();
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);
        ctx.beginPath();
        ctx.moveTo(STAGE_W / 2, STAGE_H / 2);
        break;
      }
```

- [ ] **Step 4: Run stage-utils tests to verify they pass**

```
cd D:\Projects\kider\apps\ide && bun test tests/stage-utils.test.ts
```

Expected: All stage-utils tests PASS (35+ tests).

- [ ] **Step 5: Update `App.tsx` — add `applyHandlerDelta` and use it**

In `apps/ide/src/App.tsx`, make two changes:

**a)** After `function handleRun() {` and before the `if (timerRef.current` line, add the helper function. Place it as a regular function inside the App component, right before `handleRun`:

```typescript
  function applyHandlerDelta(delta: Drawing) {
    const deltaCommands = render(delta);
    const usesClear = deltaCommands.some(c => c.kind === 'clearCanvas');
    if (usesClear) {
      accDrawingRef.current = delta;
      setCommands(deltaCommands);
    } else {
      const next = mkSequence([accDrawingRef.current!, delta]);
      accDrawingRef.current = next;
      setCommands(render(next));
    }
  }
```

**b)** In the **timer `setInterval` callback** (lines 147–163), replace the accumulation block:

Old:
```typescript
            const delta = callHandler(timerFn);
            const next = mkSequence([accDrawingRef.current, delta]);
            accDrawingRef.current = next;
            setCommands(render(next));
```

New:
```typescript
            const delta = callHandler(timerFn);
            applyHandlerDelta(delta);
```

**c)** In the **keydown `onKeyDown` function** (lines 107–110), replace the accumulation block:

Old:
```typescript
        const delta = callHandler(fn);
        const next = mkSequence([accDrawingRef.current, delta]);
        accDrawingRef.current = next;
        setCommands(render(next));
```

New:
```typescript
        const delta = callHandler(fn);
        applyHandlerDelta(delta);
```

- [ ] **Step 6: Run the full test suite**

```
cd D:\Projects\kider && bun test
```

Expected: All tests PASS (425+ tests, 0 failures).

- [ ] **Step 7: Commit**

```
git add apps/ide/src/stage-utils.ts apps/ide/tests/stage-utils.test.ts apps/ide/src/App.tsx
git commit -m "feat(ide): handle clearCanvas in drawUpTo; replace accumulator when clearCanvas used"
```

---

### Task 4: `sprout_clear_canvas` block, compiler, and toolbox

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `apps/ide/src/BlockWorkspace.tsx`
- Test: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write the failing tests**

Append after the closing `});` of `describe('background block', ...)` at the end of `packages/blocks/tests/compiler.test.ts`:

```typescript
describe('clearCanvas block', () => {
  it('sprout_clear_canvas compiles to clearCanvas()', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_clear_canvas');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'clearCanvas',
          args: [],
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

Expected: FAIL — `sprout_clear_canvas` block type unknown.

- [ ] **Step 3: Add `sprout_clear_canvas` block to `statements.ts`**

In `packages/blocks/src/definitions/statements.ts`, add the following after the closing `};` of `sprout_background`:

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

- [ ] **Step 4: Add `sprout_clear_canvas` to the compiler**

In `packages/blocks/src/compiler.ts`:

**a)** Add `'sprout_clear_canvas'` to the `compileStmt` fall-through case group (after `'sprout_background'`):

```typescript
    case 'sprout_color':
    case 'sprout_random_color':
    case 'sprout_background':
    case 'sprout_clear_canvas':
    case 'sprout_pen_width':
```

**b)** Add the case to `compileExprBlock` after the `sprout_background` case:

```typescript
    case 'sprout_clear_canvas':
      return { kind: 'CallExpr', callee: 'clearCanvas', args: [], block: null };
```

- [ ] **Step 5: Add `sprout_clear_canvas` to the toolbox**

In `apps/ide/src/BlockWorkspace.tsx`, add `sprout_clear_canvas` after `sprout_background` in the Pen section:

```typescript
    { kind: 'block', type: 'sprout_random_color' },
    { kind: 'block', type: 'sprout_background' },
    { kind: 'block', type: 'sprout_clear_canvas' },
    { kind: 'block', type: 'sprout_pen_width' },
```

- [ ] **Step 6: Run the full test suite**

```
cd D:\Projects\kider && bun test
```

Expected: All tests PASS (428+ tests, 0 failures).

- [ ] **Step 7: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(blocks): add sprout_clear_canvas block and toolbox entry"
```
