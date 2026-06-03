# Variables + While Loops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mutable variables (`let`/`set`) and `while` loops to the Sprout language, enabling programs that accumulate state across iterations.

**Architecture:** Mutable cells — `let x = 0` stores a `SproutVar { kind: 'var', cell: { value } }` in the env. `set x = expr` mutates `cell.value` in-place. `evalBlock` is updated to thread env through its statements so `let` declarations inside blocks are visible to subsequent statements. `while` evaluates in a loop collecting drawings per iteration.

**Tech Stack:** TypeScript, Vitest, Blockly (node). Monorepo packages: `packages/lang`, `packages/parser`, `packages/blocks`.

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/ast.ts` | Add `LetStmt`, `AssignStmt`, `WhileExpr`; update unions |
| `packages/lang/src/values.ts` | Add `SproutVar`; add to `SproutValue` union |
| `packages/lang/src/interpreter.ts` | Thread env in `evalBlock`; handle new nodes; Ident auto-deref |
| `packages/lang/src/serializer.ts` | Serialize `let`, `set`, `while` |
| `packages/lang/src/index.ts` | Export new types |
| `packages/lang/tests/interpreter.test.ts` | New tests |
| `packages/lang/tests/serializer.test.ts` | New tests |
| `packages/parser/src/parser.ts` | Parse `let`, `set`, `while` |
| `packages/parser/tests/parser.test.ts` | New tests |
| `packages/blocks/src/definitions/variables.ts` | New file — register 3 blocks |
| `packages/blocks/src/definitions/index.ts` | Call `registerVariableBlocks()` |
| `packages/blocks/src/compiler.ts` | Compile `sprout_let`, `sprout_set`, `sprout_while` |
| `packages/blocks/tests/compiler.test.ts` | New tests |

Run tests with: `bun run vitest run`

---

## Task 1: AST + Exports

**Files:**
- Modify: `packages/lang/src/ast.ts`
- Modify: `packages/lang/src/index.ts`
- Test: `packages/lang/tests/interpreter.test.ts` (type-check only at this stage)

- [ ] **Step 1: Add three new AST nodes to `packages/lang/src/ast.ts`**

Insert after the `IfExpr` interface (before the `Expr` union):

```typescript
/** `while <cond> do ... end` */
export interface WhileExpr {
  readonly kind: 'WhileExpr';
  readonly cond: Expr;
  readonly body: BlockExpr;
}
```

Update the `Expr` union (add `WhileExpr` at the end):

```typescript
export type Expr =
  | NumberLit
  | StringLit
  | SymbolLit
  | BoolLit
  | Ident
  | InfixExpr
  | UnaryExpr
  | CallExpr
  | BlockExpr
  | RepeatExpr
  | OnExpr
  | IfExpr
  | WhileExpr;
```

Insert after the `ExprStmt` interface (before the `Stmt` union):

```typescript
/** `let name = expr` — declares a mutable variable */
export interface LetStmt {
  readonly kind: 'LetStmt';
  readonly name: string;
  readonly init: Expr;
}

/** `set name = expr` — assigns to an existing mutable variable */
export interface AssignStmt {
  readonly kind: 'AssignStmt';
  readonly name: string;
  readonly value: Expr;
}
```

Update the `Stmt` union:

```typescript
export type Stmt = DefStmt | ExprStmt | LetStmt | AssignStmt;
```

Update the `Node` union:

```typescript
export type Node = Program | Stmt | Expr;
```

- [ ] **Step 2: Export the new types from `packages/lang/src/index.ts`**

Replace the AST exports block with:

```typescript
export type {
  // AST nodes
  Program,
  DefStmt,
  ExprStmt,
  LetStmt,
  AssignStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
  CallExpr,
  BlockExpr,
  InfixExpr,
  UnaryExpr,
  RepeatExpr,
  OnExpr,
  IfExpr,
  WhileExpr,
  // Unions
  Expr,
  Stmt,
  Node,
} from './ast.js';
```

- [ ] **Step 3: Verify the project type-checks**

Run: `bun run vitest run`
Expected: all existing tests still pass (254 tests)

- [ ] **Step 4: Commit**

```bash
git add packages/lang/src/ast.ts packages/lang/src/index.ts
git commit -m "feat(lang): add LetStmt, AssignStmt, WhileExpr AST nodes"
```

---

## Task 2: SproutVar Value Type

**Files:**
- Modify: `packages/lang/src/values.ts`
- Modify: `packages/lang/src/index.ts`

- [ ] **Step 1: Add `SproutVar` to `packages/lang/src/values.ts`**

Insert after the `SproutFunction` interface:

```typescript
/**
 * A mutable variable cell. The `cell` object is intentionally mutable —
 * `set x = expr` writes to `cell.value` in-place. The `SproutVar` wrapper
 * itself is readonly so the env binding never changes, only the cell contents.
 */
export interface SproutVar {
  readonly kind: 'var';
  readonly cell: { value: SproutValue };
}
```

Update the `SproutValue` union (add `SproutVar` before `Drawing`):

```typescript
// INVARIANT: Drawing.kind values ('forward','turn','penUp','penDown','sequence',
// 'beside','above','scale','color','penWidth','empty') must never match SproutNumber/String/Symbol/Bool/Function/Var kinds.
export type SproutValue =
  | SproutNumber
  | SproutString
  | SproutSymbol
  | SproutBool
  | SproutFunction
  | SproutVar
  | Drawing;
```

- [ ] **Step 2: Export `SproutVar` from `packages/lang/src/index.ts`**

In the `values.ts` export block, add `SproutVar`:

```typescript
export type {
  // Runtime values
  SproutNumber,
  SproutString,
  SproutSymbol,
  SproutBool,
  SproutFunction,
  SproutVar,
  Drawing,
  SproutValue,
  Env,
} from './values.js';
```

- [ ] **Step 3: Verify type-check**

Run: `bun run vitest run`
Expected: 254 tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/lang/src/values.ts packages/lang/src/index.ts
git commit -m "feat(lang): add SproutVar mutable cell value type"
```

---

## Task 3: Interpreter

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Test: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write failing tests in `packages/lang/tests/interpreter.test.ts`**

Add these imports at the top (alongside existing ones):
```typescript
import type { LetStmt, AssignStmt, WhileExpr } from '@sprout/lang';
```

Add these builder helpers alongside the existing ones:
```typescript
const letS = (name: string, init: object): LetStmt =>
  ({ kind: 'LetStmt' as const, name, init: init as Expr });
const assignS = (name: string, value: object): AssignStmt =>
  ({ kind: 'AssignStmt' as const, name, value: value as Expr });
const whileE = (cond: object, body: object[]): WhileExpr => ({
  kind: 'WhileExpr' as const,
  cond: cond as Expr,
  body: { kind: 'BlockExpr' as const, body: body as Stmt[] },
});
```

Add a new describe block at the bottom:

```typescript
describe('variables — let / set', () => {
  it('let x = 5 then forward(x) draws forward(5)', () => {
    const prog: Program = {
      kind: 'Program',
      stmts: [
        letS('x', num(5)),
        exprS(call('forward', [id('x')])),
      ],
    };
    expect(interpret(prog)).toEqual(mkSequence([mkForward(5)]));
  });

  it('set updates the variable', () => {
    const prog: Program = {
      kind: 'Program',
      stmts: [
        letS('x', num(1)),
        assignS('x', num(99)),
        exprS(call('forward', [id('x')])),
      ],
    };
    expect(interpret(prog)).toEqual(mkSequence([mkForward(99)]));
  });

  it('let inside a while body is re-created each iteration', () => {
    // let i = 0; while i < 2 do let y = 10; forward(y); set i = i + 1 end
    const prog: Program = {
      kind: 'Program',
      stmts: [
        letS('i', num(0)),
        exprS(whileE(
          infix('<', id('i'), num(2)),
          [
            letS('y', num(10)),
            exprS(call('forward', [id('y')])),
            assignS('i', infix('+', id('i'), num(1))),
          ],
        )),
      ],
    };
    const iterDrawing = mkSequence([mkForward(10)]);
    expect(interpret(prog)).toEqual(
      mkSequence([mkSequence([iterDrawing, iterDrawing])])
    );
  });

  it('throws on set of undeclared variable', () => {
    const prog: Program = {
      kind: 'Program',
      stmts: [assignS('z', num(1))],
    };
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('throws on set of a def (not a var)', () => {
    const prog: Program = {
      kind: 'Program',
      stmts: [
        { kind: 'DefStmt', name: 'f', params: [], body: num(1) },
        assignS('f', num(2)),
      ],
    };
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });
});

describe('while loop', () => {
  it('does not execute when condition is false from the start', () => {
    const prog: Program = {
      kind: 'Program',
      stmts: [
        letS('x', num(0)),
        exprS(whileE(
          infix('<', id('x'), num(0)),
          [exprS(call('forward', [num(10)]))],
        )),
      ],
    };
    expect(interpret(prog)).toEqual(mkSequence([EMPTY]));
  });

  it('counts to 3 and collects drawings from each iteration', () => {
    // let x = 0; while x < 3 do forward(10); set x = x + 1 end
    const prog: Program = {
      kind: 'Program',
      stmts: [
        letS('x', num(0)),
        exprS(whileE(
          infix('<', id('x'), num(3)),
          [
            exprS(call('forward', [num(10)])),
            assignS('x', infix('+', id('x'), num(1))),
          ],
        )),
      ],
    };
    const iterDrawing = mkSequence([mkForward(10)]);
    expect(interpret(prog)).toEqual(
      mkSequence([mkSequence([iterDrawing, iterDrawing, iterDrawing])])
    );
  });

  it('throws when condition is not a bool', () => {
    const prog: Program = {
      kind: 'Program',
      stmts: [
        letS('x', num(0)),
        exprS(whileE(num(1), [assignS('x', num(1))])),
      ],
    };
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `bun run vitest run packages/lang/tests/interpreter.test.ts`
Expected: new tests fail with type errors or runtime errors

- [ ] **Step 3: Update interpreter imports**

In `packages/lang/src/interpreter.ts`, update the AST import:

```typescript
import type {
  Program,
  Stmt,
  Expr,
  DefStmt,
  ExprStmt,
  LetStmt,
  AssignStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
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

Update the values import to add `SproutVar`:

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
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';
```

- [ ] **Step 4: Update `evalBlock` to thread env through statements**

Replace the existing `evalBlock` function:

```typescript
/** Evaluate a BlockExpr: collect Drawing results, thread env for let/set. */
function evalBlock(block: BlockExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  let currentEnv = env;
  for (const stmt of block.body) {
    const [val, newEnv] = evalStmtWithEnv(stmt, currentEnv);
    currentEnv = newEnv;
    if (val !== null && isDrawing(val)) {
      drawings.push(val);
    }
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}
```

Delete the now-unused `evalStmt` function (the one that just calls `evalStmtWithEnv` and discards the env):

```typescript
// DELETE this function:
// function evalStmt(stmt: Stmt, env: Env): SproutValue | null {
//   const [val] = evalStmtWithEnv(stmt, env);
//   return val;
// }
```

- [ ] **Step 5: Update `Ident` lookup to auto-dereference vars**

In `evalExpr`, replace the `'Ident'` case:

```typescript
case 'Ident': {
  const val = env.get(expr.name);
  if (val === undefined) {
    throw new SproutRuntimeError(`Unbound identifier: '${expr.name}'`);
  }
  return val.kind === 'var' ? val.cell.value : val;
}
```

- [ ] **Step 6: Add `LetStmt` and `AssignStmt` cases to `evalStmtWithEnv`**

In the `evalStmtWithEnv` function, add two new cases after the `ExprStmt` case:

```typescript
case 'LetStmt': {
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
  existing.cell.value = evalExpr(stmt.value, env);
  return [null, env];
}
```

- [ ] **Step 7: Add `WhileExpr` to `evalExpr` and implement `evalWhile`**

In `evalExpr`, add a case before the `default`:

```typescript
case 'WhileExpr':
  return evalWhile(expr, env);
```

Add the `evalWhile` function after `evalRepeat`:

```typescript
function evalWhile(expr: WhileExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  while (true) {
    const cond = evalExpr(expr.cond, env);
    if (cond.kind !== 'bool') {
      throw new SproutRuntimeError(`while: condition must be bool, got ${cond.kind}`);
    }
    if (!cond.value) break;
    drawings.push(evalBlock(expr.body, env));
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}
```

- [ ] **Step 8: Run tests — all should pass**

Run: `bun run vitest run`
Expected: all tests pass (262+ tests)

- [ ] **Step 9: Commit**

```bash
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add let/set variables and while loop to interpreter"
```

---

## Task 4: Serializer

**Files:**
- Modify: `packages/lang/src/serializer.ts`
- Test: `packages/lang/tests/serializer.test.ts`

- [ ] **Step 1: Write failing tests in `packages/lang/tests/serializer.test.ts`**

Add `LetStmt`, `AssignStmt`, `WhileExpr` to imports:

```typescript
import type { LetStmt, AssignStmt, WhileExpr } from '@sprout/lang';
```

Add builder helpers (alongside existing ones):

```typescript
const letS = (name: string, init: object): LetStmt =>
  ({ kind: 'LetStmt' as const, name, init: init as Expr });
const assignS = (name: string, value: object): AssignStmt =>
  ({ kind: 'AssignStmt' as const, name, value: value as Expr });
const whileE = (cond: object, body: object[]): WhileExpr => ({
  kind: 'WhileExpr' as const,
  cond: cond as Expr,
  body: { kind: 'BlockExpr' as const, body: body as Stmt[] },
});
```

Add a new describe block:

```typescript
describe('LetStmt / AssignStmt / WhileExpr serialization', () => {
  it('serializes let statement', () => {
    expect(serializeStmt(letS('x', num(5)))).toBe('let x = 5');
  });

  it('serializes set statement', () => {
    expect(serializeStmt(assignS('x', infix('+', id('x'), num(1))))).toBe('set x = x + 1');
  });

  it('serializes while expression', () => {
    const expr = whileE(
      infix('<', id('x'), num(10)),
      [exprS(call('forward', [id('x')]))],
    );
    expect(serializeExpr(expr)).toBe(
      'while x < 10 do\n  forward(x)\nend'
    );
  });

  it('serializes canonical counting pattern', () => {
    const prog: Program = {
      kind: 'Program',
      stmts: [
        letS('x', num(0)),
        exprS(whileE(
          infix('<', id('x'), num(3)),
          [
            exprS(call('forward', [id('x')])),
            assignS('x', infix('+', id('x'), num(1))),
          ],
        )),
      ],
    };
    expect(serialize(prog)).toBe(
      'let x = 0\n' +
      'while x < 3 do\n' +
      '  forward(x)\n' +
      '  set x = x + 1\n' +
      'end'
    );
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `bun run vitest run packages/lang/tests/serializer.test.ts`
Expected: new tests fail

- [ ] **Step 3: Add `WhileExpr` case to `serializeExpr` in `packages/lang/src/serializer.ts`**

Add before the `default` case in `serializeExpr`:

```typescript
case 'WhileExpr': {
  const condStr = serializeExpr(expr.cond, indentLevel);
  const body = serializeBlock(expr.body, indentLevel + 1);
  return `while ${condStr} do\n${body}\n${indent(indentLevel)}end`;
}
```

- [ ] **Step 4: Add `LetStmt` and `AssignStmt` cases to `serializeStmt`**

Add before the `default` case in `serializeStmt`:

```typescript
case 'LetStmt':
  return `let ${stmt.name} = ${serializeExpr(stmt.init, indentLevel)}`;

case 'AssignStmt':
  return `set ${stmt.name} = ${serializeExpr(stmt.value, indentLevel)}`;
```

- [ ] **Step 5: Run tests — all should pass**

Run: `bun run vitest run`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/lang/src/serializer.ts packages/lang/tests/serializer.test.ts
git commit -m "feat(lang): serialize let/set/while"
```

---

## Task 5: Parser

**Files:**
- Modify: `packages/parser/src/parser.ts`
- Test: `packages/parser/tests/parser.test.ts`

- [ ] **Step 1: Write failing tests in `packages/parser/tests/parser.test.ts`**

Add `LetStmt`, `AssignStmt`, `WhileExpr` to type imports:

```typescript
import type { Program, LetStmt, AssignStmt, WhileExpr } from '@sprout/lang';
```

Add builder helpers (alongside existing ones):

```typescript
const letS = (name: string, init: object): LetStmt =>
  ({ kind: 'LetStmt' as const, name, init: init as never });
const assignS = (name: string, value: object): AssignStmt =>
  ({ kind: 'AssignStmt' as const, name, value: value as never });
const whileE = (cond: object, body: object[]): WhileExpr => ({
  kind: 'WhileExpr' as const,
  cond: cond as never,
  body: blockE(body),
});
```

Add a new describe block:

```typescript
describe('parse — let / set / while', () => {
  it('parses let statement', () => {
    expect(parse('let x = 5')).toEqual(prog(letS('x', num(5))));
  });

  it('parses set statement', () => {
    expect(parse('set x = x + 1')).toEqual(
      prog(assignS('x', infix('+', id('x'), num(1))))
    );
  });

  it('parses while with comparison condition', () => {
    expect(parse('while x < 10 do\n  forward(x)\nend')).toEqual(
      prog(exprS(whileE(
        infix('<', id('x'), num(10)),
        [exprS(callE('forward', [id('x')]))],
      )))
    );
  });

  it('parses canonical counting pattern', () => {
    const src = 'let x = 0\nwhile x < 3 do\n  forward(x)\n  set x = x + 1\nend';
    expect(parse(src)).toEqual(
      prog(
        letS('x', num(0)),
        exprS(whileE(
          infix('<', id('x'), num(3)),
          [
            exprS(callE('forward', [id('x')])),
            assignS('x', infix('+', id('x'), num(1))),
          ],
        )),
      )
    );
  });

  it('parses while with boolean condition', () => {
    expect(parse('while true do\n  forward(1)\nend')).toEqual(
      prog(exprS(whileE(bool_(true), [exprS(callE('forward', [num(1)]))])))
    );
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `bun run vitest run packages/parser/tests/parser.test.ts`
Expected: new tests fail

- [ ] **Step 3: Add imports and new parse methods to `packages/parser/src/parser.ts`**

Update the import from `@sprout/lang` to include the new types:

```typescript
import type {
  Program, Stmt, Expr, DefStmt,
  BlockExpr, RepeatExpr, OnExpr, CallExpr, IfExpr, UnaryExpr,
  LetStmt, AssignStmt, WhileExpr,
} from '@sprout/lang';
```

In `parseStmt`, add `let` and `set` checks before the `ExprStmt` fallthrough:

```typescript
private parseStmt(): Stmt {
  if (this.checkIdent('def')) return this.parseDef();
  if (this.checkIdent('let')) return this.parseLet();
  if (this.checkIdent('set')) return this.parseSet();
  return { kind: 'ExprStmt', expr: this.parseExpr() };
}
```

Add `parseLet` and `parseSet` methods (place them after `parseDef`):

```typescript
private parseLet(): LetStmt {
  this.eatIdent('let');
  const nameTok = this.eat('IDENT') as { kind: 'IDENT'; name: string };
  this.eat('EQ');
  const init = this.parseExpr();
  return { kind: 'LetStmt', name: nameTok.name, init };
}

private parseSet(): AssignStmt {
  this.eatIdent('set');
  const nameTok = this.eat('IDENT') as { kind: 'IDENT'; name: string };
  this.eat('EQ');
  const value = this.parseExpr();
  return { kind: 'AssignStmt', name: nameTok.name, value };
}
```

In `parseAtom`, add the `while` case after the `if` case:

```typescript
if (name === 'while') {
  this.advance();
  const cond = this.parseExpr();
  const body = this.parseDoBlock();
  return { kind: 'WhileExpr', cond, body } satisfies WhileExpr;
}
```

- [ ] **Step 4: Run tests — all should pass**

Run: `bun run vitest run`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/parser/src/parser.ts packages/parser/tests/parser.test.ts
git commit -m "feat(parser): parse let/set/while"
```

---

## Task 6: Blocks + Compiler

**Files:**
- Create: `packages/blocks/src/definitions/variables.ts`
- Modify: `packages/blocks/src/definitions/index.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Test: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write failing tests in `packages/blocks/tests/compiler.test.ts`**

Add `LetStmt`, `AssignStmt`, `WhileExpr` to the `@sprout/lang` import at the top of the file.

Add these tests inside the existing `describe('compileWorkspace', ...)` block:

```typescript
it('sprout_let compiles to LetStmt', () => {
  const ws = new Blockly.Workspace();
  const letBlock = ws.newBlock('sprout_let');
  letBlock.setFieldValue('x', 'NAME');
  const numBlock = ws.newBlock('sprout_number');
  numBlock.setFieldValue('5', 'NUM');
  letBlock.getInput('INIT')!.connection!.connect(numBlock.outputConnection!);

  const result = compileWorkspace(ws);
  const expected: LetStmt = { kind: 'LetStmt', name: 'x', init: { kind: 'NumberLit', value: 5 } };
  expect(result).toEqual({
    kind: 'Program',
    stmts: [expected],
  });
});

it('sprout_set compiles to AssignStmt', () => {
  const ws = new Blockly.Workspace();
  const setBlock = ws.newBlock('sprout_set');
  setBlock.setFieldValue('x', 'NAME');
  const numBlock = ws.newBlock('sprout_number');
  numBlock.setFieldValue('99', 'NUM');
  setBlock.getInput('VALUE')!.connection!.connect(numBlock.outputConnection!);

  const result = compileWorkspace(ws);
  const expected: AssignStmt = { kind: 'AssignStmt', name: 'x', value: { kind: 'NumberLit', value: 99 } };
  expect(result).toEqual({
    kind: 'Program',
    stmts: [expected],
  });
});

it('sprout_while compiles to ExprStmt wrapping WhileExpr', () => {
  const ws = new Blockly.Workspace();
  const whileBlock = ws.newBlock('sprout_while');

  const boolBlock = ws.newBlock('sprout_bool');
  boolBlock.setFieldValue('true', 'VALUE');
  whileBlock.getInput('COND')!.connection!.connect(boolBlock.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const distBlock = ws.newBlock('sprout_number');
  distBlock.setFieldValue('10', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(distBlock.outputConnection!);
  whileBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);

  const result = compileWorkspace(ws);
  const expected: WhileExpr = {
    kind: 'WhileExpr',
    cond: { kind: 'BoolLit', value: true },
    body: {
      kind: 'BlockExpr',
      body: [{
        kind: 'ExprStmt',
        expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 10 }], block: null },
      }],
    },
  };
  expect(result).toEqual({
    kind: 'Program',
    stmts: [{ kind: 'ExprStmt', expr: expected }],
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `bun run vitest run packages/blocks/tests/compiler.test.ts`
Expected: new tests fail (unknown block types)

- [ ] **Step 3: Create `packages/blocks/src/definitions/variables.ts`**

```typescript
import * as Blockly from 'blockly/node';

export function registerVariableBlocks(): void {
  Blockly.Blocks['sprout_let'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('INIT')
        .setCheck(null)
        .appendField('let')
        .appendField(new Blockly.FieldTextInput('x') as unknown as Blockly.Field, 'NAME')
        .appendField('=');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };

  Blockly.Blocks['sprout_set'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('set')
        .appendField(new Blockly.FieldTextInput('x') as unknown as Blockly.Field, 'NAME')
        .appendField('=');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };

  Blockly.Blocks['sprout_while'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COND').setCheck(null).appendField('while');
      this.appendStatementInput('BODY').appendField('do');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };
}
```

- [ ] **Step 4: Register in `packages/blocks/src/definitions/index.ts`**

Add the import and call:

```typescript
import { registerStatementBlocks } from './statements.js';
import { registerValueBlocks } from './values.js';
import { registerConditionalBlocks } from './conditionals.js';
import { registerVariableBlocks } from './variables.js';

let registered = false;

export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  registerStatementBlocks();
  registerValueBlocks();
  registerConditionalBlocks();
  registerVariableBlocks();
}
```

- [ ] **Step 5: Update `packages/blocks/src/compiler.ts`**

Update the import from `@sprout/lang` to include new types:

```typescript
import type {
  Program, Stmt, Expr,
  DefStmt, ExprStmt,
  LetStmt, AssignStmt,
  NumberLit, Ident, InfixExpr, UnaryExpr, CallExpr,
  BlockExpr, RepeatExpr, OnExpr, IfExpr, WhileExpr, SymbolLit, BoolLit,
} from '@sprout/lang';
```

In `compileStmt`, add three new cases before `default`:

```typescript
case 'sprout_let':
  return compileLet(block);
case 'sprout_set':
  return compileSet(block);
case 'sprout_while':
  return { kind: 'ExprStmt', expr: compileExprBlock(block) };
```

Add `compileLet` and `compileSet` functions after `compileDef`:

```typescript
function compileLet(block: Blockly.Block): LetStmt {
  const name = block.getFieldValue('NAME') as string;
  const init = compileExpr(mustGetInput(block, 'INIT'));
  return { kind: 'LetStmt', name, init };
}

function compileSet(block: Blockly.Block): AssignStmt {
  const name = block.getFieldValue('NAME') as string;
  const value = compileExpr(mustGetInput(block, 'VALUE'));
  return { kind: 'AssignStmt', name, value };
}
```

Add `sprout_while` case to `compileExprBlock` (before `default`):

```typescript
case 'sprout_while': {
  const cond = compileExpr(mustGetInput(block, 'COND'));
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileBlockExpr(firstBodyBlock);
  const whileExpr: WhileExpr = { kind: 'WhileExpr', cond, body };
  return whileExpr;
}
```

- [ ] **Step 6: Run tests — all should pass**

Run: `bun run vitest run`
Expected: all tests pass (270+ tests)

- [ ] **Step 7: Commit**

```bash
git add packages/blocks/src/definitions/variables.ts packages/blocks/src/definitions/index.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add sprout_let, sprout_set, sprout_while blocks"
```
