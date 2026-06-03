# Phase 6 — Conditionals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `if`/`else` conditional expressions, comparison operators (`<`, `>`, `<=`, `>=`, `==`, `!=`), and boolean logic (`and`, `or`, `not`) to Sprout across all five layers: AST, interpreter, serializer, parser/lexer, and Blockly blocks+compiler.

**Architecture:** `IfExpr` and `UnaryExpr` are new AST expression nodes; `InfixExpr.op` is extended to include comparison and boolean operators. The interpreter evaluates `IfExpr` by testing a `SproutBool` condition and returning the winning branch's Drawing (or `EMPTY` for false with no else). `and`/`or` short-circuit. Six new Blockly blocks (`sprout_if`, `sprout_compare`, `sprout_not`, `sprout_and`, `sprout_or`, `sprout_bool`) compile to the new AST nodes.

**Tech Stack:** TypeScript, Vitest, Blockly (blockly/node for tests)

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `packages/lang/src/ast.ts` | Add `IfExpr`, `UnaryExpr`; extend `InfixExpr.op`; update `Expr` union |
| Modify | `packages/lang/src/interpreter.ts` | Handle `IfExpr`, `UnaryExpr`, comparison/boolean infix ops |
| Modify | `packages/lang/src/serializer.ts` | Handle `IfExpr`, `UnaryExpr` |
| Modify | `packages/lang/src/index.ts` | Export `IfExpr`, `UnaryExpr` |
| Modify | `packages/parser/src/lexer.ts` | Add `LT`, `GT`, `LTE`, `GTE`, `EQEQ`, `NEQ` tokens |
| Modify | `packages/parser/src/parser.ts` | Parse `if`/`else`, comparisons, `not`, `and`/`or` |
| Create | `packages/blocks/src/definitions/conditionals.ts` | Register 6 new Blockly blocks |
| Modify | `packages/blocks/src/definitions/index.ts` | Call `registerConditionalBlocks()` |
| Modify | `packages/blocks/src/compiler.ts` | Compile 6 new block types |
| Modify | `packages/lang/tests/interpreter.test.ts` | Tests for `IfExpr`, `UnaryExpr`, comparison/boolean ops |
| Modify | `packages/lang/tests/serializer.test.ts` | Tests for `IfExpr`, `UnaryExpr` serialization |
| Modify | `packages/parser/tests/parser.test.ts` | Tests for new tokens and parse rules |
| Modify | `packages/blocks/tests/compiler.test.ts` | Tests for 6 new block compilations |

---

## Task 1: AST + Interpreter — core conditional evaluation

**Files:**
- Modify: `packages/lang/src/ast.ts`
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write failing tests for IfExpr and boolean/comparison ops**

Add to the bottom of `packages/lang/tests/interpreter.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// IfExpr — conditional expression
// ---------------------------------------------------------------------------

// Update the existing `infix` helper at the top of the file:
// Change:
//   const infix = (op: '+' | '-' | '*' | '/', left: Expr, right: Expr): Expr =>
// To:
//   const infix = (op: string, left: Expr, right: Expr): Expr =>

// Add these new helpers after the existing helpers block:
const ifExpr = (cond: Expr, thenStmts: Stmt[], elseStmts: Stmt[] | null = null): Expr => ({
  kind: 'IfExpr' as const,
  cond,
  then: { kind: 'BlockExpr' as const, body: thenStmts },
  else: elseStmts !== null ? { kind: 'BlockExpr' as const, body: elseStmts } : null,
});
const unary = (op: 'not', operand: Expr): Expr =>
  ({ kind: 'UnaryExpr' as const, op, operand });

// Then add these describe blocks:

describe('IfExpr', () => {
  it('returns then-branch drawing when condition is true', () => {
    // if true do forward(50) end  → forward(50)
    const prog = program(
      exprStmt(ifExpr(
        boolLit(true),
        [exprStmt(call('forward', [numLit(50)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(50)]));
  });

  it('returns EMPTY when condition is false and no else', () => {
    // if false do forward(50) end  → EMPTY
    const prog = program(
      exprStmt(ifExpr(
        boolLit(false),
        [exprStmt(call('forward', [numLit(50)]))],
      )),
    );
    expect(interpret(prog)).toEqual(EMPTY);
  });

  it('returns else-branch drawing when condition is false', () => {
    // if false do forward(50) else turn(90) end  → turn(90)
    const prog = program(
      exprStmt(ifExpr(
        boolLit(false),
        [exprStmt(call('forward', [numLit(50)]))],
        [exprStmt(call('turn', [numLit(90)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkTurn(90)]));
  });

  it('throws SproutRuntimeError when condition is not a bool', () => {
    const prog = program(
      exprStmt(ifExpr(numLit(1), [exprStmt(call('forward', [numLit(10)]))])),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow('if: condition must be a bool');
  });

  it('evaluates condition using a comparison', () => {
    // if 5 < 10 do forward(30) end  → forward(30)
    const prog = program(
      exprStmt(ifExpr(
        infix('<', numLit(5), numLit(10)),
        [exprStmt(call('forward', [numLit(30)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(30)]));
  });
});

describe('comparison operators', () => {
  const testCmp = (op: string, l: number, r: number, expected: boolean) => {
    // Use if to observe the bool: true → forward(1), else → turn(1)
    const prog = program(
      exprStmt(ifExpr(
        infix(op, numLit(l), numLit(r)),
        [exprStmt(call('forward', [numLit(1)]))],
        [exprStmt(call('turn', [numLit(1)]))],
      )),
    );
    if (expected) {
      expect(interpret(prog)).toEqual(mkSequence([mkForward(1)]));
    } else {
      expect(interpret(prog)).toEqual(mkSequence([mkTurn(1)]));
    }
  };

  it('< returns true when left < right',  () => testCmp('<',  3, 5, true));
  it('< returns false when left >= right', () => testCmp('<',  5, 3, false));
  it('> returns true when left > right',  () => testCmp('>',  5, 3, true));
  it('>= returns true when equal',         () => testCmp('>=', 4, 4, true));
  it('<= returns true when left < right',  () => testCmp('<=', 2, 4, true));
  it('== returns true for equal numbers',  () => testCmp('==', 7, 7, true));
  it('== returns false for unequal',       () => testCmp('==', 7, 8, false));
  it('!= returns true for unequal',        () => testCmp('!=', 7, 8, true));
  it('!= returns false for equal',         () => testCmp('!=', 7, 7, false));

  it('== works on booleans', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('==', boolLit(true), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(1)]));
  });

  it('throws when comparing incompatible types', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('==', numLit(1), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });
});

describe('UnaryExpr not', () => {
  it('negates true to false', () => {
    const prog = program(
      exprStmt(ifExpr(
        unary('not', boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
        [exprStmt(call('turn', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkTurn(1)]));
  });

  it('negates false to true', () => {
    const prog = program(
      exprStmt(ifExpr(
        unary('not', boolLit(false)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(1)]));
  });

  it('throws when operand is not a bool', () => {
    const prog = program(
      exprStmt(ifExpr(
        unary('not', numLit(1)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow('not: expected bool');
  });
});

describe('and / or short-circuit', () => {
  it('and returns false without evaluating right when left is false', () => {
    // false and (1/0 > 0)  — right would throw if evaluated
    const prog = program(
      exprStmt(ifExpr(
        infix('and', boolLit(false), infix('>', infix('/', numLit(1), numLit(0)), numLit(0))),
        [exprStmt(call('forward', [numLit(1)]))],
        [exprStmt(call('turn', [numLit(1)]))],
      )),
    );
    // Should NOT throw (right side not evaluated) and should return turn(1)
    expect(interpret(prog)).toEqual(mkSequence([mkTurn(1)]));
  });

  it('and returns right value when left is true', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('and', boolLit(true), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(1)]));
  });

  it('or returns true without evaluating right when left is true', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('or', boolLit(true), infix('>', infix('/', numLit(1), numLit(0)), numLit(0))),
        [exprStmt(call('forward', [numLit(1)]))],
        [exprStmt(call('turn', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(1)]));
  });

  it('or evaluates right when left is false', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('or', boolLit(false), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(1)]));
  });

  it('throws when and operand is not a bool', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('and', numLit(1), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow('and: expected bool');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun run vitest run packages/lang/tests/interpreter.test.ts
```

Expected: TypeScript compile errors — `IfExpr`, `UnaryExpr` don't exist yet; `infix` op type too narrow.

- [ ] **Step 3: Update AST — add IfExpr, UnaryExpr, extend InfixExpr.op, update Expr union**

Replace the contents of `packages/lang/src/ast.ts`:

```typescript
// AST node discriminated union types for the Sprout language.
// The AST is built by the block compiler (never by a text parser) and
// walked by the interpreter and the read-only display serializer.

// ---------------------------------------------------------------------------
// Literal nodes
// ---------------------------------------------------------------------------

export interface NumberLit {
  readonly kind: 'NumberLit';
  readonly value: number;
}

export interface StringLit {
  readonly kind: 'StringLit';
  readonly value: string;
}

/** Symbol literal — written as `:name` in display text */
export interface SymbolLit {
  readonly kind: 'SymbolLit';
  readonly name: string;
}

export interface BoolLit {
  readonly kind: 'BoolLit';
  readonly value: boolean;
}

// ---------------------------------------------------------------------------
// Reference / identifier
// ---------------------------------------------------------------------------

export interface Ident {
  readonly kind: 'Ident';
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Compound expressions
// ---------------------------------------------------------------------------

/** Binary arithmetic, comparison, or boolean expression */
export interface InfixExpr {
  readonly kind: 'InfixExpr';
  readonly op: '+' | '-' | '*' | '/' | '<' | '>' | '<=' | '>=' | '==' | '!=' | 'and' | 'or';
  readonly left: Expr;
  readonly right: Expr;
}

/** Prefix unary expression — currently only `not` */
export interface UnaryExpr {
  readonly kind: 'UnaryExpr';
  readonly op: 'not';
  readonly operand: Expr;
}

/**
 * Function call.
 * `block` holds an optional `do...end` body (higher-order blocks such as
 * `repeat` or user-defined functions that accept a block argument).
 */
export interface CallExpr {
  readonly kind: 'CallExpr';
  readonly callee: string;
  readonly args: readonly Expr[];
  readonly block: BlockExpr | null;
}

/** `do ... end` block — a sequence of statements used as a value */
export interface BlockExpr {
  readonly kind: 'BlockExpr';
  readonly body: readonly Stmt[];
}

/** `repeat <count> do ... end` */
export interface RepeatExpr {
  readonly kind: 'RepeatExpr';
  readonly count: Expr;
  readonly body: BlockExpr;
}

/** Event handler: `on :<event> do ... end` */
export interface OnExpr {
  readonly kind: 'OnExpr';
  // Full SymbolLit node (not just the name string) to preserve source fidelity.
  // Interpreter should use event.name for the string key.
  readonly event: SymbolLit;
  readonly body: BlockExpr;
}

/** `if <cond> do ... [else ...] end` */
export interface IfExpr {
  readonly kind: 'IfExpr';
  readonly cond: Expr;
  readonly then: BlockExpr;
  readonly else: BlockExpr | null;
}

// ---------------------------------------------------------------------------
// Expr union
// ---------------------------------------------------------------------------

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
  | IfExpr;

// ---------------------------------------------------------------------------
// Statement nodes
// ---------------------------------------------------------------------------

/** Function definition: `def name(params) = body` */
export interface DefStmt {
  readonly kind: 'DefStmt';
  readonly name: string;
  readonly params: readonly string[];
  readonly body: Expr;
}

/** An expression used as a statement (e.g. `forward(100)`) */
export interface ExprStmt {
  readonly kind: 'ExprStmt';
  readonly expr: Expr;
}

// ---------------------------------------------------------------------------
// Stmt union
// ---------------------------------------------------------------------------

export type Stmt = DefStmt | ExprStmt;

// ---------------------------------------------------------------------------
// Top-level program
// ---------------------------------------------------------------------------

export interface Program {
  readonly kind: 'Program';
  readonly stmts: readonly Stmt[];
}

// ---------------------------------------------------------------------------
// Node — the complete union of everything the interpreter may encounter
// ---------------------------------------------------------------------------

export type Node = Program | Stmt | Expr;
```

- [ ] **Step 4: Update interpreter — fix infix helper type in test file, add IfExpr + UnaryExpr handling**

First update the `infix` helper type in `packages/lang/tests/interpreter.test.ts` (line 27–28):

```typescript
const infix = (op: string, left: Expr, right: Expr): Expr =>
  ({ kind: 'InfixExpr', op: op as InfixExpr['op'], left, right });
```

Also add `IfExpr, InfixExpr` to the import from `'../src/ast.js'`:

```typescript
import type { Program, Expr, Stmt, IfExpr, InfixExpr } from '../src/ast.js';
```

Now update `packages/lang/src/interpreter.ts`:

**4a.** Add `IfExpr` and `UnaryExpr` to the imports at the top:

```typescript
import type {
  Program,
  Stmt,
  Expr,
  DefStmt,
  ExprStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
  InfixExpr,
  CallExpr,
  BlockExpr,
  RepeatExpr,
  OnExpr,
  IfExpr,
  UnaryExpr,
} from './ast.js';
```

**4b.** In `evalExpr`, add two new cases before the `default` (after the `OnExpr` case):

```typescript
    // --- If conditional ---
    case 'IfExpr': {
      const cond = evalExpr(expr.cond, env);
      if (cond.kind !== 'bool') {
        throw new SproutRuntimeError(`if: condition must be a bool, got ${cond.kind}`);
      }
      if (cond.value) return evalBlock(expr.then, env);
      if (expr.else !== null) return evalBlock(expr.else, env);
      return EMPTY;
    }

    // --- Unary not ---
    case 'UnaryExpr': {
      const v = evalExpr(expr.operand, env);
      if (v.kind !== 'bool') {
        throw new SproutRuntimeError(`not: expected bool, got ${v.kind}`);
      }
      return { kind: 'bool', value: !v.value };
    }
```

**4c.** Replace the entire `evalInfix` function with this expanded version:

```typescript
function evalInfix(expr: InfixExpr, env: Env): SproutValue {
  // Short-circuit boolean operators — evaluate lazily
  if (expr.op === 'and') {
    const lv = evalExpr(expr.left, env);
    if (lv.kind !== 'bool') throw new SproutRuntimeError(`and: expected bool, got ${lv.kind}`);
    if (!lv.value) return lv;
    const rv = evalExpr(expr.right, env);
    if (rv.kind !== 'bool') throw new SproutRuntimeError(`and: expected bool, got ${rv.kind}`);
    return rv;
  }
  if (expr.op === 'or') {
    const lv = evalExpr(expr.left, env);
    if (lv.kind !== 'bool') throw new SproutRuntimeError(`or: expected bool, got ${lv.kind}`);
    if (lv.value) return lv;
    const rv = evalExpr(expr.right, env);
    if (rv.kind !== 'bool') throw new SproutRuntimeError(`or: expected bool, got ${rv.kind}`);
    return rv;
  }
  // == and != work on numbers or bools (same kind required)
  if (expr.op === '==' || expr.op === '!=') {
    const lv = evalExpr(expr.left, env);
    const rv = evalExpr(expr.right, env);
    let eq: boolean;
    if (lv.kind === 'number' && rv.kind === 'number') {
      eq = lv.value === rv.value;
    } else if (lv.kind === 'bool' && rv.kind === 'bool') {
      eq = lv.value === rv.value;
    } else {
      throw new SproutRuntimeError(`${expr.op}: cannot compare ${lv.kind} and ${rv.kind}`);
    }
    return { kind: 'bool', value: expr.op === '==' ? eq : !eq };
  }
  // Arithmetic and numeric comparisons — both operands must be numbers
  const left = assertNumber(evalExpr(expr.left, env), `(${expr.op}) left operand`);
  const right = assertNumber(evalExpr(expr.right, env), `(${expr.op}) right operand`);
  switch (expr.op) {
    case '+':  return { kind: 'number', value: left.value + right.value };
    case '-':  return { kind: 'number', value: left.value - right.value };
    case '*':  return { kind: 'number', value: left.value * right.value };
    case '/':
      if (right.value === 0) throw new SproutRuntimeError('Division by zero');
      return { kind: 'number', value: left.value / right.value };
    case '<':  return { kind: 'bool', value: left.value <  right.value };
    case '>':  return { kind: 'bool', value: left.value >  right.value };
    case '<=': return { kind: 'bool', value: left.value <= right.value };
    case '>=': return { kind: 'bool', value: left.value >= right.value };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
bun run vitest run packages/lang/tests/interpreter.test.ts
```

Expected: all tests pass. TypeScript should compile cleanly (the exhaustiveness check in `evalInfix` will now cover all op cases).

- [ ] **Step 6: Commit**

```
git add packages/lang/src/ast.ts packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add IfExpr/UnaryExpr AST nodes and conditional evaluation"
```

---

## Task 2: Serializer + public index exports

**Files:**
- Modify: `packages/lang/src/serializer.ts`
- Modify: `packages/lang/src/index.ts`
- Modify: `packages/lang/tests/serializer.test.ts`

- [ ] **Step 1: Write failing serializer tests**

Add to the bottom of `packages/lang/tests/serializer.test.ts`:

First update the `infix` helper type on line 14:
```typescript
const infix = (op: string, left: Expr, right: Expr): Expr =>
  ({ kind: 'InfixExpr', op: op as import('./ast.js').InfixExpr['op'], left, right });
```

Then add these helpers and describe blocks:

```typescript
// Add to the existing helpers block:
const ifExpr = (
  cond: Expr,
  thenStmts: Stmt[],
  elseStmts: Stmt[] | null = null,
): Expr => ({
  kind: 'IfExpr' as const,
  cond,
  then: { kind: 'BlockExpr' as const, body: thenStmts },
  else: elseStmts !== null ? { kind: 'BlockExpr' as const, body: elseStmts } : null,
});
const unary = (op: 'not', operand: Expr): Expr =>
  ({ kind: 'UnaryExpr' as const, op, operand });

// Describe blocks at the bottom of the file:

describe('IfExpr serialization', () => {
  it('serializes if without else', () => {
    const expr = ifExpr(
      boolLit(true),
      [exprStmt(call('forward', [numLit(50)]))],
    );
    expect(serializeExpr(expr)).toBe(
      'if true do\n  forward(50)\nend'
    );
  });

  it('serializes if with else', () => {
    const expr = ifExpr(
      boolLit(false),
      [exprStmt(call('forward', [numLit(50)]))],
      [exprStmt(call('turn', [numLit(90)]))],
    );
    expect(serializeExpr(expr)).toBe(
      'if false do\n  forward(50)\nelse\n  turn(90)\nend'
    );
  });

  it('serializes nested if with comparison condition', () => {
    const expr = ifExpr(
      infix('<', numLit(3), numLit(10)),
      [exprStmt(call('forward', [numLit(1)]))],
    );
    expect(serializeExpr(expr)).toBe(
      'if 3 < 10 do\n  forward(1)\nend'
    );
  });
});

describe('UnaryExpr serialization', () => {
  it('serializes not true', () => {
    expect(serializeExpr(unary('not', boolLit(true)))).toBe('not true');
  });

  it('serializes not with nested expression', () => {
    expect(serializeExpr(unary('not', infix('==', numLit(1), numLit(2))))).toBe('not 1 == 2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun run vitest run packages/lang/tests/serializer.test.ts
```

Expected: TypeScript errors — `IfExpr` not exported, `UnaryExpr` not in Expr union for serializer.

- [ ] **Step 3: Update serializer.ts — handle IfExpr and UnaryExpr**

In `packages/lang/src/serializer.ts`, update the import to include `IfExpr` and `UnaryExpr`:

```typescript
import type { Program, Expr, Stmt, BlockExpr, IfExpr, UnaryExpr } from './ast.js';
```

Then add two cases to `serializeExpr` before the `default` case (after `OnExpr`):

```typescript
    case 'IfExpr': {
      const condStr = serializeExpr(expr.cond, indentLevel);
      const thenStr = serializeBlock(expr.then, indentLevel + 1);
      if (expr.else === null) {
        return `if ${condStr} do\n${thenStr}\n${indent(indentLevel)}end`;
      }
      const elseStr = serializeBlock(expr.else, indentLevel + 1);
      return `if ${condStr} do\n${thenStr}\n${indent(indentLevel)}else\n${elseStr}\n${indent(indentLevel)}end`;
    }

    case 'UnaryExpr':
      return `not ${serializeExpr(expr.operand, indentLevel)}`;
```

- [ ] **Step 4: Update index.ts — export IfExpr and UnaryExpr**

In `packages/lang/src/index.ts`, add `IfExpr` and `UnaryExpr` to the AST node exports:

```typescript
export type {
  // AST nodes
  Program,
  DefStmt,
  ExprStmt,
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
  // Unions
  Expr,
  Stmt,
  Node,
} from './ast.js';
```

- [ ] **Step 5: Run tests to verify they pass**

```
bun run vitest run packages/lang/tests/serializer.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Run the full suite to verify nothing regressed**

```
bun run vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```
git add packages/lang/src/serializer.ts packages/lang/src/index.ts packages/lang/tests/serializer.test.ts
git commit -m "feat(lang): serialize IfExpr/UnaryExpr; export new AST types from public index"
```

---

## Task 3: Lexer — comparison tokens

**Files:**
- Modify: `packages/parser/src/lexer.ts`
- Modify: `packages/parser/tests/parser.test.ts`

- [ ] **Step 1: Write failing tokenizer tests**

Add to `packages/parser/tests/parser.test.ts`, inside the `describe('tokenize', ...)` block (before its closing `}`):

```typescript
  it('tokenizes < and >', () => {
    expect(tokenize('< >')).toEqual([
      { kind: 'LT' },
      { kind: 'GT' },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes <= and >=', () => {
    expect(tokenize('<= >=')).toEqual([
      { kind: 'LTE' },
      { kind: 'GTE' },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes == and !=', () => {
    expect(tokenize('== !=')).toEqual([
      { kind: 'EQEQ' },
      { kind: 'NEQ' },
      { kind: 'EOF' },
    ]);
  });

  it('does not confuse = with ==', () => {
    expect(tokenize('=')).toEqual([{ kind: 'EQ' }, { kind: 'EOF' }]);
    expect(tokenize('==')).toEqual([{ kind: 'EQEQ' }, { kind: 'EOF' }]);
  });

  it('does not confuse < with <=', () => {
    expect(tokenize('<')).toEqual([{ kind: 'LT' }, { kind: 'EOF' }]);
    expect(tokenize('<=')).toEqual([{ kind: 'LTE' }, { kind: 'EOF' }]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun run vitest run packages/parser/tests/parser.test.ts
```

Expected: FAIL — `LT`, `GT`, `LTE`, `GTE`, `EQEQ`, `NEQ` not in Token type.

- [ ] **Step 3: Add new tokens to the lexer**

Replace `packages/parser/src/lexer.ts` with:

```typescript
export type Token =
  | { kind: 'NUMBER'; value: number }
  | { kind: 'STRING'; value: string }
  | { kind: 'SYMBOL'; name: string }
  | { kind: 'IDENT'; name: string }
  | { kind: 'PLUS' }
  | { kind: 'MINUS' }
  | { kind: 'STAR' }
  | { kind: 'SLASH' }
  | { kind: 'LPAREN' }
  | { kind: 'RPAREN' }
  | { kind: 'COMMA' }
  | { kind: 'EQ' }
  | { kind: 'EQEQ' }
  | { kind: 'LT' }
  | { kind: 'GT' }
  | { kind: 'LTE' }
  | { kind: 'GTE' }
  | { kind: 'NEQ' }
  | { kind: 'EOF' };

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    // Whitespace (including newlines) — ignored
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    // Line comments: # to end of line
    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // Number: [0-9]+ ('.' [0-9]+)?
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < source.length && source[j] >= '0' && source[j] <= '9') j++;
      if (j < source.length && source[j] === '.') {
        j++;
        while (j < source.length && source[j] >= '0' && source[j] <= '9') j++;
      }
      tokens.push({ kind: 'NUMBER', value: Number(source.slice(i, j)) });
      i = j;
      continue;
    }

    // String: '"' [^"]* '"'
    if (ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') j++;
      if (j >= source.length) throw new ParseError('Unterminated string literal');
      tokens.push({ kind: 'STRING', value: source.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    // Symbol: ':' [a-z][a-z0-9_]*
    if (ch === ':' && i + 1 < source.length && isLower(source[i + 1])) {
      let j = i + 1;
      while (j < source.length && isIdentChar(source[j])) j++;
      tokens.push({ kind: 'SYMBOL', name: source.slice(i + 1, j) });
      i = j;
      continue;
    }

    // Identifier or keyword: [a-zA-Z_][a-zA-Z0-9_]*
    if (isAlpha(ch)) {
      let j = i;
      while (j < source.length && isIdentChar(source[j])) j++;
      tokens.push({ kind: 'IDENT', name: source.slice(i, j) });
      i = j;
      continue;
    }

    // Two-character tokens — check before single-character
    if (ch === '<' && source[i + 1] === '=') { tokens.push({ kind: 'LTE' });  i += 2; continue; }
    if (ch === '>' && source[i + 1] === '=') { tokens.push({ kind: 'GTE' });  i += 2; continue; }
    if (ch === '=' && source[i + 1] === '=') { tokens.push({ kind: 'EQEQ' }); i += 2; continue; }
    if (ch === '!' && source[i + 1] === '=') { tokens.push({ kind: 'NEQ' });  i += 2; continue; }

    // Single-character tokens
    switch (ch) {
      case '+': tokens.push({ kind: 'PLUS' });   i++; break;
      case '-': tokens.push({ kind: 'MINUS' });  i++; break;
      case '*': tokens.push({ kind: 'STAR' });   i++; break;
      case '/': tokens.push({ kind: 'SLASH' });  i++; break;
      case '(': tokens.push({ kind: 'LPAREN' }); i++; break;
      case ')': tokens.push({ kind: 'RPAREN' }); i++; break;
      case ',': tokens.push({ kind: 'COMMA' });  i++; break;
      case '=': tokens.push({ kind: 'EQ' });     i++; break;
      case '<': tokens.push({ kind: 'LT' });     i++; break;
      case '>': tokens.push({ kind: 'GT' });     i++; break;
      default:
        throw new ParseError(`Unexpected character: '${ch}' at position ${i}`);
    }
  }

  tokens.push({ kind: 'EOF' });
  return tokens;
}

function isLower(ch: string): boolean {
  return ch >= 'a' && ch <= 'z';
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentChar(ch: string): boolean {
  return isAlpha(ch) || (ch >= '0' && ch <= '9');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
bun run vitest run packages/parser/tests/parser.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add packages/parser/src/lexer.ts packages/parser/tests/parser.test.ts
git commit -m "feat(parser): add comparison tokens LT/GT/LTE/GTE/EQEQ/NEQ to lexer"
```

---

## Task 4: Parser — if/else, comparisons, not, and/or

**Files:**
- Modify: `packages/parser/src/parser.ts`
- Modify: `packages/parser/tests/parser.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add these describe blocks to the bottom of `packages/parser/tests/parser.test.ts`:

```typescript
// Add to the existing helpers block (at the top of the test file):
const ifE = (cond: object, thenBody: object[], elseBody: object[] | null = null) => ({
  kind: 'IfExpr' as const,
  cond,
  then: blockE(thenBody),
  else: elseBody !== null ? blockE(elseBody) : null,
});
const unaryE = (op: 'not', operand: object) =>
  ({ kind: 'UnaryExpr' as const, op, operand });

// Then these describe blocks at the bottom:

describe('parse — comparison operators', () => {
  it('parses x < y', () => {
    expect(parse('3 < 10')).toEqual(
      prog(exprS(infix('<', num(3), num(10))))
    );
  });

  it('parses x > y', () => {
    expect(parse('10 > 3')).toEqual(
      prog(exprS(infix('>', num(10), num(3))))
    );
  });

  it('parses x <= y', () => {
    expect(parse('4 <= 4')).toEqual(
      prog(exprS(infix('<=', num(4), num(4))))
    );
  });

  it('parses x >= y', () => {
    expect(parse('5 >= 3')).toEqual(
      prog(exprS(infix('>=', num(5), num(3))))
    );
  });

  it('parses x == y', () => {
    expect(parse('7 == 7')).toEqual(
      prog(exprS(infix('==', num(7), num(7))))
    );
  });

  it('parses x != y', () => {
    expect(parse('7 != 8')).toEqual(
      prog(exprS(infix('!=', num(7), num(8))))
    );
  });
});

describe('parse — boolean operators', () => {
  it('parses not expr', () => {
    expect(parse('not true')).toEqual(
      prog(exprS(unaryE('not', bool_(true))))
    );
  });

  it('parses a and b', () => {
    expect(parse('true and false')).toEqual(
      prog(exprS(infix('and', bool_(true), bool_(false))))
    );
  });

  it('parses a or b', () => {
    expect(parse('false or true')).toEqual(
      prog(exprS(infix('or', bool_(false), bool_(true))))
    );
  });

  it('and has higher precedence than or', () => {
    // a or b and c  →  a or (b and c)
    expect(parse('false or true and false')).toEqual(
      prog(exprS(infix('or', bool_(false), infix('and', bool_(true), bool_(false)))))
    );
  });

  it('comparison has higher precedence than and', () => {
    // x < 10 and y > 0  →  (x < 10) and (y > 0)
    expect(parse('3 < 10 and 5 > 0')).toEqual(
      prog(exprS(infix('and',
        infix('<', num(3), num(10)),
        infix('>', num(5), num(0)),
      )))
    );
  });
});

describe('parse — if expression', () => {
  it('parses if without else', () => {
    expect(parse('if true do\n  forward(50)\nend')).toEqual(
      prog(exprS(ifE(
        bool_(true),
        [exprS(callE('forward', [num(50)]))],
      )))
    );
  });

  it('parses if with else', () => {
    expect(parse('if false do\n  forward(50)\nelse\n  turn(90)\nend')).toEqual(
      prog(exprS(ifE(
        bool_(false),
        [exprS(callE('forward', [num(50)]))],
        [exprS(callE('turn', [num(90)]))],
      )))
    );
  });

  it('parses if with comparison condition', () => {
    expect(parse('if 3 < 10 do\n  forward(1)\nend')).toEqual(
      prog(exprS(ifE(
        infix('<', num(3), num(10)),
        [exprS(callE('forward', [num(1)]))],
      )))
    );
  });

  it('parses nested if inside if body', () => {
    expect(parse('if true do\n  if false do\n    forward(1)\n  end\nend')).toEqual(
      prog(exprS(ifE(
        bool_(true),
        [exprS(ifE(bool_(false), [exprS(callE('forward', [num(1)]))]))],
      )))
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun run vitest run packages/parser/tests/parser.test.ts
```

Expected: FAIL — `if`, `not`, `and`, `or` not parsed; comparison tokens not recognised as infix ops.

- [ ] **Step 3: Update parser.ts**

Replace `packages/parser/src/parser.ts` with:

```typescript
import { tokenize, type Token, ParseError } from './lexer.js';
import type {
  Program, Stmt, Expr, DefStmt,
  BlockExpr, RepeatExpr, OnExpr, CallExpr, IfExpr, UnaryExpr,
} from '@sprout/lang';

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(source: string) {
    this.tokens = tokenize(source);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (t.kind !== 'EOF') this.pos++;
    return t;
  }

  private check(kind: Token['kind']): boolean {
    return this.peek().kind === kind;
  }

  private checkIdent(name: string): boolean {
    const t = this.peek();
    return t.kind === 'IDENT' && t.name === name;
  }

  private eat(kind: Token['kind']): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      const got = t.kind === 'IDENT'
        ? `'${(t as { kind: 'IDENT'; name: string }).name}'`
        : t.kind;
      throw new ParseError(`Expected ${kind}, got ${got}`);
    }
    return this.advance();
  }

  private eatIdent(name: string): void {
    const t = this.peek();
    if (t.kind !== 'IDENT' || t.name !== name) {
      const got = t.kind === 'IDENT'
        ? `'${(t as { kind: 'IDENT'; name: string }).name}'`
        : t.kind;
      throw new ParseError(`Expected '${name}', got ${got}`);
    }
    this.advance();
  }

  // -------------------------------------------------------------------------
  // Program and statements
  // -------------------------------------------------------------------------

  parseProgram(): Program {
    const stmts: Stmt[] = [];
    while (!this.check('EOF')) {
      stmts.push(this.parseStmt());
    }
    return { kind: 'Program', stmts };
  }

  private parseStmt(): Stmt {
    if (this.checkIdent('def')) return this.parseDef();
    return { kind: 'ExprStmt', expr: this.parseExpr() };
  }

  private parseDef(): DefStmt {
    this.eatIdent('def');
    const nameTok = this.eat('IDENT') as { kind: 'IDENT'; name: string };
    const name = nameTok.name;

    const params: string[] = [];
    if (this.check('LPAREN')) {
      this.advance();
      while (!this.check('RPAREN') && !this.check('EOF')) {
        const p = this.eat('IDENT') as { kind: 'IDENT'; name: string };
        params.push(p.name);
        if (this.check('COMMA')) this.advance();
      }
      this.eat('RPAREN');
    }

    if (this.check('EQ')) {
      this.advance();
      const body = this.parseExpr();
      return { kind: 'DefStmt', name, params, body };
    }

    const bodyStmts = this.parseBodyUntil(['end']);
    this.eatIdent('end');
    const body: BlockExpr = { kind: 'BlockExpr', body: bodyStmts };
    return { kind: 'DefStmt', name, params, body };
  }

  /**
   * Parse statements until one of the stop-word identifiers is encountered.
   * Does NOT consume the stop word — caller must eatIdent it.
   */
  private parseBodyUntil(stops: string[]): Stmt[] {
    const stmts: Stmt[] = [];
    while (!stops.some(s => this.checkIdent(s)) && !this.check('EOF')) {
      stmts.push(this.parseStmt());
    }
    return stmts;
  }

  private parseDoBlock(): BlockExpr {
    this.eatIdent('do');
    const stmts = this.parseBodyUntil(['end']);
    this.eatIdent('end');
    return { kind: 'BlockExpr', body: stmts };
  }

  // -------------------------------------------------------------------------
  // Expressions — Pratt precedence climbing
  // -------------------------------------------------------------------------

  parseExpr(): Expr {
    return this.parseInfix(0);
  }

  private parseInfix(minPrec: number): Expr {
    let left = this.parseAtom();

    while (true) {
      const [op, prec] = this.peekOp();
      if (op === null || prec <= minPrec) break;
      this.advance();
      const right = this.parseInfix(prec);
      left = {
        kind: 'InfixExpr',
        op: op as '+' | '-' | '*' | '/' | '<' | '>' | '<=' | '>=' | '==' | '!=' | 'and' | 'or',
        left,
        right,
      };
    }

    return left;
  }

  private peekOp(): [string | null, number] {
    const t = this.peek();
    switch (t.kind) {
      case 'PLUS':  return ['+', 4];
      case 'MINUS': return ['-', 4];
      case 'STAR':  return ['*', 5];
      case 'SLASH': return ['/', 5];
      case 'LT':    return ['<',  3];
      case 'GT':    return ['>',  3];
      case 'LTE':   return ['<=', 3];
      case 'GTE':   return ['>=', 3];
      case 'EQEQ':  return ['==', 3];
      case 'NEQ':   return ['!=', 3];
      case 'IDENT':
        if (t.name === 'and') return ['and', 2];
        if (t.name === 'or')  return ['or',  1];
        return [null, 0];
      default: return [null, 0];
    }
  }

  private parseAtom(): Expr {
    const t = this.peek();

    if (t.kind === 'NUMBER') {
      this.advance();
      return { kind: 'NumberLit', value: t.value };
    }

    if (t.kind === 'STRING') {
      this.advance();
      return { kind: 'StringLit', value: t.value };
    }

    if (t.kind === 'SYMBOL') {
      this.advance();
      return { kind: 'SymbolLit', name: t.name };
    }

    if (t.kind === 'LPAREN') {
      this.advance();
      const expr = this.parseExpr();
      this.eat('RPAREN');
      return expr;
    }

    if (t.kind === 'IDENT') {
      const name = t.name;

      if (name === 'true')  { this.advance(); return { kind: 'BoolLit', value: true }; }
      if (name === 'false') { this.advance(); return { kind: 'BoolLit', value: false }; }

      if (name === 'not') {
        this.advance();
        const operand = this.parseAtom();
        return { kind: 'UnaryExpr', op: 'not', operand } satisfies UnaryExpr;
      }

      if (name === 'if') {
        this.advance();
        const cond = this.parseExpr();
        this.eatIdent('do');
        const thenStmts = this.parseBodyUntil(['else', 'end']);
        const thenBlock: BlockExpr = { kind: 'BlockExpr', body: thenStmts };
        let elseBlock: BlockExpr | null = null;
        if (this.checkIdent('else')) {
          this.advance();
          const elseStmts = this.parseBodyUntil(['end']);
          elseBlock = { kind: 'BlockExpr', body: elseStmts };
        }
        this.eatIdent('end');
        return { kind: 'IfExpr', cond, then: thenBlock, else: elseBlock } satisfies IfExpr;
      }

      if (name === 'repeat') {
        this.advance();
        const count = this.parseExpr();
        const body = this.parseDoBlock();
        return { kind: 'RepeatExpr', count, body } satisfies RepeatExpr;
      }

      if (name === 'on') {
        this.advance();
        const symTok = this.eat('SYMBOL') as { kind: 'SYMBOL'; name: string };
        const event = { kind: 'SymbolLit' as const, name: symTok.name };
        const body = this.parseDoBlock();
        return { kind: 'OnExpr', event, body } satisfies OnExpr;
      }

      this.advance();

      if (this.check('LPAREN')) {
        this.advance();
        const args: Expr[] = [];
        while (!this.check('RPAREN') && !this.check('EOF')) {
          args.push(this.parseExpr());
          if (this.check('COMMA')) this.advance();
        }
        this.eat('RPAREN');

        if (this.checkIdent('do')) {
          const block = this.parseDoBlock();
          return { kind: 'CallExpr', callee: name, args, block } satisfies CallExpr;
        }
        return { kind: 'CallExpr', callee: name, args, block: null } satisfies CallExpr;
      }

      return { kind: 'Ident', name };
    }

    throw new ParseError(
      `Unexpected token: ${t.kind}${t.kind === 'IDENT' ? ` ('${(t as { kind: 'IDENT'; name: string }).name}')` : ''}`,
    );
  }
}

export function parse(source: string): Program {
  return new Parser(source).parseProgram();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
bun run vitest run packages/parser/tests/parser.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add packages/parser/src/parser.ts packages/parser/tests/parser.test.ts
git commit -m "feat(parser): parse if/else, comparisons, not, and/or"
```

---

## Task 5: Blocks + Compiler — Blockly integration

**Files:**
- Create: `packages/blocks/src/definitions/conditionals.ts`
- Modify: `packages/blocks/src/definitions/index.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write failing compiler tests**

Add to the bottom of `packages/blocks/tests/compiler.test.ts`:

```typescript
  it('compiles sprout_if (no else) to IfExpr', () => {
    const ws = makeWorkspace();
    const ifBlock = ws.newBlock('sprout_if');

    // COND: sprout_bool true
    const condBlock = ws.newBlock('sprout_bool');
    condBlock.setFieldValue('true', 'VALUE');
    ifBlock.getInput('COND')!.connection!.connect(condBlock.outputConnection!);

    // THEN body: sprout_forward 20
    const fwdBlock = ws.newBlock('sprout_forward');
    const fwd20 = ws.newBlock('sprout_number');
    fwd20.setFieldValue('20', 'NUM');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd20.outputConnection!);
    ifBlock.getInput('THEN')!.connection!.connect(fwdBlock.previousConnection!);

    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];
    const result = compileWorkspace(ws);

    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'IfExpr',
          cond: { kind: 'BoolLit', value: true },
          then: {
            kind: 'BlockExpr',
            body: [{
              kind: 'ExprStmt',
              expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 20 }], block: null },
            }],
          },
          else: null,
        },
      }],
    });
    ws.dispose();
  });

  it('compiles sprout_if with else to IfExpr with else branch', () => {
    const ws = makeWorkspace();
    const ifBlock = ws.newBlock('sprout_if');

    const condBlock = ws.newBlock('sprout_bool');
    condBlock.setFieldValue('false', 'VALUE');
    ifBlock.getInput('COND')!.connection!.connect(condBlock.outputConnection!);

    const thenFwd = ws.newBlock('sprout_forward');
    const thenNum = ws.newBlock('sprout_number');
    thenNum.setFieldValue('10', 'NUM');
    thenFwd.getInput('DISTANCE')!.connection!.connect(thenNum.outputConnection!);
    ifBlock.getInput('THEN')!.connection!.connect(thenFwd.previousConnection!);

    const elseTurn = ws.newBlock('sprout_turn');
    const elseNum = ws.newBlock('sprout_number');
    elseNum.setFieldValue('90', 'NUM');
    elseTurn.getInput('DEGREES')!.connection!.connect(elseNum.outputConnection!);
    ifBlock.getInput('ELSE')!.connection!.connect(elseTurn.previousConnection!);

    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];
    const result = compileWorkspace(ws);

    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'IfExpr',
          cond: { kind: 'BoolLit', value: false },
          then: {
            kind: 'BlockExpr',
            body: [{
              kind: 'ExprStmt',
              expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 10 }], block: null },
            }],
          },
          else: {
            kind: 'BlockExpr',
            body: [{
              kind: 'ExprStmt',
              expr: { kind: 'CallExpr', callee: 'turn', args: [{ kind: 'NumberLit', value: 90 }], block: null },
            }],
          },
        },
      }],
    });
    ws.dispose();
  });

  it('compiles sprout_compare to InfixExpr', () => {
    const ws = makeWorkspace();
    const cmpBlock = ws.newBlock('sprout_compare');
    cmpBlock.setFieldValue('<', 'OP');
    const left = ws.newBlock('sprout_number');
    left.setFieldValue('3', 'NUM');
    const right = ws.newBlock('sprout_number');
    right.setFieldValue('10', 'NUM');
    cmpBlock.getInput('LEFT')!.connection!.connect(left.outputConnection!);
    cmpBlock.getInput('RIGHT')!.connection!.connect(right.outputConnection!);

    // Wrap in sprout_if so it appears as a statement
    const ifBlock = ws.newBlock('sprout_if');
    ifBlock.getInput('COND')!.connection!.connect(cmpBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];

    const result = compileWorkspace(ws);
    expect((result.stmts[0] as { kind: 'ExprStmt'; expr: { kind: 'IfExpr'; cond: unknown } }).expr.cond).toEqual({
      kind: 'InfixExpr',
      op: '<',
      left: { kind: 'NumberLit', value: 3 },
      right: { kind: 'NumberLit', value: 10 },
    });
    ws.dispose();
  });

  it('compiles sprout_not to UnaryExpr', () => {
    const ws = makeWorkspace();
    const notBlock = ws.newBlock('sprout_not');
    const boolBlock = ws.newBlock('sprout_bool');
    boolBlock.setFieldValue('true', 'VALUE');
    notBlock.getInput('OPERAND')!.connection!.connect(boolBlock.outputConnection!);

    const ifBlock = ws.newBlock('sprout_if');
    ifBlock.getInput('COND')!.connection!.connect(notBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];

    const result = compileWorkspace(ws);
    expect((result.stmts[0] as { kind: 'ExprStmt'; expr: { kind: 'IfExpr'; cond: unknown } }).expr.cond).toEqual({
      kind: 'UnaryExpr',
      op: 'not',
      operand: { kind: 'BoolLit', value: true },
    });
    ws.dispose();
  });

  it('compiles sprout_and to InfixExpr', () => {
    const ws = makeWorkspace();
    const andBlock = ws.newBlock('sprout_and');
    const left = ws.newBlock('sprout_bool');
    left.setFieldValue('true', 'VALUE');
    const right = ws.newBlock('sprout_bool');
    right.setFieldValue('false', 'VALUE');
    andBlock.getInput('LEFT')!.connection!.connect(left.outputConnection!);
    andBlock.getInput('RIGHT')!.connection!.connect(right.outputConnection!);

    const ifBlock = ws.newBlock('sprout_if');
    ifBlock.getInput('COND')!.connection!.connect(andBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];

    const result = compileWorkspace(ws);
    expect((result.stmts[0] as { kind: 'ExprStmt'; expr: { kind: 'IfExpr'; cond: unknown } }).expr.cond).toEqual({
      kind: 'InfixExpr',
      op: 'and',
      left: { kind: 'BoolLit', value: true },
      right: { kind: 'BoolLit', value: false },
    });
    ws.dispose();
  });

  it('compiles sprout_bool block to BoolLit', () => {
    const ws = makeWorkspace();
    const boolBlock = ws.newBlock('sprout_bool');
    boolBlock.setFieldValue('false', 'VALUE');

    const ifBlock = ws.newBlock('sprout_if');
    ifBlock.getInput('COND')!.connection!.connect(boolBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];

    const result = compileWorkspace(ws);
    expect((result.stmts[0] as { kind: 'ExprStmt'; expr: { kind: 'IfExpr'; cond: unknown } }).expr.cond).toEqual(
      { kind: 'BoolLit', value: false }
    );
    ws.dispose();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```
bun run vitest run packages/blocks/tests/compiler.test.ts
```

Expected: FAIL — `sprout_if`, `sprout_compare`, `sprout_not`, `sprout_and`, `sprout_bool` blocks not registered.

- [ ] **Step 3: Create conditionals.ts block definitions**

Create `packages/blocks/src/definitions/conditionals.ts`:

```typescript
import * as Blockly from 'blockly/node';

export function registerConditionalBlocks(): void {
  Blockly.Blocks['sprout_if'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COND').setCheck(null).appendField('if');
      this.appendStatementInput('THEN').appendField('do');
      this.appendStatementInput('ELSE').appendField('else');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_compare'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck(null);
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ['<',  '<'],
          ['>',  '>'],
          ['<=', '<='],
          ['>=', '>='],
          ['==', '=='],
          ['!=', '!='],
        ]) as unknown as Blockly.Field,
        'OP',
      );
      this.appendValueInput('RIGHT').setCheck(null);
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_not'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('OPERAND').setCheck(null).appendField('not');
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_and'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck(null);
      this.appendDummyInput().appendField('and');
      this.appendValueInput('RIGHT').setCheck(null);
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_or'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck(null);
      this.appendDummyInput().appendField('or');
      this.appendValueInput('RIGHT').setCheck(null);
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_bool'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ['true',  'true'],
          ['false', 'false'],
        ]) as unknown as Blockly.Field,
        'VALUE',
      );
      this.setOutput(true, null);
      this.setColour(210);
    },
  };
}
```

- [ ] **Step 4: Register the new blocks in index.ts**

Replace `packages/blocks/src/definitions/index.ts`:

```typescript
import { registerStatementBlocks } from './statements.js';
import { registerValueBlocks } from './values.js';
import { registerConditionalBlocks } from './conditionals.js';

let registered = false;

export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  registerStatementBlocks();
  registerValueBlocks();
  registerConditionalBlocks();
}
```

- [ ] **Step 5: Update compiler.ts — add compileStmt and compileExpr cases**

In `packages/blocks/src/compiler.ts`:

**5a.** Add `IfExpr` and `UnaryExpr` to the imports at the top:

```typescript
import type {
  Program, Stmt, Expr,
  DefStmt, ExprStmt,
  NumberLit, Ident, InfixExpr, UnaryExpr, CallExpr,
  BlockExpr, RepeatExpr, OnExpr, SymbolLit, IfExpr,
} from '@sprout/lang';
```

**5b.** In `compileStmt`, add `'sprout_if'` to the statement cases (alongside the other drawing statements):

```typescript
    case 'sprout_forward':
    case 'sprout_turn':
    case 'sprout_pen_up':
    case 'sprout_pen_down':
    case 'sprout_color':
    case 'sprout_pen_width':
    case 'sprout_puts':
    case 'sprout_repeat':
    case 'sprout_on_event':
    case 'sprout_call_stmt':
    case 'sprout_beside':
    case 'sprout_above':
    case 'sprout_scale':
    case 'sprout_if':
      return { kind: 'ExprStmt', expr: compileExprBlock(block) };
```

**5c.** In `compileExprBlock`, add a `case 'sprout_if':` before the `default`:

```typescript
    case 'sprout_if': {
      const cond = compileExpr(mustGetInput(block, 'COND'));
      const thenFirst = block.getInputTargetBlock('THEN');
      const thenBlock = compileBlockExpr(thenFirst);
      const elseFirst = block.getInputTargetBlock('ELSE');
      const elseBlock: BlockExpr | null = elseFirst !== null ? compileBlockExpr(elseFirst) : null;
      return { kind: 'IfExpr', cond, then: thenBlock, else: elseBlock } satisfies IfExpr;
    }
```

**5d.** In `compileExpr`, add cases before the `default`:

```typescript
    case 'sprout_bool': {
      const value = block.getFieldValue('VALUE') === 'true';
      return { kind: 'BoolLit', value };
    }
    case 'sprout_compare': {
      const op = block.getFieldValue('OP') as '<' | '>' | '<=' | '>=' | '==' | '!=';
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      return { kind: 'InfixExpr', op, left, right } satisfies InfixExpr;
    }
    case 'sprout_not': {
      const operand = compileExpr(mustGetInput(block, 'OPERAND'));
      return { kind: 'UnaryExpr', op: 'not', operand } satisfies UnaryExpr;
    }
    case 'sprout_and': {
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      return { kind: 'InfixExpr', op: 'and', left, right } satisfies InfixExpr;
    }
    case 'sprout_or': {
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      return { kind: 'InfixExpr', op: 'or', left, right } satisfies InfixExpr;
    }
```

- [ ] **Step 6: Run tests to verify they pass**

```
bun run vitest run packages/blocks/tests/compiler.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Run the full suite to verify nothing regressed**

```
bun run vitest run
```

Expected: all tests pass (was 199, now ~240+).

- [ ] **Step 8: Commit**

```
git add packages/blocks/src/definitions/conditionals.ts packages/blocks/src/definitions/index.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add sprout_if, sprout_compare, sprout_not, sprout_and, sprout_or, sprout_bool blocks"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - IfExpr AST node → Task 1 ✓
  - UnaryExpr AST node → Task 1 ✓
  - Extended InfixExpr.op → Task 1 ✓
  - Interpreter: IfExpr, UnaryExpr, comparison/boolean ops → Task 1 ✓
  - Serializer: IfExpr, UnaryExpr → Task 2 ✓
  - Public exports → Task 2 ✓
  - Lexer tokens → Task 3 ✓
  - Parser: if/else, comparisons, not, and/or → Task 4 ✓
  - Blocks: sprout_if, sprout_compare, sprout_not, sprout_and, sprout_or, sprout_bool → Task 5 ✓
  - Compiler: all 6 blocks → Task 5 ✓

- [x] **No placeholders:** All steps contain complete code.

- [x] **Type consistency:**
  - `IfExpr` defined in Task 1 (AST), imported correctly in Task 4 (parser) and Task 5 (compiler).
  - `UnaryExpr` defined in Task 1 (AST), imported in Task 5.
  - `InfixExpr.op` extension covers `'and' | 'or'` — Task 5 compiler uses `satisfies InfixExpr` to catch mismatches.
  - `BlockExpr | null` for else branch is consistent across AST, interpreter, serializer, and compiler.
