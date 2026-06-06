# HUD Display & Variable Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `show(label, value)` builtin that renders a persistent HUD overlay on the canvas, and a variable inspector panel in the IDE that shows all `let`-bound mutable variables after each run or event.

**Architecture:** `_hudValues` module-level Map in `interpreter.ts` captures `show()` calls; `interpretFull`/`callHandler` return type gains `hud` and `variables` fields; `Stage.tsx` renders the HUD as an absolute-positioned HTML div overlay; a new `VariableInspector.tsx` renders below the canvas; `App.tsx` threads both through state.

**Tech Stack:** TypeScript, Vitest (`/c/Users/samer/.bun/bin/bun test`), Blockly 10, React

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `packages/lang/src/interpreter.ts` | `_hudValues`, `formatValue`, `show` builtin, `extractVariables`, extend return types |
| Modify | `packages/lang/src/index.ts` | Re-export (no new exports needed — types inferred) |
| Modify | `packages/lang/tests/interpreter.test.ts` | Tests for `show`, `hud`, `variables`, `callHandler` |
| Modify | `packages/blocks/src/definitions/statements.ts` | `sprout_show` block definition |
| Modify | `packages/blocks/src/compiler.ts` | `sprout_show` compiler case |
| Modify | `apps/ide/src/BlockWorkspace.tsx` | `sprout_show` toolbox entry |
| Modify | `apps/ide/src/Stage.tsx` | `hud` prop + overlay div |
| Create | `apps/ide/src/VariableInspector.tsx` | Variable inspector panel |
| Modify | `apps/ide/src/App.tsx` | `hud`/`variables` state, wire up to Stage + VariableInspector |

---

### Task 1: `show` builtin + `hud` on `interpretFull`

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/lang/tests/interpreter.test.ts` after the last `});`:

```typescript
// ---------------------------------------------------------------------------
// show builtin + hud field
// ---------------------------------------------------------------------------
describe('show builtin', () => {
  it('show("Score", 5) — hud has { Score: "5" }', () => {
    const prog = program(
      exprStmt(call('show', [strLit('Score'), numLit(5)]))
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ Score: '5' });
  });

  it('show called twice with same label replaces value', () => {
    const prog = program(
      exprStmt(call('show', [strLit('Score'), numLit(5)])),
      exprStmt(call('show', [strLit('Score'), numLit(6)])),
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ Score: '6' });
  });

  it('show called with two different labels produces two entries', () => {
    const prog = program(
      exprStmt(call('show', [strLit('Score'), numLit(5)])),
      exprStmt(call('show', [strLit('Lives'), numLit(3)])),
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ Score: '5', Lives: '3' });
  });

  it('hud is empty when show is never called', () => {
    const prog = program(exprStmt(numLit(1)));
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({});
  });

  it('show with list value formats as "[3 items]"', () => {
    const prog = program(
      exprStmt(call('show', [strLit('xs'), call('list', [numLit(1), numLit(2), numLit(3)])]))
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ xs: '[3 items]' });
  });

  it('show with bool value formats as "true"', () => {
    const prog = program(
      exprStmt(call('show', [strLit('flag'), boolLit(true)]))
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ flag: 'true' });
  });

  it('show with wrong arity throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('show', [strLit('x')])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('show with non-string label throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('show', [numLit(1), numLit(2)])));
    expect(() => interpretFull(prog)).toThrow('show: label must be a string, got number');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

```
/c/Users/samer/.bun/bin/bun test packages/lang/tests/interpreter.test.ts
```

Expected: 8 new failures — `interpretFull(prog).hud` is undefined or `show` is unbound.

- [ ] **Step 3: Implement `_hudValues`, `formatValue`, `show` builtin, and extend `interpretFull`**

In `packages/lang/src/interpreter.ts`:

**3a.** After the `_inputValues` declaration (around line 83), add:

```typescript
// Module-level HUD values — set by show() during each run.
let _hudValues: Map<string, string> = new Map();

function formatValue(v: SproutValue): string {
  switch (v.kind) {
    case 'number': return String(v.value);
    case 'string': return v.value;
    case 'bool': return String(v.value);
    case 'symbol': return `:${v.name}`;
    case 'list': return `[${v.items.length} items]`;
    case 'function': return 'fn';
    case 'var': return formatValue(v.cell.value);
    default: return `<${(v as SproutValue).kind}>`;
  }
}
```

**3b.** In the `BUILTINS` map, add `show` after the `contains` entry:

```typescript
  ['show', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`show expects 2 arguments, got ${args.length}`);
    if (args[0].kind !== 'string') throw new SproutRuntimeError(`show: label must be a string, got ${args[0].kind}`);
    _hudValues.set((args[0] as SproutString).value, formatValue(args[1]));
    return EMPTY;
  }],
```

**3c.** Clear `_hudValues` at the start of `interpret` (the main interpret function). Find the opening of `interpret` (around line 1090) and add the clear at the very start of the function body:

```typescript
export function interpret(program: Program, initialEnv: Env = EMPTY_ENV): Drawing {
  _hudValues = new Map();
  // ... rest unchanged
```

**3d.** Clear `_hudValues` at the start of `interpretFull` too:

```typescript
export function interpretFull(
  program: Program,
  initialEnv: Env = EMPTY_ENV,
): { drawing: Drawing; handlers: Map<string, SproutFunction>; hud: Record<string, string>; variables: Record<string, string> } {
  _hudValues = new Map();
  // ... rest of existing body unchanged until the return statement ...
  return {
    drawing: drawings.length === 0 ? EMPTY : mkSequence(drawings),
    handlers,
    hud: Object.fromEntries(_hudValues),
    variables: {},  // filled in Task 2
  };
}
```

Also update `interpretFullWithInputs` return type to match:

```typescript
export function interpretFullWithInputs(
  program: Program,
  inputs: ReadonlyMap<string, number>,
  initialEnv: Env = EMPTY_ENV,
): { drawing: Drawing; handlers: Map<string, SproutFunction>; hud: Record<string, string>; variables: Record<string, string> } {
  const prev = _inputValues;
  _inputValues = inputs;
  try {
    return interpretFull(program, initialEnv);
  } finally {
    _inputValues = prev;
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```
/c/Users/samer/.bun/bin/bun test packages/lang/tests/interpreter.test.ts
```

Expected: all pass (the `variables: {}` stub is fine — Task 2 fills it in).

- [ ] **Step 5: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add show() builtin and hud field on interpretFull"
```

---

### Task 2: `variables` field + extend `callHandler`

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/lang/tests/interpreter.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// variables field on interpretFull
// ---------------------------------------------------------------------------
describe('interpretFull variables field', () => {
  it('let x = 5 → variables has { x: "5" }', () => {
    const prog = program(letStmt('x', numLit(5)));
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({ x: '5' });
  });

  it('let x = 5 then x = 9 → variables has { x: "9" }', () => {
    const prog = program(
      letStmt('x', numLit(5)),
      assignStmt('x', numLit(9)),
    );
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({ x: '9' });
  });

  it('def f() = 1 → f excluded from variables', () => {
    const prog = program(defStmt('f', [], numLit(1)));
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({});
  });

  it('let x = 5 and def f() = 1 → only x in variables', () => {
    const prog = program(
      letStmt('x', numLit(5)),
      defStmt('f', [], numLit(1)),
    );
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({ x: '5' });
  });

  it('let xs = list(1,2,3) → variables has { xs: "[3 items]" }', () => {
    const prog = program(letStmt('xs', call('list', [numLit(1), numLit(2), numLit(3)])));
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({ xs: '[3 items]' });
  });

  it('empty program → variables is {}', () => {
    const prog = program();
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// callHandler return type
// ---------------------------------------------------------------------------
describe('callHandler hud and variables', () => {
  it('callHandler returns hud entries written by show() inside handler', () => {
    // def handler via on :click do show("Score", 42) end
    const prog = program(
      exprStmt(call('on', [{ kind: 'SymbolLit', name: 'click' }, null], {
        kind: 'BlockExpr', params: [], stmts: [
          exprStmt(call('show', [strLit('Score'), numLit(42)]))
        ]
      }))
    );
    // Build it directly via letStmt + defStmt shorthand instead:
    // Actually use interpretFull to get handler then callHandler
    const handlerProg = program(
      letStmt('score', numLit(0)),
    );
    // Simpler: build a SproutFunction manually and call it
    const { handlers } = interpretFull(program(
      exprStmt({ kind: 'OnExpr', event: 'click', body: { kind: 'BlockExpr', params: [], stmts: [
        exprStmt(call('show', [strLit('Score'), numLit(99)])),
      ]} })
    ));
    const fn = handlers.get(':click')!;
    expect(fn).toBeDefined();
    const result = callHandler(fn);
    expect(result.hud).toEqual({ Score: '99' });
  });

  it('callHandler returns variables reflecting mutated let-bindings', () => {
    const prog = program(
      letStmt('score', numLit(0)),
      exprStmt({ kind: 'OnExpr', event: 'click', body: { kind: 'BlockExpr', params: [], stmts: [
        assignStmt('score', infix('+', ident('score'), numLit(1))),
      ]} }),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    callHandler(fn);
    const result = callHandler(fn);
    expect(result.variables).toEqual({ score: '2' });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

```
/c/Users/samer/.bun/bin/bun test packages/lang/tests/interpreter.test.ts
```

Expected: `variables` tests fail (returning `{}`), `callHandler` tests fail (result has no `hud`/`variables`).

- [ ] **Step 3: Implement `extractVariables` and fill in `variables` field**

In `packages/lang/src/interpreter.ts`:

**3a.** Add `extractVariables` helper after `formatValue`:

```typescript
function extractVariables(env: Env): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of env) {
    if (key.startsWith(':')) continue;           // event handlers
    if (val.kind === 'function') continue;        // def-bound functions
    if (val.kind === 'var') {
      const inner = val.cell.value;
      if (inner.kind === 'function') continue;    // let f = def ... → skip
      result[key] = formatValue(inner);
    }
    // Non-var values in env are immutable let-bindings (e.g. let x = list(...))
    // They have no 'var' wrapper — include them directly
    // (In practice Sprout wraps all let bindings in SproutVar, but guard anyway)
  }
  return result;
}
```

**3b.** Replace `variables: {}` in `interpretFull` return with:

```typescript
    variables: extractVariables(env),
```

**3c.** Extend `callHandler` to return `{ drawing, hud, variables }`:

```typescript
export function callHandler(fn: SproutFunction): { drawing: Drawing; hud: Record<string, string>; variables: Record<string, string> } {
  _hudValues = new Map();
  try {
    const result = evalExpr(fn.body, fn.env);
    const drawing = isDrawing(result) ? result : EMPTY;
    return { drawing, hud: Object.fromEntries(_hudValues), variables: extractVariables(fn.env) };
  } catch (e) {
    if (e instanceof ReturnBundle) {
      return { drawing: e.drawing, hud: Object.fromEntries(_hudValues), variables: extractVariables(fn.env) };
    }
    throw e;
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

```
/c/Users/samer/.bun/bin/bun test packages/lang/tests/interpreter.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add variables field to interpretFull and extend callHandler return type"
```

---

### Task 3: Blockly block + compiler + toolbox

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `apps/ide/src/BlockWorkspace.tsx`

- [ ] **Step 1: Add `sprout_show` block to `statements.ts`**

In `packages/blocks/src/definitions/statements.ts`, add before the closing `}` of the export function:

```typescript
  Blockly.Blocks['sprout_show'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LABEL').setCheck('String').appendField('show label');
      this.appendValueInput('VALUE').setCheck(null).appendField('value');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('Show a value on the canvas HUD');
    },
  };
```

- [ ] **Step 2: Add `sprout_show` compiler case**

In `packages/blocks/src/compiler.ts`, find the `compileStmtBlock` function (the switch that handles statement blocks). Add before the `default:` case:

```typescript
    case 'sprout_show': {
      const label = compileExpr(mustGetInput(block, 'LABEL'));
      const value = compileExpr(mustGetInput(block, 'VALUE'));
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee: 'show', args: [label, value], block: null } };
    }
```

- [ ] **Step 3: Add toolbox entry**

In `apps/ide/src/BlockWorkspace.tsx`, find the `// Output` comment and replace it with a `// Display` section:

```typescript
    // Display
    { kind: 'block', type: 'sprout_show' },
    // Output
    { kind: 'block', type: 'sprout_puts' },
```

- [ ] **Step 4: Run full test suite**

```
/c/Users/samer/.bun/bin/bun test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(ide): add sprout_show block, compiler case, and toolbox entry"
```

---

### Task 4: Stage.tsx HUD overlay

**Files:**
- Modify: `apps/ide/src/Stage.tsx`

- [ ] **Step 1: Update Stage.tsx**

Replace the entire file with:

```typescript
import { useEffect, useRef } from 'react';
import type { CanvasCommand } from '@sprout/lang';
import { drawUpTo, getTurtleState, drawTurtle, STAGE_W, STAGE_H } from './stage-utils.js';

interface Props {
  commands: CanvasCommand[];
  animated?: boolean;
  stepsPerFrame?: number;
  onClick?: () => void;
  hud?: Record<string, string>;
}

export function Stage({ commands, animated = false, stepsPerFrame = 3, onClick, hud }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    if (!animated || commands.length === 0) {
      const limit = commands.length;
      drawUpTo(ctx, commands, limit);
      drawTurtle(ctx, getTurtleState(commands, limit));
      return;
    }

    let step = 0;
    let rafId = 0;

    function tick() {
      step = Math.min(step + stepsPerFrame, commands.length);
      drawUpTo(ctx, commands, step);
      drawTurtle(ctx, getTurtleState(commands, step));
      if (step < commands.length) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [commands, animated, stepsPerFrame]);

  const hudEntries = hud ? Object.entries(hud) : [];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={STAGE_W}
        height={STAGE_H}
        onClick={onClick}
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

- [ ] **Step 2: Run full test suite**

```
/c/Users/samer/.bun/bin/bun test
```

Expected: all pass.

- [ ] **Step 3: Commit**

```
git add apps/ide/src/Stage.tsx
git commit -m "feat(ide): add HUD overlay to Stage — renders show() entries over canvas"
```

---

### Task 5: VariableInspector + App.tsx wiring

**Files:**
- Create: `apps/ide/src/VariableInspector.tsx`
- Modify: `apps/ide/src/App.tsx`

- [ ] **Step 1: Create `VariableInspector.tsx`**

Create `apps/ide/src/VariableInspector.tsx`:

```typescript
interface Props {
  variables: Record<string, string>;
}

export function VariableInspector({ variables }: Props) {
  const entries = Object.entries(variables);
  if (entries.length === 0) return null;

  return (
    <div style={{
      width: 500,
      marginTop: 4,
      border: '1px solid #e2e8f0',
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 13,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '3px 8px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        color: '#64748b',
        fontWeight: 600,
      }}>
        Variables
      </div>
      {entries.map(([name, value], i) => (
        <div key={name} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '2px 8px',
          background: i % 2 === 0 ? '#fff' : '#f8fafc',
        }}>
          <span style={{ color: '#1e293b' }}>{name}</span>
          <span style={{ color: '#2563eb' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire up App.tsx**

In `apps/ide/src/App.tsx`:

**2a.** Add import:

```typescript
import { VariableInspector } from './VariableInspector.js';
```

**2b.** Add state after the existing `inputValues` state:

```typescript
  const [hud, setHud] = useState<Record<string, string>>({});
  const [variables, setVariables] = useState<Record<string, string>>({});
```

**2c.** In `handleRun`, update the destructuring of `interpretFullWithInputs` result (currently line 174):

```typescript
      const { drawing, handlers: h, hud: newHud, variables: newVars } = interpretFullWithInputs(program, inputMap);
      accDrawingRef.current = drawing;
      handlersRef.current = h;
      setHandlers(h);
      setCommands(render(drawing));
      setHud(newHud);
      setVariables(newVars);
```

**2d.** Update `applyHandlerDelta` to accept the new `callHandler` return type. Find the function and all three call sites:

Replace the function definition:

```typescript
  function applyHandlerDelta(result: { drawing: Drawing; hud: Record<string, string>; variables: Record<string, string> }) {
    const { drawing: delta, hud: newHud, variables: newVars } = result;
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
    setHud(newHud);
    setVariables(newVars);
  }
```

The three `callHandler` call sites already pass their return value directly to `applyHandlerDelta` — no other changes needed there since `callHandler` now returns the right shape.

**2e.** Pass `hud` to `<Stage>` and add `<VariableInspector>` below it. Find the `<Stage` JSX and update:

```typescript
        <Stage
          commands={commands}
          animated={animated}
          stepsPerFrame={stepsPerFrame}
          onClick={handlers.has(':click') ? handleCanvasClick : undefined}
          hud={hud}
        />
        <VariableInspector variables={variables} />
```

- [ ] **Step 3: Run full test suite**

```
/c/Users/samer/.bun/bin/bun test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```
git add apps/ide/src/VariableInspector.tsx apps/ide/src/App.tsx
git commit -m "feat(ide): add VariableInspector panel and wire hud/variables state through App"
```

---

## Self-Review

**Spec coverage:**
- `show(label, value)` builtin with label→value map ✓ Task 1
- Replacing same label ✓ Task 1 tests
- `hud: Record<string, string>` on `interpretFull`/`interpretFullWithInputs` ✓ Task 1
- `variables` field on `interpretFull` ✓ Task 2
- `let`-bound vars only, `def` functions excluded ✓ Task 2 tests
- `callHandler` returns `{ drawing, hud, variables }` ✓ Task 2
- `sprout_show` Blockly block + compiler + toolbox ✓ Task 3
- HUD overlay in Stage (absolute div, teal, bottom-left, pointer-events none) ✓ Task 4
- `VariableInspector` — hidden when empty, name+value rows ✓ Task 5
- App state + handleRun + applyHandlerDelta wired ✓ Task 5

**Placeholder scan:** No TBDs. All steps have full code.

**Type consistency:**
- `callHandler` returns `{ drawing: Drawing; hud: Record<string, string>; variables: Record<string, string> }` — used consistently in Task 2 (definition) and Task 5 (`applyHandlerDelta` parameter type).
- `interpretFull` return type updated in Task 1 with `variables: {}` stub, filled in Task 2 — consistent throughout.
- `formatValue` defined in Task 1, used in Task 2 (`extractVariables`) — consistent.
