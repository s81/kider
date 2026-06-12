# Number Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Sprout programs read user-supplied numbers via `input("name")`, with a matching IDE panel that shows labeled fields before Run.

**Architecture:** Three-layer feature. Lang layer adds the `input` builtin (reads from a module-level `Map`), `collectInputNames` (AST scan), and `interpretWithInputs` / `interpretFullWithInputs` (set the map, delegate to existing `interpret`/`interpretFull`). Blocks layer adds a `sprout_input` value block that compiles to `CallExpr { callee: 'input', args: [StringLit] }`. IDE layer scans the program for input names on every edit, renders labeled number fields, and calls `interpretFullWithInputs` on Run.

**Tech Stack:** TypeScript, Vitest (`bun test`), Blockly 10, React

---

## File Map

| File | Change |
|------|--------|
| `packages/lang/src/interpreter.ts` | Add `_inputValues` module var, `input` builtin, `collectInputNames`, `interpretWithInputs`, `interpretFullWithInputs` |
| `packages/lang/src/index.ts` | Export `collectInputNames`, `interpretWithInputs`, `interpretFullWithInputs` |
| `packages/lang/tests/interpreter.test.ts` | Add `input builtin` and `collectInputNames` describe blocks |
| `packages/blocks/src/definitions/values.ts` | Add `sprout_input` block definition |
| `packages/blocks/src/compiler.ts` | Add `sprout_input` case in `compileExpr` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_input` to toolbox |
| `packages/blocks/tests/compiler.test.ts` | Add `sprout_input` compiler test |
| `apps/ide/src/App.tsx` | Add input panel state + JSX, switch to `interpretFullWithInputs` |

---

### Task 1: Lang layer — `input` builtin, `collectInputNames`, `interpretWithInputs`

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/src/index.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write the failing tests**

At the top of `packages/lang/tests/interpreter.test.ts`, add `collectInputNames`, `interpretWithInputs` to the import:

```typescript
import { interpret, interpretFull, callHandler, collectInputNames, interpretWithInputs, SproutRuntimeError } from '../src/interpreter.js';
```

At the end of the test file, add these two `describe` blocks:

```typescript
// ---------------------------------------------------------------------------
// input builtin
// ---------------------------------------------------------------------------
describe('input builtin', () => {
  it('interpretWithInputs returns value from map', () => {
    const prog = program(exprStmt(call('forward', [call('input', [strLit('x')])])));
    const inputs = new Map<string, number>([['x', 42]]);
    expect(interpretWithInputs(prog, inputs)).toEqual(mkSequence([mkForward(42)]));
  });

  it('returns 0 for missing key', () => {
    const prog = program(exprStmt(call('forward', [call('input', [strLit('y')])])));
    const inputs = new Map<string, number>([['x', 42]]);
    expect(interpretWithInputs(prog, inputs)).toEqual(mkSequence([mkForward(0)]));
  });

  it('interpret (no inputs) returns 0', () => {
    const prog = program(exprStmt(call('forward', [call('input', [strLit('x')])])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(0)]));
  });

  it('throws when argument is not a string', () => {
    const prog = program(exprStmt(call('forward', [call('input', [numLit(5)])])));
    expect(() => interpretWithInputs(prog, new Map())).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// collectInputNames
// ---------------------------------------------------------------------------
describe('collectInputNames', () => {
  it('returns [] for empty program', () => {
    expect(collectInputNames(program())).toEqual([]);
  });

  it('returns [name] for a single input call', () => {
    const prog = program(exprStmt(call('forward', [call('input', [strLit('speed')])])));
    expect(collectInputNames(prog)).toEqual(['speed']);
  });

  it('deduplicates repeated names', () => {
    const prog = program(
      exprStmt(call('forward', [call('input', [strLit('x')])])),
      exprStmt(call('forward', [call('input', [strLit('x')])])),
    );
    expect(collectInputNames(prog)).toEqual(['x']);
  });

  it('returns names in order of first appearance', () => {
    const prog = program(
      exprStmt(call('forward', [call('input', [strLit('a')])])),
      exprStmt(call('forward', [call('input', [strLit('b')])])),
    );
    expect(collectInputNames(prog)).toEqual(['a', 'b']);
  });

  it('finds names nested inside a def body', () => {
    const defBody: Expr = {
      kind: 'BlockExpr',
      body: [exprStmt(call('forward', [call('input', [strLit('size')])]))],
    };
    const prog = program(defStmt('draw', [], defBody));
    expect(collectInputNames(prog)).toEqual(['size']);
  });

  it('ignores input() calls where arg is not a StringLit', () => {
    const prog = program(exprStmt(call('input', [ident('x')])));
    expect(collectInputNames(prog)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun test packages/lang/tests/interpreter.test.ts
```

Expected: tests in `input builtin` and `collectInputNames` fail with import/not-defined errors. Everything else still passes.

- [ ] **Step 3: Add `_inputValues` and the `input` builtin**

In `packages/lang/src/interpreter.ts`, directly before the `// ---------------------------------------------------------------------------` comment that precedes the `// Core evaluator` section (around line 400), add a module-level variable:

```typescript
// ---------------------------------------------------------------------------
// Module-level input values — set by interpretWithInputs before each run.
// ---------------------------------------------------------------------------

let _inputValues: ReadonlyMap<string, number> = new Map();
```

In the BUILTINS map, add the `input` entry just before the closing `]);` (after the `length` entry):

```typescript
  ['input', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`input expects 1 argument, got ${args.length}`);
    const name = assertString(args[0], 'input');
    return { kind: 'number', value: _inputValues.get(name.value) ?? 0 } satisfies SproutNumber;
  }],
```

- [ ] **Step 4: Add `collectInputNames`**

After `callHandler` (the last exported function, around line 853), add:

```typescript
// ---------------------------------------------------------------------------
// Input name collection — AST scan for input("literal") calls
// ---------------------------------------------------------------------------

/**
 * Walk `program` and return a deduplicated list of string literals passed to
 * `input("name")` calls, in order of first appearance.
 */
export function collectInputNames(program: Program): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  function walkExpr(expr: Expr): void {
    switch (expr.kind) {
      case 'CallExpr':
        if (
          expr.callee === 'input' &&
          expr.args.length >= 1 &&
          expr.args[0].kind === 'StringLit'
        ) {
          const name = (expr.args[0] as StringLit).value;
          if (!seen.has(name)) { seen.add(name); result.push(name); }
        }
        for (const arg of expr.args) walkExpr(arg);
        if (expr.block !== null) walkBlock(expr.block);
        break;
      case 'InfixExpr':
        walkExpr(expr.left); walkExpr(expr.right);
        break;
      case 'UnaryExpr':
        walkExpr(expr.operand);
        break;
      case 'BlockExpr':
        walkBlock(expr);
        break;
      case 'RepeatExpr':
        walkExpr(expr.count); walkBlock(expr.body);
        break;
      case 'OnExpr':
        walkBlock(expr.body);
        break;
      case 'IfExpr':
        walkExpr(expr.cond); walkBlock(expr.then);
        if (expr.else !== null) walkBlock(expr.else);
        break;
      case 'WhileExpr':
        walkExpr(expr.cond); walkBlock(expr.body);
        break;
      // Leaf nodes — no children to walk
    }
  }

  function walkBlock(blk: BlockExpr): void {
    for (const stmt of blk.body) walkStmt(stmt);
  }

  function walkStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'DefStmt': walkExpr(stmt.body); break;
      case 'ExprStmt': walkExpr(stmt.expr); break;
      case 'LetStmt': walkExpr(stmt.init); break;
      case 'AssignStmt': walkExpr(stmt.value); break;
      case 'ReturnStmt': walkExpr(stmt.value); break;
    }
  }

  for (const stmt of program.stmts) walkStmt(stmt);
  return result;
}
```

- [ ] **Step 5: Add `interpretWithInputs` and `interpretFullWithInputs`**

After `collectInputNames`, add:

```typescript
/**
 * Like `interpret`, but supplies `inputs` so that `input("name")` calls
 * return the corresponding values. Missing names return 0.
 */
export function interpretWithInputs(
  program: Program,
  inputs: ReadonlyMap<string, number>,
  initialEnv: Env = EMPTY_ENV,
): Drawing {
  const prev = _inputValues;
  _inputValues = inputs;
  try {
    return interpret(program, initialEnv);
  } finally {
    _inputValues = prev;
  }
}

/**
 * Like `interpretFull`, but supplies `inputs` for `input("name")` calls.
 */
export function interpretFullWithInputs(
  program: Program,
  inputs: ReadonlyMap<string, number>,
  initialEnv: Env = EMPTY_ENV,
): { drawing: Drawing; handlers: Map<string, SproutFunction> } {
  const prev = _inputValues;
  _inputValues = inputs;
  try {
    return interpretFull(program, initialEnv);
  } finally {
    _inputValues = prev;
  }
}
```

- [ ] **Step 6: Export from `packages/lang/src/index.ts`**

Replace line 66:

```typescript
export { interpret, interpretFull, callHandler, SproutRuntimeError } from './interpreter.js';
```

With:

```typescript
export {
  interpret,
  interpretFull,
  interpretWithInputs,
  interpretFullWithInputs,
  collectInputNames,
  callHandler,
  SproutRuntimeError,
} from './interpreter.js';
```

- [ ] **Step 7: Run all tests and verify they pass**

```
bun test
```

Expected: all tests pass including new `input builtin` and `collectInputNames` tests. Total count goes from 461 to ~472.

- [ ] **Step 8: Commit**

```bash
git add packages/lang/src/interpreter.ts packages/lang/src/index.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add input builtin, collectInputNames, interpretWithInputs"
```

---

### Task 2: Blocks layer — `sprout_input` block

**Files:**
- Modify: `packages/blocks/src/definitions/values.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `apps/ide/src/BlockWorkspace.tsx`
- Modify: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write the failing compiler test**

At the end of `packages/blocks/tests/compiler.test.ts`, add:

```typescript
// ---------------------------------------------------------------------------
// sprout_input — value block: input("name")
// ---------------------------------------------------------------------------
describe('sprout_input', () => {
  it('compiles to input("name") CallExpr with StringLit arg', () => {
    const ws = makeWorkspace();
    const fwdBlock = ws.newBlock('sprout_forward');
    const inputBlock = ws.newBlock('sprout_input');
    inputBlock.setFieldValue('speed', 'NAME');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(inputBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'forward',
          args: [{
            kind: 'CallExpr',
            callee: 'input',
            args: [{ kind: 'StringLit', value: 'speed' }],
            block: null,
          }],
          block: null,
        },
      }],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify the new test fails**

```
bun test packages/blocks/tests/compiler.test.ts
```

Expected: the new `sprout_input` test fails with `Unknown block type` or similar. All others pass.

- [ ] **Step 3: Add the `sprout_input` block definition**

At the end of `registerValueBlocks()` in `packages/blocks/src/definitions/values.ts`, before the closing `}` of the function, add:

```typescript
  Blockly.Blocks['sprout_input'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('input')
        .appendField(new Blockly.FieldTextInput('name'), 'NAME');
      this.setOutput(true, 'Number');
      this.setColour(45);
    },
  };
```

- [ ] **Step 4: Add the compiler case**

In `packages/blocks/src/compiler.ts`, inside `compileExpr`, add a case before the `default:` throw:

```typescript
    case 'sprout_input': {
      const name = block.getFieldValue('NAME') as string;
      return {
        kind: 'CallExpr',
        callee: 'input',
        args: [{ kind: 'StringLit', value: name }],
        block: null,
      };
    }
```

- [ ] **Step 5: Add `sprout_input` to the toolbox**

In `apps/ide/src/BlockWorkspace.tsx`, add `sprout_input` to the toolbox after the `sprout_number` entry (in the Values section):

```typescript
    // Values
    { kind: 'block', type: 'sprout_number' },
    { kind: 'block', type: 'sprout_input' },
```

- [ ] **Step 6: Run all tests and verify they pass**

```
bun test
```

Expected: all tests pass. The new `sprout_input` compiler test now passes.

- [ ] **Step 7: Commit**

```bash
git add packages/blocks/src/definitions/values.ts packages/blocks/src/compiler.ts apps/ide/src/BlockWorkspace.tsx packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add sprout_input block and compiler case"
```

---

### Task 3: IDE layer — input panel in App.tsx

**Files:**
- Modify: `apps/ide/src/App.tsx`

- [ ] **Step 1: Update imports**

In `apps/ide/src/App.tsx`, update the import from `@sprout/lang`. Find the current block (it imports `interpretFull`, `callHandler`, `render`, `mkSequence`, `SproutRuntimeError`). Remove `interpretFull` — it will no longer be called directly. Add `interpretFullWithInputs` and `collectInputNames`. The updated block:

Replace with:

```typescript
import {
  interpretFullWithInputs,
  collectInputNames,
  callHandler,
  render,
  mkSequence,
  SproutRuntimeError,
} from '@sprout/lang';
```

- [ ] **Step 2: Add `inputNames` and `inputValues` state**

In `App()`, after the existing `useState` declarations (around line 34, after `shareConfirm`), add:

```typescript
  const [inputNames, setInputNames] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, number>>({});
```

- [ ] **Step 3: Add a `useEffect` that scans for input names**

After the existing `useEffect` that handles localStorage save (around line 54), add a new `useEffect`:

```typescript
  useEffect(() => {
    try {
      const text = sourceMode === 'blocks' ? programText : editorText;
      if (!text.trim()) { setInputNames([]); return; }
      const prog = parse(text);
      const names = collectInputNames(prog);
      setInputNames(names);
      setInputValues(prev => {
        const next: Record<string, number> = {};
        for (const name of names) next[name] = prev[name] ?? 0;
        return next;
      });
    } catch {
      // Parse error — leave inputNames unchanged
    }
  }, [programText, editorText, sourceMode]);
```

- [ ] **Step 4: Update `handleRun` to pass input values**

In `handleRun`, replace the line:

```typescript
      const { drawing, handlers: h } = interpretFull(program);
```

With:

```typescript
      const inputMap = new Map(
        Object.entries(inputValues).map(([k, v]) => [k, v] as [string, number])
      );
      const { drawing, handlers: h } = interpretFullWithInputs(program, inputMap);
```

- [ ] **Step 5: Add the input panel JSX**

In the JSX return, place the panel just before the `<TextPanel` element. Add it as a conditional block:

```tsx
        {inputNames.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '6px 8px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Inputs
            </div>
            {inputNames.map(name => (
              <label
                key={name}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
              >
                <span style={{ minWidth: 80, color: '#475569' }}>{name}</span>
                <input
                  type="number"
                  value={inputValues[name] ?? 0}
                  onChange={e =>
                    setInputValues(prev => ({
                      ...prev,
                      [name]: Number(e.target.value) || 0,
                    }))
                  }
                  style={{
                    width: 72,
                    padding: '2px 6px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                />
              </label>
            ))}
          </div>
        )}
```

- [ ] **Step 6: Run all tests**

```
bun test
```

Expected: all tests pass (the IDE change has no automated tests, but existing tests confirm nothing broke).

- [ ] **Step 7: Commit**

```bash
git add apps/ide/src/App.tsx
git commit -m "feat(ide): add number input panel and wire interpretFullWithInputs"
```
