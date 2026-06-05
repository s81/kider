# Return Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow user-defined functions to both produce drawings and return a computed value using a `return expr` statement.

**Architecture:** Add `ReturnStmt` to the AST. In `evalBlock`, intercept `ReturnStmt` and throw an internal `ReturnSignal` carrying the return value and accumulated drawings. `evalCall` catches `ReturnSignal` and throws a `ReturnBundle`. `evalStmtWithEnv` catches `ReturnBundle` at the statement level (for direct `let x = f()` / `set x = f()` / bare `f()` calls) to extract drawings. `evalExpr`'s `CallExpr` case catches `ReturnBundle` and drops drawings (expression context). Add a `sprout_return` Blockly block.

**Tech Stack:** TypeScript, Vitest (`bun test`), Blockly 10, pnpm monorepo

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/ast.ts` | Add `ReturnStmt` interface; add to `Stmt` union |
| `packages/lang/src/interpreter.ts` | Add `ReturnSignal` + `ReturnBundle` classes; update `evalBlock`, `evalCall`, `evalExpr` CallExpr case, `evalStmtWithEnv` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('return statement')` |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_return` block definition |
| `packages/blocks/src/compiler.ts` | Add `ReturnStmt` import and `sprout_return` compiler case |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('sprout_return')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_return` to Functions section of toolbox |

---

## Task 1: AST — ReturnStmt

**Files:**
- Modify: `packages/lang/src/ast.ts`

- [ ] **Step 1: Add `ReturnStmt` interface and update `Stmt` union**

In `packages/lang/src/ast.ts`, after the `AssignStmt` interface (line 156) and before the `Stmt` union (line 162), add:

```typescript
/** `return expr` — exits the enclosing function with a value */
export interface ReturnStmt {
  readonly kind: 'ReturnStmt';
  readonly value: Expr;
}
```

Then update the `Stmt` union at line 162:

```typescript
export type Stmt = DefStmt | ExprStmt | LetStmt | AssignStmt | ReturnStmt;
```

- [ ] **Step 2: Run type check**

```
cd D:\Projects\kider
bun run --cwd packages/lang tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add packages/lang/src/ast.ts
git commit -m "feat(lang): add ReturnStmt AST node"
```

---

## Task 2: Interpreter — return mechanics

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

The implementation uses two internal signal classes:
- `ReturnSignal` — thrown by `evalBlock` when it hits a `ReturnStmt`; carries the return value and drawings accumulated so far
- `ReturnBundle` — thrown by `evalCall` when it catches `ReturnSignal`; carried up to `evalStmtWithEnv`

`evalStmtWithEnv` catches `ReturnBundle` only for direct `CallExpr` statement positions (`let x = f()`, `set x = f()`, bare `f()`). `evalExpr`'s `CallExpr` case catches `ReturnBundle` and drops drawings (expression context — returns the value only).

- [ ] **Step 1: Write failing tests**

In `packages/lang/tests/interpreter.test.ts`, add these imports and helpers, then the test block. Add after the existing helpers (around line 60):

```typescript
const returnStmt = (value: Expr): Stmt => ({ kind: 'ReturnStmt', value });
```

Then add at the end of the file:

```typescript
// ---------------------------------------------------------------------------
// Return statement
// ---------------------------------------------------------------------------
describe('return statement', () => {
  it('function with only return — returns the value', () => {
    // def double(n) { return n * 2 }
    // let x = double(3)
    // forward(x)
    const prog = program(
      defStmt('double', ['n'], block([
        returnStmt(infix('*', ident('n'), numLit(2))),
      ])),
      letStmt('x', call('double', [numLit(3)])),
      exprStmt(call('forward', [ident('x')])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(6)]));
  });

  it('function with drawing then return — drawings appear, value returned', () => {
    // def drawAndGet(r) { circle(r); return r }
    // let size = drawAndGet(50)
    // forward(size)
    const mkCircle = (r: number) => ({ kind: 'circle' as const, radius: r });
    const prog = program(
      defStmt('drawAndGet', ['r'], block([
        exprStmt(call('circle', [ident('r')])),
        returnStmt(ident('r')),
      ])),
      letStmt('size', call('drawAndGet', [numLit(50)])),
      exprStmt(call('forward', [ident('size')])),
    );
    const result = interpret(prog);
    // Result should be sequence of: circle(50) from inside function, forward(50)
    expect(result).toEqual(mkSequence([mkSequence([mkCircle(50)]), mkForward(50)]));
  });

  it('function with only drawing, no return — still works (no regression)', () => {
    // def draw(r) { circle(r) }
    // draw(30)
    const mkCircle = (r: number) => ({ kind: 'circle' as const, radius: r });
    const prog = program(
      defStmt('draw', ['r'], block([
        exprStmt(call('circle', [ident('r')])),
      ])),
      exprStmt(call('draw', [numLit(30)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkCircle(30)])]));
  });

  it('bare function call statement with return — drawings appear, return value discarded', () => {
    // def drawAndGet(r) { circle(r); return r }
    // drawAndGet(40)  ← call as statement
    const mkCircle = (r: number) => ({ kind: 'circle' as const, radius: r });
    const prog = program(
      defStmt('drawAndGet', ['r'], block([
        exprStmt(call('circle', [ident('r')])),
        returnStmt(ident('r')),
      ])),
      exprStmt(call('drawAndGet', [numLit(40)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkCircle(40)])]));
  });

  it('function with return returns correct type — string', () => {
    // def greeting() { return "hello" }
    // let msg = greeting()
    // text(msg, 20)
    const prog = program(
      defStmt('greeting', [], block([
        returnStmt(strLit('hello')),
      ])),
      letStmt('msg', call('greeting', [])),
      exprStmt(call('text', [ident('msg'), numLit(20)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkText('hello', 20)]));
  });

  it('return outside function throws SproutRuntimeError', () => {
    // return 42  ← at top level
    const prog = program(
      returnStmt(numLit(42)) as unknown as Stmt,
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow(/return/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun test packages/lang/tests/interpreter.test.ts 2>&1 | tail -20
```

Expected: multiple failures — `ReturnStmt` not handled.

- [ ] **Step 3: Add `ReturnSignal` and `ReturnBundle` to interpreter.ts**

In `packages/lang/src/interpreter.ts`, update the import at line 8 to include `ReturnStmt`:

```typescript
import {
  Program,
  Stmt,
  Expr,
  DefStmt,
  ExprStmt,
  LetStmt,
  AssignStmt,
  ReturnStmt,
  InfixExpr,
  UnaryExpr,
  CallExpr,
  BlockExpr,
  RepeatExpr,
  OnExpr,
  IfExpr,
  WhileExpr,
} from './ast.js';
```

Then add these two classes near the top of the file, after the imports but before any functions (e.g., after the `SproutRuntimeError` import block):

```typescript
// Internal signals for return value propagation — not exported.
class ReturnSignal {
  constructor(public value: SproutValue, public drawings: Drawing) {}
}

class ReturnBundle {
  constructor(public value: SproutValue, public drawing: Drawing) {}
}
```

- [ ] **Step 4: Update `evalBlock` to handle `ReturnStmt`**

Replace the existing `evalBlock` function (lines 562–574):

```typescript
/** Evaluate a BlockExpr: collect Drawing results, thread env for let/set. */
function evalBlock(block: BlockExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  let currentEnv = env;
  for (const stmt of block.body) {
    if (stmt.kind === 'ReturnStmt') {
      const value = evalExpr(stmt.value, currentEnv);
      const drawing = drawings.length === 0 ? EMPTY : mkSequence(drawings);
      throw new ReturnSignal(value, drawing);
    }
    const [val, newEnv] = evalStmtWithEnv(stmt, currentEnv);
    currentEnv = newEnv;
    if (val !== null && isDrawing(val)) {
      drawings.push(val);
    }
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}
```

- [ ] **Step 5: Update `evalCall` to catch `ReturnSignal`**

Replace the final two lines of `evalCall` (currently `return evalExpr(fn.body, childEnv);`):

```typescript
  try {
    return evalExpr(fn.body, childEnv);
  } catch (e) {
    if (e instanceof ReturnSignal) {
      throw new ReturnBundle(e.value, e.drawings);
    }
    throw e;
  }
```

The full `evalCall` function ending now looks like:

```typescript
  // Build child env: extend the function's *closure* env (lexical scoping).
  const childEnv = envExtend(fn.env, fn.params.map((p, i) => [p, evaluatedArgs[i]] as [string, SproutValue]));

  try {
    return evalExpr(fn.body, childEnv);
  } catch (e) {
    if (e instanceof ReturnSignal) {
      throw new ReturnBundle(e.value, e.drawings);
    }
    throw e;
  }
}
```

- [ ] **Step 6: Update `evalExpr` CallExpr case to catch `ReturnBundle`**

Replace the existing `case 'CallExpr'` block (lines 434–437):

```typescript
    // --- Call ---
    case 'CallExpr': {
      try {
        return evalCall(expr, env);
      } catch (e) {
        if (e instanceof ReturnBundle) {
          // Expression context: drop drawings, return value only.
          return e.value;
        }
        throw e;
      }
    }
```

- [ ] **Step 7: Update `evalStmtWithEnv` to handle `ReturnStmt` and direct-call cases**

The switch in `evalStmtWithEnv` needs:

1. A `case 'ReturnStmt'` for top-level `return` (error):
2. `ExprStmt` updated to catch `ReturnBundle` for direct CallExpr
3. `LetStmt` updated to catch `ReturnBundle` for direct CallExpr init
4. `AssignStmt` updated to catch `ReturnBundle` for direct CallExpr value

Replace the entire `evalStmtWithEnv` function:

```typescript
/**
 * Evaluate a statement, returning [value | null, updatedEnv].
 * `null` means the statement produces no visual contribution (e.g. DefStmt).
 * A real `EMPTY` Drawing (from e.g. `puts`) is distinct: it IS a visual no-op
 * but was explicitly produced by an expression.
 * DefStmt extends the env; ExprStmt does not.
 */
function evalStmtWithEnv(stmt: Stmt, env: Env): [SproutValue | null, Env] {
  switch (stmt.kind) {
    case 'DefStmt': {
      const fn: SproutFunction = {
        kind: 'function',
        params: stmt.params,
        body: stmt.body,
        env,
      };
      const newEnv = envExtend(env, [[stmt.name, fn]]);
      // DefStmt produces NO value — null signals "skip this for drawings".
      return [null, newEnv];
    }
    case 'ExprStmt': {
      // Handle OnExpr specially: register handler, update env, no visual output.
      if (stmt.expr.kind === 'OnExpr') {
        const onExpr = stmt.expr;
        const key = ':' + onExpr.event.name;
        const handler: SproutFunction = {
          kind: 'function',
          params: [],
          body: onExpr.body,
          env,
        };
        const newEnv = envExtend(env, [[key, handler]]);
        return [null, newEnv];
      }
      // Direct function call: catch ReturnBundle to emit its drawings.
      if (stmt.expr.kind === 'CallExpr') {
        try {
          const val = evalCall(stmt.expr, env);
          return [val, env];
        } catch (e) {
          if (e instanceof ReturnBundle) {
            // Return value is discarded; drawings surface as this statement's output.
            return [e.drawing, env];
          }
          throw e;
        }
      }
      const val = evalExpr(stmt.expr, env);
      return [val, env];
    }
    case 'LetStmt': {
      // Direct function call as init: extract drawings as a side contribution.
      if (stmt.init.kind === 'CallExpr') {
        let initVal: SproutValue;
        let sideDrawing: Drawing = EMPTY;
        try {
          initVal = evalCall(stmt.init, env);
        } catch (e) {
          if (e instanceof ReturnBundle) {
            initVal = e.value;
            sideDrawing = e.drawing;
          } else {
            throw e;
          }
        }
        const varCell: SproutVar = { kind: 'var', cell: { value: initVal } };
        const newEnv = envExtend(env, [[stmt.name, varCell]]);
        return [sideDrawing === EMPTY ? null : sideDrawing, newEnv];
      }
      const initVal = evalExpr(stmt.init, env);
      const varCell: SproutVar = { kind: 'var', cell: { value: initVal } };
      const newEnv = envExtend(env, [[stmt.name, varCell]]);
      return [null, newEnv];
    }
    case 'AssignStmt': {
      const existing = env.get(stmt.name);
      if (existing === undefined) {
        throw new SproutRuntimeError(`set: '${stmt.name}' is not declared`);
      }
      if (existing.kind !== 'var') {
        throw new SproutRuntimeError(`set: '${stmt.name}' is not a variable`);
      }
      // Direct function call as value: extract drawings as a side contribution.
      if (stmt.value.kind === 'CallExpr') {
        let val: SproutValue;
        let sideDrawing: Drawing = EMPTY;
        try {
          val = evalCall(stmt.value, env);
        } catch (e) {
          if (e instanceof ReturnBundle) {
            val = e.value;
            sideDrawing = e.drawing;
          } else {
            throw e;
          }
        }
        existing.cell.value = val;
        return [sideDrawing === EMPTY ? null : sideDrawing, env];
      }
      existing.cell.value = evalExpr(stmt.value, env);
      return [null, env];
    }
    case 'ReturnStmt': {
      // return used outside a function body (not inside evalBlock).
      throw new SproutRuntimeError('return can only be used inside a function');
    }
  }
}
```

- [ ] **Step 8: Run tests**

```
bun test packages/lang/tests/interpreter.test.ts 2>&1 | tail -20
```

Expected: all tests pass including the new `return statement` describe block.

- [ ] **Step 9: Run full suite to check for regressions**

```
bun test 2>&1 | tail -5
```

Expected: all tests pass, 0 fail.

- [ ] **Step 10: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): implement return statement with drawing side channel"
```

---

## Task 3: Blocks — sprout_return

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/tests/compiler.test.ts`
- Modify: `apps/ide/src/BlockWorkspace.tsx`

- [ ] **Step 1: Write failing compiler test**

In `packages/blocks/tests/compiler.test.ts`, add at the end:

```typescript
// ---------------------------------------------------------------------------
// sprout_return block
// ---------------------------------------------------------------------------
describe('sprout_return', () => {
  it('compiles to ReturnStmt with NumberLit value', () => {
    const ws = makeWorkspace();
    const returnBlock = ws.newBlock('sprout_return');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('42', 'NUM');
    returnBlock.getInput('VALUE')!.connection!.connect(numBlock.outputConnection!);

    // sprout_return is a statement block inside a function def body.
    // To compile it, we wrap in a def block and inspect the body.
    const defBlock = ws.newBlock('sprout_def');
    defBlock.setFieldValue('myFn', 'NAME');
    defBlock.getInput('BODY')!.connection!.connect(returnBlock.previousConnection!);

    const prog = compileWorkspace(ws);
    // prog.stmts[0] is DefStmt; its body is a BlockExpr; first stmt is ReturnStmt
    expect(prog.stmts).toHaveLength(1);
    const def = prog.stmts[0];
    expect(def.kind).toBe('DefStmt');
    if (def.kind === 'DefStmt') {
      expect(def.body.kind).toBe('BlockExpr');
      if (def.body.kind === 'BlockExpr') {
        expect(def.body.body).toHaveLength(1);
        const ret = def.body.body[0];
        expect(ret.kind).toBe('ReturnStmt');
        if (ret.kind === 'ReturnStmt') {
          expect(ret.value).toEqual({ kind: 'NumberLit', value: 42 });
        }
      }
    }
  });

  it('compiles to ReturnStmt with infix expression value', () => {
    const ws = makeWorkspace();
    const returnBlock = ws.newBlock('sprout_return');
    const infixBlock = ws.newBlock('sprout_infix');
    infixBlock.setFieldValue('+', 'OP');
    const left = ws.newBlock('sprout_number');
    left.setFieldValue('2', 'NUM');
    const right = ws.newBlock('sprout_number');
    right.setFieldValue('3', 'NUM');
    infixBlock.getInput('LEFT')!.connection!.connect(left.outputConnection!);
    infixBlock.getInput('RIGHT')!.connection!.connect(right.outputConnection!);
    returnBlock.getInput('VALUE')!.connection!.connect(infixBlock.outputConnection!);

    const defBlock = ws.newBlock('sprout_def');
    defBlock.setFieldValue('myFn', 'NAME');
    defBlock.getInput('BODY')!.connection!.connect(returnBlock.previousConnection!);

    const prog = compileWorkspace(ws);
    const def = prog.stmts[0];
    if (def.kind === 'DefStmt' && def.body.kind === 'BlockExpr') {
      const ret = def.body.body[0];
      expect(ret.kind).toBe('ReturnStmt');
      if (ret.kind === 'ReturnStmt') {
        expect(ret.value).toEqual({
          kind: 'InfixExpr',
          op: '+',
          left: { kind: 'NumberLit', value: 2 },
          right: { kind: 'NumberLit', value: 3 },
        });
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun test packages/blocks/tests/compiler.test.ts 2>&1 | tail -15
```

Expected: FAIL — `sprout_return` block not registered.

- [ ] **Step 3: Add `sprout_return` block definition**

In `packages/blocks/src/definitions/statements.ts`, add inside `registerStatementBlocks()` after the `sprout_call_stmt` block (after line 196):

```typescript
  Blockly.Blocks['sprout_return'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALUE')
        .appendField('return');
      this.setPreviousStatement(true, null);
      // No setNextStatement — nothing should follow a return.
      this.setColour(290);
    },
  };
```

- [ ] **Step 4: Add `sprout_return` compiler case**

In `packages/blocks/src/compiler.ts`:

1. Update the import at line 4 to include `ReturnStmt`:

```typescript
import type {
  Program, Stmt, Expr,
  DefStmt, ExprStmt,
  LetStmt, AssignStmt, ReturnStmt,
  NumberLit, Ident, InfixExpr, UnaryExpr, CallExpr,
  BlockExpr, RepeatExpr, OnExpr, IfExpr, WhileExpr, SymbolLit, BoolLit, StringLit,
} from '@sprout/lang';
```

2. In `compileStmt`, add `sprout_return` as a new case before the `default` (after line 54):

```typescript
    case 'sprout_return':
      return compileReturn(block);
```

3. Add the `compileReturn` function after `compileSet` (after line 82):

```typescript
function compileReturn(block: Blockly.Block): ReturnStmt {
  const value = compileExpr(mustGetInput(block, 'VALUE'));
  return { kind: 'ReturnStmt', value };
}
```

- [ ] **Step 5: Run compiler tests**

```
bun test packages/blocks/tests/compiler.test.ts 2>&1 | tail -15
```

Expected: all tests pass including the new `sprout_return` describe block.

- [ ] **Step 6: Add `sprout_return` to toolbox**

In `apps/ide/src/BlockWorkspace.tsx`, find the `// Functions` comment and add `sprout_return`:

```typescript
    // Functions
    { kind: 'block', type: 'sprout_def' },
    { kind: 'block', type: 'sprout_call_stmt' },
    { kind: 'block', type: 'sprout_return' },
```

- [ ] **Step 7: Run full test suite**

```
bun test 2>&1 | tail -5
```

Expected: all tests pass, 0 fail.

- [ ] **Step 8: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(blocks): add sprout_return block and compiler case"
```
