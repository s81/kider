# Running-Line Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Animate mode in the text editor, highlight the source line of the command currently being drawn — stepping per-statement, lighting up per-iteration inside loops, clearing on completion.

**Architecture:** Thread an optional `line: number` through the value chain: `Drawing` (intersected at the union level so every node gains the optional field in one edit) → `CanvasCommand` (the renderer copies it on emit) → `Stage` (reports the active line via `onActiveLine`) → `TextPanel.highlightLine` (CodeMirror `StateField`/`StateEffect`-driven line decoration). The interpreter tags each statement's drawing with the statement's source line; loops/functions re-evaluate per iteration, so per-iteration highlighting falls out for free.

**Tech Stack:** TypeScript, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`), React 19, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-06-12-running-line-highlight-design.md`

---

## File Structure

**Create:**
- `apps/ide/src/run-line-highlight.ts` — CodeMirror `StateField` + `StateEffect` that renders the active-line decoration.
- `apps/ide/tests/run-line-highlight.test.ts` — headless tests over `EditorState`.

**Modify:**
- `packages/lang/src/values.ts` — split `Drawing` into `DrawingNode` + intersection; add `tagLines`.
- `packages/lang/src/renderer.ts` — add `line?: number` to `CanvasCommand`; copy `d.line` at emit sites; convert `scaleDrawing` rebuilds to spreads so `line` is preserved.
- `packages/lang/src/interpreter.ts` — add `stmtLine` helper; tag at both `drawings.push` sites (`evalBlock`, `interpret`).
- `packages/lang/tests/renderer.test.ts` — assertions that emitted commands carry the source line.
- `packages/lang/tests/interpreter.test.ts` (or a new `line-attribution.test.ts`) — end-to-end statement→command line attribution, including loops.
- `apps/ide/src/Stage.tsx` — add `onActiveLine?: (line: number | null) => void` prop and fire from reveal paths.
- `apps/ide/src/TextPanel.tsx` — extend `EditorHandle` with `highlightLine`; include `activeLineField` in extensions; add `.cm-activeRunLine` theme rule.
- `apps/ide/src/App.tsx` — wire `<Stage onActiveLine={...} />` to `editorRef.current?.highlightLine(line)`.

---

## Task 1: Add optional `line` to every `Drawing` node

**Files:**
- Modify: `packages/lang/src/values.ts:64-92`

- [ ] **Step 1: Rename the existing `Drawing` union to `DrawingNode` and define `Drawing` as an intersection**

In `packages/lang/src/values.ts`, replace `export type Drawing = …` with the renamed union and a new `Drawing` type. The new union covers exactly the variants that were already in `Drawing`:

```ts
export type DrawingNode =
  | { readonly kind: 'forward';  readonly distance: number }
  | { readonly kind: 'turn';     readonly degrees: number }
  | { readonly kind: 'penUp' }
  | { readonly kind: 'penDown' }
  | { readonly kind: 'sequence'; readonly steps: readonly Drawing[] }
  | { readonly kind: 'beside';   readonly left: Drawing; readonly right: Drawing }
  | { readonly kind: 'above';    readonly top: Drawing; readonly bottom: Drawing }
  | { readonly kind: 'scale';    readonly factor: number; readonly drawing: Drawing }
  | { readonly kind: 'color';    readonly color: string }
  | { readonly kind: 'penWidth'; readonly width: number }
  | { readonly kind: 'circle';   readonly radius: number }
  | { readonly kind: 'rect';     readonly width: number; readonly height: number }
  | { readonly kind: 'ellipse';  readonly rx: number; readonly ry: number }
  | { readonly kind: 'triangle'; readonly size: number }
  | { readonly kind: 'polygon';  readonly n: number; readonly size: number }
  | { readonly kind: 'text';     readonly str: string; readonly size: number }
  | { readonly kind: 'stamp' }
  | { readonly kind: 'background'; readonly color: string }
  | { readonly kind: 'clearCanvas' }
  | { readonly kind: 'arc';        readonly radius: number; readonly angle: number }
  | { readonly kind: 'goto';       readonly x: number; readonly y: number }
  | { readonly kind: 'home' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'hideTurtle' }
  | { readonly kind: 'showTurtle' }
  | WaitDrawing
  | SoundDrawing
  | FillPathDrawing;

/**
 * A Drawing carries an optional 1-based source line, distributed across every
 * member of the union. Set by the interpreter on each statement's output so
 * the IDE can highlight the running line.
 */
export type Drawing = DrawingNode & { readonly line?: number };
```

The child references inside compositional members (`sequence.steps`, `beside.left`, `above.top`, `scale.drawing`) keep the `Drawing` type, so the intersection distributes recursively too. Existing `mk*` constructors and the `WaitDrawing`/`SoundDrawing`/`FillPathDrawing` interfaces stay unchanged.

- [ ] **Step 2: Run lang tests to confirm nothing breaks**

Run: `npm test --workspace=@sprout/lang`
Expected: every existing test passes — the union shape is unchanged, only `line` is added as an optional field.

- [ ] **Step 3: Commit**

```bash
git add packages/lang/src/values.ts
git commit -m "feat(lang): make Drawing carry an optional source line"
```

---

## Task 2: Add `tagLines` helper

**Files:**
- Modify: `packages/lang/src/values.ts` (append next to the `mk*` constructors)
- Test: `packages/lang/tests/tag-lines.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `packages/lang/tests/tag-lines.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  tagLines,
  mkCircle,
  mkForward,
  mkSequence,
  mkBeside,
  mkScale,
  mkFillPath,
} from '../src/values.js';

describe('tagLines', () => {
  it('stamps a line onto a single untagged primitive', () => {
    const out = tagLines(mkCircle(20), 3);
    expect(out.line).toBe(3);
    expect(out.kind).toBe('circle');
  });

  it('recurses into sequence / beside / scale / fillPath children', () => {
    const tree = mkSequence([
      mkBeside(mkForward(10), mkCircle(5)),
      mkScale(2, mkForward(7)),
      mkFillPath(mkForward(3)),
    ]);
    const out = tagLines(tree, 7);
    expect(out.line).toBe(7);
    expect(out.kind).toBe('sequence');
    if (out.kind !== 'sequence') return;
    for (const step of out.steps) {
      expect(step.line).toBe(7);
    }
    const beside = out.steps[0];
    if (beside.kind !== 'beside') throw new Error('expected beside');
    expect(beside.left.line).toBe(7);
    expect(beside.right.line).toBe(7);
    const scale = out.steps[1];
    if (scale.kind !== 'scale') throw new Error('expected scale');
    expect(scale.drawing.line).toBe(7);
    const fillPath = out.steps[2];
    if (fillPath.kind !== 'fillPath') throw new Error('expected fillPath');
    expect(fillPath.drawing.line).toBe(7);
  });

  it('leaves an already-tagged subtree untouched (innermost wins)', () => {
    const inner = tagLines(mkForward(5), 2); // pre-tagged with line 2
    const tree = mkSequence([mkCircle(10), inner]);
    const out = tagLines(tree, 9);
    if (out.kind !== 'sequence') throw new Error('expected sequence');
    expect(out.line).toBe(9);
    expect(out.steps[0].line).toBe(9);   // untagged → gets 9
    expect(out.steps[1].line).toBe(2);   // pre-tagged → stays at 2
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/lang/tests/tag-lines.test.ts`
Expected: FAIL with "tagLines is not exported" (or similar).

- [ ] **Step 3: Implement `tagLines`**

Append to `packages/lang/src/values.ts` (after the `mkFillPath` definition, before EOF):

```ts
/**
 * Stamp `line` onto every node of a drawing that doesn't already carry one.
 * Innermost tag wins: an already-tagged subtree (from a nested statement) is
 * returned untouched. Used by the interpreter to attribute a statement's
 * drawing output to its source line.
 */
export function tagLines(d: Drawing, line: number): Drawing {
  if (d.line !== undefined) return d;
  switch (d.kind) {
    case 'sequence':
      return { ...d, line, steps: d.steps.map(s => tagLines(s, line)) };
    case 'beside':
      return { ...d, line, left: tagLines(d.left, line), right: tagLines(d.right, line) };
    case 'above':
      return { ...d, line, top: tagLines(d.top, line), bottom: tagLines(d.bottom, line) };
    case 'scale':
      return { ...d, line, drawing: tagLines(d.drawing, line) };
    case 'fillPath':
      return { ...d, line, drawing: tagLines(d.drawing, line) };
    default:
      return { ...d, line };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/lang/tests/tag-lines.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/lang/src/values.ts packages/lang/tests/tag-lines.test.ts
git commit -m "feat(lang): tagLines — stamp source line onto a Drawing subtree"
```

---

## Task 3: Renderer copies `Drawing.line` onto emitted `CanvasCommand`s

**Files:**
- Modify: `packages/lang/src/renderer.ts:12-32` (CanvasCommand type), `packages/lang/src/renderer.ts:52-104` (scaleDrawing), `packages/lang/src/renderer.ts:113-310` (renderInto emit sites)
- Test: `packages/lang/tests/renderer.test.ts` (add cases at end of file)

- [ ] **Step 1: Write the failing tests**

Append to `packages/lang/tests/renderer.test.ts`:

```ts
import { tagLines } from '../src/values.js';

describe('render carries Drawing.line onto commands', () => {
  it('emits commands with line === undefined when drawing is untagged', () => {
    const cmds = render(mkForward(10));
    for (const c of cmds) {
      // @ts-expect-no-error — line is an optional field on every CanvasCommand
      expect((c as { line?: number }).line).toBeUndefined();
    }
  });

  it('a line-tagged forward emits a lineTo whose line === source line', () => {
    const tagged = tagLines(mkForward(10), 5);
    const cmds = render(tagged);
    const lineTo = cmds.find(c => c.kind === 'lineTo')!;
    expect((lineTo as { line?: number }).line).toBe(5);
  });

  it('a line-tagged circle emits a drawCircle whose line === source line', () => {
    const tagged = tagLines(mkCircle(20), 8);
    const cmds = render(tagged);
    const draw = cmds.find(c => c.kind === 'drawCircle')!;
    expect((draw as { line?: number }).line).toBe(8);
  });

  it('scale preserves the line on its scaled primitive', () => {
    const tagged = mkScale(2, tagLines(mkForward(10), 4));
    const cmds = render(tagged);
    const lineTo = cmds.find(c => c.kind === 'lineTo')!;
    expect((lineTo as { line?: number }).line).toBe(4);
  });
});
```

Imports already exist except `mkCircle` — add it to the import list at the top of the file if it isn't already there.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/lang/tests/renderer.test.ts -t "carries Drawing.line"`
Expected: FAIL (line is undefined or scaleDrawing drops it).

- [ ] **Step 3: Add `line?` to every `CanvasCommand` variant**

Edit `packages/lang/src/renderer.ts:12-32`. Add `readonly line?: number` to each variant of the union:

```ts
export type CanvasCommand =
  | { readonly kind: 'moveTo'; readonly x: number; readonly y: number; readonly line?: number }
  | { readonly kind: 'lineTo'; readonly x: number; readonly y: number; readonly line?: number }
  | { readonly kind: 'penDown'; readonly line?: number }
  | { readonly kind: 'penUp'; readonly line?: number }
  | { readonly kind: 'setColor'; readonly color: string; readonly line?: number }
  | { readonly kind: 'setLineWidth'; readonly width: number; readonly line?: number }
  | { readonly kind: 'drawCircle';   readonly x: number; readonly y: number; readonly radius: number; readonly line?: number }
  | { readonly kind: 'drawRect';     readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly line?: number }
  | { readonly kind: 'drawEllipse';  readonly x: number; readonly y: number; readonly rx: number; readonly ry: number; readonly line?: number }
  | { readonly kind: 'drawTriangle'; readonly x: number; readonly y: number; readonly size: number; readonly line?: number }
  | { readonly kind: 'drawPolygon';  readonly x: number; readonly y: number; readonly n: number; readonly size: number; readonly line?: number }
  | { readonly kind: 'drawText';     readonly x: number; readonly y: number; readonly str: string; readonly size: number; readonly line?: number }
  | { readonly kind: 'drawStamp'; readonly x: number; readonly y: number; readonly heading: number; readonly line?: number }
  | { readonly kind: 'fillBackground'; readonly color: string; readonly line?: number }
  | { readonly kind: 'clearCanvas'; readonly line?: number }
  | { readonly kind: 'wait'; readonly durationMs: number; readonly line?: number }
  | { readonly kind: 'sound'; readonly frequency: number; readonly durationMs: number; readonly line?: number }
  | { readonly kind: 'fillPath'; readonly points: readonly { x: number; y: number }[]; readonly line?: number }
  | { readonly kind: 'hideTurtle'; readonly line?: number }
  | { readonly kind: 'showTurtle'; readonly line?: number };
```

- [ ] **Step 4: Convert `scaleDrawing` rebuilds to spreads so `line` is preserved**

In `packages/lang/src/renderer.ts`, replace `scaleDrawing` (around lines 52-104) so each rebuild spreads `d`:

```ts
function scaleDrawing(factor: number, d: Drawing): Drawing {
  switch (d.kind) {
    case 'forward':
      return { ...d, distance: d.distance * factor };
    case 'turn':
    case 'penUp':
    case 'penDown':
    case 'color':
    case 'penWidth':
    case 'empty':
    case 'hideTurtle':
    case 'showTurtle':
      return d;
    case 'sequence':
      return { ...d, steps: d.steps.map(s => scaleDrawing(factor, s)) };
    case 'beside':
      return { ...d, left: scaleDrawing(factor, d.left), right: scaleDrawing(factor, d.right) };
    case 'above':
      return { ...d, top: scaleDrawing(factor, d.top), bottom: scaleDrawing(factor, d.bottom) };
    case 'scale':
      return { ...d, factor: d.factor * factor };
    case 'circle':
      return { ...d, radius: d.radius * factor };
    case 'rect':
      return { ...d, width: d.width * factor, height: d.height * factor };
    case 'ellipse':
      return { ...d, rx: d.rx * factor, ry: d.ry * factor };
    case 'triangle':
      return { ...d, size: d.size * factor };
    case 'polygon':
      return { ...d, size: d.size * factor };
    case 'text':
      return { ...d, size: d.size * factor };
    case 'stamp':
      return d;
    case 'arc':
      return { ...d, radius: d.radius * factor };
    case 'background':
      return d;
    case 'clearCanvas':
      return d;
    case 'goto':
      return d;
    case 'home':
      return d;
    case 'wait':
      return d;
    case 'sound':
      return d;
    case 'fillPath':
      return { ...d, drawing: scaleDrawing(factor, d.drawing) };
  }
}
```

- [ ] **Step 5: Copy `drawing.line` onto every emitted command in `renderInto`**

For each `out.push({ ... })` inside `renderInto`, add `line: drawing.line` (or, where the local variable is named `d`, `line: d.line`). The pattern is mechanical — for every case in `renderInto` (`packages/lang/src/renderer.ts:113-310`), add `line: drawing.line` to each pushed command object. The cases and how they change:

```ts
case 'penUp':
  out.push({ kind: 'penUp', line: drawing.line });
  state.penDown = false;
  return;

case 'penDown':
  out.push({ kind: 'penDown', line: drawing.line });
  state.penDown = true;
  return;

case 'color':
  out.push({ kind: 'setColor', color: drawing.color, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'penWidth':
  out.push({ kind: 'setLineWidth', width: drawing.width, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'forward': {
  const rad = state.heading * DEG_TO_RAD;
  const newX = state.x + drawing.distance * Math.sin(rad);
  const newY = state.y - drawing.distance * Math.cos(rad);
  if (state.penDown) {
    out.push({ kind: 'lineTo', x: newX, y: newY, line: drawing.line });
  } else {
    out.push({ kind: 'moveTo', x: newX, y: newY, line: drawing.line });
  }
  state.x = newX;
  state.y = newY;
  return;
}

case 'circle':
  out.push({ kind: 'drawCircle', x: state.x, y: state.y, radius: drawing.radius, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'rect':
  out.push({ kind: 'drawRect', x: state.x, y: state.y, width: drawing.width, height: drawing.height, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'ellipse':
  out.push({ kind: 'drawEllipse', x: state.x, y: state.y, rx: drawing.rx, ry: drawing.ry, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'triangle':
  out.push({ kind: 'drawTriangle', x: state.x, y: state.y, size: drawing.size, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'polygon':
  out.push({ kind: 'drawPolygon', x: state.x, y: state.y, n: drawing.n, size: drawing.size, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'text':
  out.push({ kind: 'drawText', x: state.x, y: state.y, str: drawing.str, size: drawing.size, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'stamp':
  out.push({ kind: 'drawStamp', x: state.x, y: state.y, heading: state.heading, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'background':
  out.push({ kind: 'fillBackground', color: drawing.color, line: drawing.line });
  return;

case 'clearCanvas':
  out.push({ kind: 'clearCanvas', line: drawing.line });
  state.penDown = true;
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;

case 'wait':
  out.push({ kind: 'wait', durationMs: drawing.seconds * 1000, line: drawing.line });
  return;

case 'sound':
  out.push({ kind: 'sound', frequency: drawing.frequency, durationMs: drawing.seconds * 1000, line: drawing.line });
  return;

case 'fillPath': {
  const points: { x: number; y: number }[] = [{ x: state.x, y: state.y }];
  collectPathPoints(drawing.drawing, state, points);
  out.push({ kind: 'fillPath', points, line: drawing.line });
  out.push({ kind: 'moveTo', x: state.x, y: state.y, line: drawing.line });
  return;
}

case 'hideTurtle':
  out.push({ kind: 'hideTurtle', line: drawing.line });
  return;

case 'showTurtle':
  out.push({ kind: 'showTurtle', line: drawing.line });
  return;

case 'arc': {
  if (drawing.angle === 0 || drawing.radius === 0) return;
  const steps = Math.max(4, Math.abs(Math.round(drawing.angle / 5)));
  const stepAngle = drawing.angle / steps;
  const stepDist = (2 * Math.PI * Math.abs(drawing.radius) / 360) * Math.abs(drawing.angle / steps);
  for (let i = 0; i < steps; i++) {
    const rad = state.heading * DEG_TO_RAD;
    const newX = state.x + stepDist * Math.sin(rad);
    const newY = state.y - stepDist * Math.cos(rad);
    if (state.penDown) {
      out.push({ kind: 'lineTo', x: newX, y: newY, line: drawing.line });
    } else {
      out.push({ kind: 'moveTo', x: newX, y: newY, line: drawing.line });
    }
    state.x = newX;
    state.y = newY;
    state.heading = ((state.heading + stepAngle) % 360 + 360) % 360;
  }
  return;
}

case 'goto':
  state.x = drawing.x;
  state.y = drawing.y;
  out.push({ kind: 'moveTo', x: drawing.x, y: drawing.y, line: drawing.line });
  return;

case 'home':
  state.x = 0;
  state.y = 0;
  state.heading = 0;
  out.push({ kind: 'moveTo', x: 0, y: 0, line: drawing.line });
  return;
```

The `empty`, `turn`, `sequence`, `beside`, `above`, and `scale` cases emit no commands directly — leave them as they are.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test --workspace=@sprout/lang`
Expected: every test (new and existing) passes.

- [ ] **Step 7: Commit**

```bash
git add packages/lang/src/renderer.ts packages/lang/tests/renderer.test.ts
git commit -m "feat(lang): renderer carries Drawing.line onto emitted commands"
```

---

## Task 4: Interpreter tags each statement's drawing output

**Files:**
- Modify: `packages/lang/src/interpreter.ts:1196-1213` (evalBlock), `packages/lang/src/interpreter.ts:1521-1550` (interpret), `packages/lang/src/interpreter.ts:1556-1600` (interpretFull)
- Test: `packages/lang/tests/line-attribution.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `packages/lang/tests/line-attribution.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parse } from '@sprout/parser';
import { interpret } from '../src/interpreter.js';
import { render } from '../src/renderer.js';

describe('source line attribution end-to-end', () => {
  it('attributes top-level drawing statements to their source lines', () => {
    const prog = parse('circle(20)\nforward(50)');
    const cmds = render(interpret(prog));
    const circle = cmds.find(c => c.kind === 'drawCircle');
    const lineTo = cmds.find(c => c.kind === 'lineTo');
    expect((circle as { line?: number }).line).toBe(1);
    expect((lineTo as { line?: number }).line).toBe(2);
  });

  it('attributes commands inside a repeat body to the body statement line', () => {
    // forward(10) is on line 2; the repeat header is on line 1.
    const prog = parse('repeat 3 do\n  forward(10)\nend');
    const cmds = render(interpret(prog));
    const lineTos = cmds.filter(c => c.kind === 'lineTo');
    expect(lineTos).toHaveLength(3);
    for (const c of lineTos) {
      expect((c as { line?: number }).line).toBe(2);
    }
  });

  it('leaves commands untagged for block-built ASTs (no source lines)', () => {
    // Build a program where the only statement has no `line` on its CallExpr.
    // Easiest: parse text but strip line off the CallExpr before interpreting.
    const prog = parse('circle(20)');
    const stmt = prog.stmts[0];
    if (stmt.kind !== 'ExprStmt' || stmt.expr.kind !== 'CallExpr') throw new Error('bad fixture');
    const stripped = {
      ...prog,
      stmts: [{ ...stmt, expr: { ...stmt.expr, line: undefined } }],
    };
    const cmds = render(interpret(stripped as typeof prog));
    const circle = cmds.find(c => c.kind === 'drawCircle')!;
    expect((circle as { line?: number }).line).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/lang/tests/line-attribution.test.ts`
Expected: FAIL — every `line` field comes back undefined.

- [ ] **Step 3: Add `stmtLine` helper to `interpreter.ts`**

Place this near the top of `packages/lang/src/interpreter.ts`, after the import block but before any other function (search for the first `function …` after imports and add it just above):

```ts
import { tagLines } from './values.js';
// (merge with existing import from './values.js' if there is one)

/** Source line of a statement, if it's a top-level CallExpr/Ident. */
function stmtLine(stmt: Stmt): number | undefined {
  if (stmt.kind === 'ExprStmt' && (stmt.expr.kind === 'CallExpr' || stmt.expr.kind === 'Ident')) {
    return stmt.expr.line;
  }
  return undefined;
}
```

If `tagLines` is already imported from `./values.js`, add it to the existing import list instead of adding a new line.

- [ ] **Step 4: Wire `stmtLine` + `tagLines` at the three push sites**

In `evalBlock` (around `packages/lang/src/interpreter.ts:1206-1210`), replace:

```ts
if (val !== null && isDrawing(val)) {
  drawings.push(val);
}
```

with:

```ts
if (val !== null && isDrawing(val)) {
  const line = stmtLine(stmt);
  drawings.push(line !== undefined ? tagLines(val, line) : val);
}
```

In `interpret` (around `packages/lang/src/interpreter.ts:1538-1540`), replace the same pattern with the same tagged-push.

In `interpretFull` (around `packages/lang/src/interpreter.ts:1574-1576`), replace the same pattern with the same tagged-push.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=@sprout/lang`
Expected: every test passes — 1036+ existing plus 3 new line-attribution cases.

- [ ] **Step 6: Commit**

```bash
git add packages/lang/src/interpreter.ts packages/lang/tests/line-attribution.test.ts
git commit -m "feat(lang): interpreter tags each statement's drawing with its source line"
```

---

## Task 5: `run-line-highlight.ts` — CodeMirror line decoration module

**Files:**
- Create: `apps/ide/src/run-line-highlight.ts`
- Create: `apps/ide/tests/run-line-highlight.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/ide/tests/run-line-highlight.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { activeLineField, setActiveLine } from '../src/run-line-highlight.js';

function decoCount(state: EditorState): number {
  const set = state.field(activeLineField);
  let n = 0;
  set.between(0, state.doc.length, () => { n++; });
  return n;
}

function firstDecoRange(state: EditorState): { from: number; to: number } | null {
  const set = state.field(activeLineField);
  let found: { from: number; to: number } | null = null;
  set.between(0, state.doc.length, (from, to) => {
    if (found === null) found = { from, to };
  });
  return found;
}

describe('activeLineField + setActiveLine', () => {
  it('starts with no decorations', () => {
    const state = EditorState.create({ doc: 'circle(20)\nforward(50)\n', extensions: [activeLineField] });
    expect(decoCount(state)).toBe(0);
  });

  it('setActiveLine(2) places a line decoration on line 2', () => {
    const initial = EditorState.create({ doc: 'circle(20)\nforward(50)\n', extensions: [activeLineField] });
    const tr = initial.update({ effects: setActiveLine.of(2) });
    const next = tr.state;
    expect(decoCount(next)).toBe(1);
    const range = firstDecoRange(next)!;
    const line2 = next.doc.line(2);
    expect(range.from).toBe(line2.from);
  });

  it('setActiveLine(null) clears the decoration', () => {
    const initial = EditorState.create({ doc: 'a\nb\n', extensions: [activeLineField] });
    const lit = initial.update({ effects: setActiveLine.of(1) }).state;
    expect(decoCount(lit)).toBe(1);
    const cleared = lit.update({ effects: setActiveLine.of(null) }).state;
    expect(decoCount(cleared)).toBe(0);
  });

  it('clamps an out-of-range line to the document bounds', () => {
    const state = EditorState.create({ doc: 'a\nb\n', extensions: [activeLineField] });
    const high = state.update({ effects: setActiveLine.of(99) }).state;
    expect(decoCount(high)).toBe(1);
    const low = state.update({ effects: setActiveLine.of(0) }).state;
    expect(decoCount(low)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/ide/tests/run-line-highlight.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `apps/ide/src/run-line-highlight.ts`:

```ts
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';

/** Tell the editor which 1-based source line is currently being drawn (or null to clear). */
export const setActiveLine = StateEffect.define<number | null>();

const activeLineDeco = Decoration.line({ attributes: { class: 'cm-activeRunLine' } });

export const activeLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(set, tr) {
    set = set.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setActiveLine)) {
        const line = e.value;
        if (line === null) {
          set = Decoration.none;
        } else {
          const total = tr.state.doc.lines;
          const clamped = Math.min(Math.max(line, 1), total);
          const lineInfo = tr.state.doc.line(clamped);
          set = Decoration.set([activeLineDeco.range(lineInfo.from)]);
        }
      }
    }
    return set;
  },
  provide: f => Decoration.none && f as never, // placeholder — decorations applied via the field below
});

// CodeMirror picks up the decoration via EditorView.decorations.from(activeLineField).
// Re-export a self-contained extension that bundles the field + the decoration provider.
import { EditorView } from '@codemirror/view';

export const runLineHighlight = [
  activeLineField,
  EditorView.decorations.from(activeLineField),
];
```

If TypeScript complains about the placeholder `provide:`, remove the `provide` line entirely — CodeMirror does not require it when the decoration provider is supplied separately via `EditorView.decorations.from(...)`. (Verify both forms compile: `StateField.define<DecorationSet>({ create, update })` without `provide` is the canonical form.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/ide/tests/run-line-highlight.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/ide/src/run-line-highlight.ts apps/ide/tests/run-line-highlight.test.ts
git commit -m "feat(ide): run-line-highlight — StateField decoration for the active draw line"
```

---

## Task 6: `TextPanel` exposes `highlightLine` and includes the extension

**Files:**
- Modify: `apps/ide/src/TextPanel.tsx:24-49` (EDITOR_THEME), `apps/ide/src/TextPanel.tsx:51-53` (EditorHandle), `apps/ide/src/TextPanel.tsx:74-82` (useImperativeHandle), `apps/ide/src/TextPanel.tsx:88-106` (extensions list)

- [ ] **Step 1: Extend `EditorHandle`**

Replace the existing `EditorHandle` (lines 51-53):

```ts
export interface EditorHandle {
  jumpToLine(line: number): void;
  /** Highlight (or clear) the given 1-based source line as currently drawing. */
  highlightLine(line: number | null): void;
}
```

- [ ] **Step 2: Add `.cm-activeRunLine` rule to `EDITOR_THEME`**

Inside the `EditorView.theme({ ... })` object (around line 24-49), add one more rule before the closing `})`:

```ts
'.cm-activeRunLine': { background: 'rgba(255, 213, 0, 0.18)' },
```

So the theme keys end with that rule alongside the existing `.cm-activeLine`, `.cm-activeLineGutter`, etc.

- [ ] **Step 3: Include `runLineHighlight` in the editor's extensions and implement `highlightLine`**

Add the import at the top of `apps/ide/src/TextPanel.tsx`:

```ts
import { runLineHighlight, setActiveLine } from './run-line-highlight.js';
```

In the `extensions: [...]` array inside `new EditorView({ ... })` (around line 90-103), add `runLineHighlight` (spread it since it's an array):

```ts
extensions: [
  Prec.highest(keymap.of([
    { key: 'Mod-Enter', run: makeRunCommand(() => onRunRef.current) },
  ])),
  basicSetup,
  sproutLanguage,
  autocompletion({ override: [sproutCompletions] }),
  sproutLinter,
  ...runLineHighlight,
  EDITOR_THEME,
  EditorView.updateListener.of(update => {
    if (update.docChanged) {
      onChangeRef.current?.(update.state.doc.toString());
    }
  }),
],
```

In the `useImperativeHandle` block (around lines 74-82), add the `highlightLine` method:

```ts
useImperativeHandle(ref, () => ({
  jumpToLine(line: number) {
    const view = viewRef.current;
    if (!view) return;
    const pos = lineToPos(view.state, line);
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  },
  highlightLine(line: number | null) {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setActiveLine.of(line) });
  },
}), []);
```

- [ ] **Step 4: Verify the IDE builds**

Run: `npm run build --workspace=apps/ide`
Expected: success (no TypeScript errors).

If the build also runs ESLint or vitest in a single step, those should pass too.

- [ ] **Step 5: Commit**

```bash
git add apps/ide/src/TextPanel.tsx
git commit -m "feat(ide): TextPanel.highlightLine — imperative handle for the active draw line"
```

---

## Task 7: `Stage` reports the active line; `App` wires it to the editor

**Files:**
- Modify: `apps/ide/src/Stage.tsx`, `apps/ide/src/App.tsx:703-712` (`<Stage … />` callsite)

- [ ] **Step 1: Extend `Stage`'s props and emit `onActiveLine` from reveal paths**

Replace `apps/ide/src/Stage.tsx` with this implementation:

```tsx
import { useEffect, useRef } from 'react';
import type { CanvasCommand, SpriteSnapshot } from '@sprout/lang';
import { drawUpTo, drawSprites, getTurtleState, drawTurtle, STAGE_W, STAGE_H } from './stage-utils.js';

interface Props {
  commands: CanvasCommand[];
  animated?: boolean;
  stepsPerFrame?: number;
  drawLimit?: number | null;
  onClick?: () => void;
  onMouseMove?: (x: number, y: number) => void;
  hud?: Record<string, string>;
  sprites?: readonly SpriteSnapshot[];
  /** Called with the source line of the command just drawn, or null to clear. */
  onActiveLine?: (line: number | null) => void;
}

export function Stage({
  commands,
  animated = false,
  stepsPerFrame = 3,
  drawLimit = null,
  onClick,
  onMouseMove,
  hud,
  sprites = [],
  onActiveLine,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Most-recently emitted line, so steps that have no `line` (or no command emitted) don't flicker.
  const lastLine = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    if (drawLimit !== null) {
      const limit = drawLimit;
      drawUpTo(ctx, commands, limit);
      drawSprites(ctx, sprites);
      drawTurtle(ctx, getTurtleState(commands, limit));
      const line = (commands[limit - 1] as { line?: number } | undefined)?.line;
      if (line !== undefined) {
        lastLine.current = line;
        onActiveLine?.(line);
      }
      return;
    }

    if (!animated || commands.length === 0) {
      const limit = commands.length;
      drawUpTo(ctx, commands, limit);
      drawSprites(ctx, sprites);
      drawTurtle(ctx, getTurtleState(commands, limit));
      lastLine.current = null;
      onActiveLine?.(null);
      return;
    }

    let step = 0;
    let rafId = 0;

    function tick() {
      step = Math.min(step + stepsPerFrame, commands.length);
      drawUpTo(ctx, commands, step);
      drawSprites(ctx, sprites);
      drawTurtle(ctx, getTurtleState(commands, step));
      const line = (commands[step - 1] as { line?: number } | undefined)?.line;
      if (line !== undefined && line !== lastLine.current) {
        lastLine.current = line;
        onActiveLine?.(line);
      }
      if (step < commands.length) {
        rafId = requestAnimationFrame(tick);
      } else {
        lastLine.current = null;
        onActiveLine?.(null);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      lastLine.current = null;
      onActiveLine?.(null);
    };
  }, [commands, animated, stepsPerFrame, drawLimit, sprites, onActiveLine]);

  const hudEntries = hud ? Object.entries(hud) : [];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={STAGE_W}
        height={STAGE_H}
        onClick={onClick}
        onMouseMove={onMouseMove ? (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onMouseMove(e.clientX - rect.left - STAGE_W / 2, e.clientY - rect.top - STAGE_H / 2);
        } : undefined}
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          background: '#fff',
          display: 'block',
          cursor: onClick ? 'crosshair' : 'default',
        }}
      />
      {hudEntries.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'rgba(0,0,0,0.55)',
          borderRadius: 4,
          padding: '4px 8px',
          color: '#20c997',
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: '1.6',
          pointerEvents: 'none',
        }}>
          {hudEntries.map(([label, value]) => (
            <div key={label}>{label}: {value}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `App.tsx` to forward `onActiveLine` to the editor**

In `apps/ide/src/App.tsx` (around line 703, the `<Stage … />` callsite), add the prop:

```tsx
<Stage
  commands={commands}
  animated={animated}
  stepsPerFrame={stepsPerFrame}
  drawLimit={drawLimit}
  onClick={hasClickHandler ? handleCanvasClick : undefined}
  onMouseMove={setMousePosition}
  hud={hud}
  sprites={sprites}
  onActiveLine={(line) => editorRef.current?.highlightLine(line)}
/>
```

The callback uses `editorRef` (already declared in `App.tsx:138`); it bypasses React state so animation frames don't re-render the app.

- [ ] **Step 3: Build the IDE and run the full test suite**

Run: `npm test`
Expected: every test (1036 existing + the new lang + run-line-highlight tests) passes.

Run: `npm run build --workspace=apps/ide`
Expected: build succeeds.

- [ ] **Step 4: Manual QA**

Start the dev server: `npm run dev --workspace=apps/ide`

In the editor pane, enter:

```
circle(20)
forward(50)
rect(10, 30)
```

Toggle **Animate** on, click **Run**. Watch the amber highlight step from line 1 → line 2 → line 3 as each shape draws. Stop → toggle Animate off → Run again → no highlight (static draw clears at completion).

Then test a loop:

```
repeat 4 do
  forward(50)
  turn(90)
end
```

Watch line 2 stay highlighted across all four iterations. Confirm the highlight clears when drawing finishes. Switch to blocks mode → confirm no highlight appears there (block-built ASTs have no `line`).

- [ ] **Step 5: Commit**

```bash
git add apps/ide/src/Stage.tsx apps/ide/src/App.tsx
git commit -m "feat(ide): Stage reports active line; editor highlights running statement"
```

---

## Self-Review

**Spec coverage:**
- Part 1.1 (Drawing intersection) → Task 1.
- Part 1.2 (tagLines) → Task 2.
- Part 1.3 (interpreter tagging at evalBlock + interpret + interpretFull) → Task 4.
- Part 1.4 (renderer line copy + scaleDrawing spreads) → Task 3.
- Part 2.1 (Stage onActiveLine, all three reveal paths + cleanup) → Task 7 step 1.
- Part 2.2 (App imperative wiring) → Task 7 step 2.
- Part 2.3 (EditorHandle + run-line-highlight + theme) → Tasks 5 + 6.

**Placeholders:** none. Every code block is the actual content to paste; every command is exact.

**Type consistency:** `Drawing` is added as an intersection type so every member still has `kind`; `CanvasCommand` gains `line?: number` on every variant; `EditorHandle` is extended (not replaced); `Stage`'s new prop is optional so untouched callsites still type-check.

**Known nuances captured:**
- Innermost-wins for `tagLines` (a nested statement's line beats an outer wrapper's).
- `scaleDrawing` was rebuilding nodes from literals — the spread fixes line preservation through `scale` and is a general improvement.
- The `Stage` uses `lastLine` ref so command steps without a `line` (or steps that emit no command — `turn`, `empty`) don't flicker the highlight; the spec calls this out explicitly.
- `interpretFull` matters in addition to `interpret` because the IDE uses `interpretFullWithInputs`, which wraps `interpretFull`. Without tagging there, only `interpret`-only callers would see line attribution — task 4 covers both push sites.
