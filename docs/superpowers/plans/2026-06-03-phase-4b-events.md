# Phase 4b — Click Event Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `on :click do...end` handlers into the IDE so that clicking the canvas invokes the handler, compositing its Drawing output onto the accumulated stage.

**Architecture:** Add two new public functions to `packages/lang/src/interpreter.ts`: `interpretFull()` returns `{ drawing: Drawing; handlers: Map<string, SproutFunction> }` by exposing the final env after interpreting; `callHandler(fn)` evaluates a handler function's body in its closure env. `App.tsx` calls `interpretFull()` on Run, stores handlers and an accumulated Drawing ref; clicking the Stage calls `callHandler`, wraps the result in `mkSequence`, and re-renders. `Stage.tsx` gains an `onClick` prop (already added in Plan 4a).

**Tech Stack:** TypeScript, React, `@sprout/lang`, Vitest

**Dependencies:** Plan 4a must be merged first (Stage.tsx already has `onClick` prop).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/lang/src/interpreter.ts` | Add `interpretFull()` and `callHandler()` |
| Modify | `packages/lang/src/index.ts` | Export the two new functions |
| Modify | `packages/lang/tests/interpreter.test.ts` | Tests for `interpretFull` and `callHandler` |
| Modify | `apps/ide/src/App.tsx` | Call `interpretFull`, accumulate Drawing on click |

> Note: `apps/ide/src/Stage.tsx` already has `onClick?: () => void` from Plan 4a. No changes needed here if Plan 4a is merged.

---

### Task 1: Add `interpretFull` and `callHandler` to interpreter.ts

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/lang/tests/interpreter.test.ts` after the existing test cases:

```typescript
import { describe, it, expect } from 'vitest';
import { interpret, interpretFull, callHandler, SproutRuntimeError } from '../src/interpreter.js';
import { EMPTY, mkForward, mkTurn, mkSequence } from '../src/values.js';
import type { Program, Expr, Stmt } from '../src/ast.js';

// (Reuse existing AST builder helpers from the top of the test file)
// numLit, symLit, call, block, exprStmt, defStmt, program are already defined.

// --- Additional builder needed for OnExpr ---
const onExpr = (eventName: string, bodyStmts: Stmt[]): Expr => ({
  kind: 'OnExpr',
  event: { kind: 'SymbolLit', name: eventName },
  body: { kind: 'BlockExpr', body: bodyStmts },
});

// ---------------------------------------------------------------------------
// interpretFull
// ---------------------------------------------------------------------------
describe('interpretFull', () => {
  it('returns the same drawing as interpret() when there are no handlers', () => {
    const prog = program(exprStmt(call('forward', [numLit(100)])));
    const { drawing, handlers } = interpretFull(prog);
    expect(drawing).toEqual(interpret(prog));
    expect(handlers.size).toBe(0);
  });

  it('exposes a :click handler registered with on :click do...end', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('forward', [numLit(20)]))])),
    );
    const { drawing, handlers } = interpretFull(prog);
    // The on-expr produces no visual drawing at program level
    expect(drawing).toEqual(EMPTY);
    expect(handlers.has(':click')).toBe(true);
    expect(handlers.get(':click')!.kind).toBe('function');
  });

  it('drawing from interpretFull excludes the on-expr visual output', () => {
    // A program with both a forward() and an on :click handler.
    const prog = program(
      exprStmt(call('forward', [numLit(50)])),
      exprStmt(onExpr('click', [exprStmt(call('turn', [numLit(90)]))])),
    );
    const { drawing, handlers } = interpretFull(prog);
    expect(drawing).toEqual(mkForward(50));
    expect(handlers.has(':click')).toBe(true);
  });

  it('handles multiple different event names', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('forward', [numLit(10)]))])),
      exprStmt(onExpr('load', [exprStmt(call('turn', [numLit(45)]))])),
    );
    const { handlers } = interpretFull(prog);
    expect(handlers.has(':click')).toBe(true);
    expect(handlers.has(':load')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// callHandler
// ---------------------------------------------------------------------------
describe('callHandler', () => {
  it('evaluates handler body and returns a Drawing', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('forward', [numLit(30)]))])),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    const delta = callHandler(fn);
    expect(delta).toEqual(mkForward(30));
  });

  it('returns EMPTY when handler body produces no drawing', () => {
    // Handler that only calls puts (returns EMPTY)
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('puts', [numLit(1)]))])),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    const delta = callHandler(fn);
    expect(delta).toEqual(EMPTY);
  });

  it('handler closure captures variables defined before the on-expr', () => {
    // def step = forward(5)
    // on :click do step end
    const prog = program(
      defStmt('step', [], call('forward', [numLit(5)])),
      exprStmt(onExpr('click', [exprStmt({ kind: 'Ident', name: 'step' })])),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    const delta = callHandler(fn);
    expect(delta).toEqual(mkForward(5));
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```
bun run vitest run packages/lang/tests/interpreter.test.ts
```

Expected: FAIL with `interpretFull is not a function` and `callHandler is not a function`

- [ ] **Step 3: Implement `interpretFull` and `callHandler` in interpreter.ts**

Add the following two exports at the bottom of `packages/lang/src/interpreter.ts`, after the existing `interpret()` function:

```typescript
/**
 * Like `interpret`, but also returns the event handlers registered by
 * `on :eventName do...end` statements, keyed by `':eventName'`.
 */
export function interpretFull(
  program: Program,
  initialEnv: Env = EMPTY_ENV,
): { drawing: Drawing; handlers: Map<string, SproutFunction> } {
  let env: Env = initialEnv;
  const drawings: Drawing[] = [];

  for (const stmt of program.stmts) {
    const [val, newEnv] = evalStmtWithEnv(stmt, env);
    env = newEnv;
    if (val !== null && isDrawing(val)) {
      drawings.push(val);
    }
  }

  const handlers = new Map<string, SproutFunction>();
  for (const [key, val] of env) {
    if (key.startsWith(':') && val.kind === 'function') {
      handlers.set(key, val as SproutFunction);
    }
  }

  return {
    drawing: drawings.length === 0 ? EMPTY : mkSequence(drawings),
    handlers,
  };
}

/**
 * Invoke a zero-parameter event handler closure and return the Drawing it
 * produces.  Returns EMPTY if the body produces a non-Drawing value.
 */
export function callHandler(fn: SproutFunction): Drawing {
  const result = evalExpr(fn.body, fn.env);
  return isDrawing(result) ? result : EMPTY;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```
bun run vitest run packages/lang/tests/interpreter.test.ts
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add interpretFull() and callHandler() for event handler support"
```

---

### Task 2: Export the new functions from `packages/lang/src/index.ts`

**Files:**
- Modify: `packages/lang/src/index.ts`

- [ ] **Step 1: Add exports**

In `packages/lang/src/index.ts`, find the line:

```typescript
export { interpret, SproutRuntimeError } from './interpreter.js';
```

Replace it with:

```typescript
export { interpret, interpretFull, callHandler, SproutRuntimeError } from './interpreter.js';
```

- [ ] **Step 2: Run tests to verify no regressions**

```
bun run vitest run
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```
git add packages/lang/src/index.ts
git commit -m "feat(lang): export interpretFull and callHandler from public index"
```

---

### Task 3: Wire event handling into App.tsx

**Files:**
- Modify: `apps/ide/src/App.tsx`

- [ ] **Step 1: Write the updated App.tsx**

Replace the entire contents of `apps/ide/src/App.tsx`:

```typescript
import { useRef, useState } from 'react';
import type * as Blockly from 'blockly';
import { compileWorkspace } from '@sprout/blocks';
import {
  interpretFull,
  callHandler,
  render,
  mkSequence,
  SproutRuntimeError,
} from '@sprout/lang';
import type { CanvasCommand, Drawing, SproutFunction } from '@sprout/lang';
import { BlockWorkspace } from './BlockWorkspace.js';
import { TextPanel } from './TextPanel.js';
import { Stage } from './Stage.js';

export function App() {
  const wsRef = useRef<Blockly.Workspace | null>(null);
  const [programText, setProgramText] = useState('');
  const [commands, setCommands] = useState<CanvasCommand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [stepsPerFrame, setStepsPerFrame] = useState(3);

  // Accumulated drawing state for click handler compositing
  const accDrawingRef = useRef<Drawing | null>(null);
  const [handlers, setHandlers] = useState<Map<string, SproutFunction>>(new Map());

  function handleRun() {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      setError(null);
      const program = compileWorkspace(ws);
      const { drawing, handlers: h } = interpretFull(program);
      accDrawingRef.current = drawing;
      setHandlers(h);
      setCommands(render(drawing));
    } catch (e) {
      setError(e instanceof SproutRuntimeError ? e.message : String(e));
      setCommands([]);
      setHandlers(new Map());
      accDrawingRef.current = null;
    }
  }

  function handleCanvasClick() {
    const clickFn = handlers.get(':click');
    if (!clickFn || accDrawingRef.current === null) return;
    try {
      const delta = callHandler(clickFn);
      const next = mkSequence([accDrawingRef.current, delta]);
      accDrawingRef.current = next;
      setCommands(render(next));
    } catch (e) {
      setError(e instanceof SproutRuntimeError ? e.message : String(e));
    }
  }

  const hasClickHandler = handlers.has(':click');

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'sans-serif' }}>
      {/* Left: Blockly workspace */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <BlockWorkspace
          onTextChange={setProgramText}
          onWorkspaceReady={ws => { wsRef.current = ws; }}
        />
      </div>

      {/* Right: controls + text panel + stage */}
      <div
        style={{
          width: 524,
          display: 'flex',
          flexDirection: 'column',
          padding: 8,
          gap: 8,
          background: '#f8fafc',
          borderLeft: '1px solid #e2e8f0',
        }}
      >
        <button
          onClick={handleRun}
          style={{
            padding: '8px 0',
            fontSize: 15,
            fontWeight: 600,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ▶ Run
        </button>

        {/* Animation controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={animated}
              onChange={e => setAnimated(e.target.checked)}
            />
            Animate
          </label>
          {animated && (
            <>
              <span>Speed:</span>
              <input
                type="range"
                min={1}
                max={20}
                value={stepsPerFrame}
                onChange={e => setStepsPerFrame(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ minWidth: 20, textAlign: 'right' }}>{stepsPerFrame}</span>
            </>
          )}
        </div>

        {hasClickHandler && (
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            Click the canvas to fire the :click handler
          </div>
        )}

        <TextPanel text={programText} />

        <Stage
          commands={commands}
          animated={animated}
          stepsPerFrame={stepsPerFrame}
          onClick={hasClickHandler ? handleCanvasClick : undefined}
        />

        {error && (
          <pre
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 8,
              borderRadius: 4,
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </pre>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

```
bun run vitest run
```

Expected: All tests pass

- [ ] **Step 3: Manual visual verification**

Start the dev server: `bun run --cwd apps/ide dev`

Checklist using the block editor:
- [ ] Drag an `on :click` block, put `forward 20` + `turn 15` in its body. Press Run.
  - Stage shows empty canvas (on-expr produces no initial drawing).
  - A hint message appears: "Click the canvas to fire the :click handler"
  - Canvas cursor is a crosshair.
- [ ] Click the canvas — turtle draws `forward 20` + `turn 15`.
- [ ] Click again — turtle continues from where it left off (draws another forward+turn, composited as a new sequence).
- [ ] Click 10+ times — the accumulated path keeps growing, each click adds a segment.
- [ ] Press Run again — stage resets to the initial drawing (accDrawingRef is reset).
- [ ] Program with BOTH a top-level drawing AND a click handler (e.g., forward 50 at top, on :click forward 20):
  - Run shows the initial forward 50 line.
  - Clicking adds forward 20 segments composited after the initial drawing.
- [ ] Program with no click handler — canvas cursor is default, clicking does nothing.
- [ ] No console errors.

- [ ] **Step 4: Commit**

```
git add apps/ide/src/App.tsx
git commit -m "feat(ide): wire on :click handlers — canvas click composites drawing delta"
```

---

## Self-Review Checklist

- Spec coverage: `on :click` fires on click ✓, composites Drawing ✓, closure captures env ✓
- `callHandler` returns `EMPTY` for non-Drawing results (not a throw) ✓
- `accDrawingRef` resets on each Run so old accumulated state doesn't bleed into re-runs ✓
- `handlers` state cleared on run error so stale handlers can't fire after a bad program ✓
- `onClick` only wired when `:click` handler exists, cursor changes accordingly ✓
- `interpretFull` is identical in logic to `interpret` for programs with no handlers ✓
