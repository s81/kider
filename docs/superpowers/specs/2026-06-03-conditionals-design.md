# Conditionals Design Spec

**Date:** 2026-06-03
**Status:** Approved

---

## Goal

Add `if`/`else` conditional expressions to Sprout, with comparison operators (`<`, `>`, `<=`, `>=`, `==`, `!=`) and boolean logic (`and`, `or`, `not`). Conditions evaluate to `SproutBool`; `if` returns a `Drawing` (the taken branch, or `EMPTY` if no `else`).

---

## Syntax

```
if <cond> do
  <stmts>
end

if <cond> do
  <stmts>
else
  <stmts>
end
```

Comparison:

```
x < 10
x >= 100
x == y
x != 0
```

Boolean combinators:

```
x > 0 and x < 100
not x == 0
a or b
```

Operator precedence (low → high):

| Level | Operators         | Associativity |
|-------|-------------------|---------------|
| 0     | `or`              | left          |
| 1     | `and`             | left          |
| 2     | `not` (prefix)    | right         |
| 3     | `<` `>` `<=` `>=` `==` `!=` | left (non-associative) |
| 4     | `+` `-`           | left          |
| 5     | `*` `/`           | left          |

`not` is a prefix unary operator, handled in `parseAtom`. Comparisons are Pratt infix at precedence 3, arithmetic stays at 4/5.

---

## AST Changes (`packages/lang/src/ast.ts`)

### New node: `IfExpr`

```ts
export interface IfExpr {
  readonly kind: 'IfExpr';
  readonly cond: Expr;
  readonly then: BlockExpr;
  readonly else: BlockExpr | null;
}
```

### New node: `UnaryExpr`

```ts
export interface UnaryExpr {
  readonly kind: 'UnaryExpr';
  readonly op: 'not';
  readonly operand: Expr;
}
```

### Extended `InfixExpr.op`

```ts
readonly op: '+' | '-' | '*' | '/' | '<' | '>' | '<=' | '>=' | '==' | '!=' | 'and' | 'or';
```

### Updated `Expr` union

Add `IfExpr` and `UnaryExpr` to the `Expr` union.

---

## Interpreter Changes (`packages/lang/src/interpreter.ts`)

### `IfExpr`

```ts
case 'IfExpr': {
  const cond = evalExpr(expr.cond, env);
  if (cond.kind !== 'bool') throw new SproutRuntimeError(`if: condition must be a bool, got ${cond.kind}`);
  if (cond.value) return evalBlock(expr.then, env);
  if (expr.else !== null) return evalBlock(expr.else, env);
  return EMPTY;
}
```

### `UnaryExpr`

```ts
case 'UnaryExpr': {
  const v = evalExpr(expr.operand, env);
  if (v.kind !== 'bool') throw new SproutRuntimeError(`not: expected bool, got ${v.kind}`);
  return { kind: 'bool', value: !v.value };
}
```

### Extended `evalInfix` — comparison and boolean ops

Comparisons (`<`, `>`, `<=`, `>=`, `==`, `!=`) operate on two numbers and return `SproutBool`. `==` and `!=` also accept two bools.

`and`/`or` are handled via `InfixExpr` with short-circuit evaluation — evaluate left first, only evaluate right if needed.

```ts
case '<':  return { kind: 'bool', value: ln.value <  rn.value };
case '>':  return { kind: 'bool', value: ln.value >  rn.value };
case '<=': return { kind: 'bool', value: ln.value <= rn.value };
case '>=': return { kind: 'bool', value: ln.value >= rn.value };
case '==': return { kind: 'bool', value: ln.value === rn.value };  // numbers
case '!=': return { kind: 'bool', value: ln.value !== rn.value };
case 'and': {
  const lv = evalExpr(expr.left, env);
  if (lv.kind !== 'bool') throw new SproutRuntimeError(`and: expected bool, got ${lv.kind}`);
  if (!lv.value) return lv;
  const rv = evalExpr(expr.right, env);
  if (rv.kind !== 'bool') throw new SproutRuntimeError(`and: expected bool, got ${rv.kind}`);
  return rv;
}
case 'or': { /* symmetric */ }
```

`==` / `!=` handle both numbers and bools. `evalInfix` checks operand kinds before dispatching:

```ts
case '==':
case '!=': {
  if (left.kind === 'number' && right.kind === 'number') {
    return { kind: 'bool', value: expr.op === '==' ? left.value === right.value : left.value !== right.value };
  }
  if (left.kind === 'bool' && right.kind === 'bool') {
    return { kind: 'bool', value: expr.op === '==' ? left.value === right.value : left.value !== right.value };
  }
  throw new SproutRuntimeError(`${expr.op}: cannot compare ${left.kind} and ${right.kind}`);
}
```

---

## Lexer Changes (`packages/parser/src/lexer.ts`)

New token kinds:

```ts
| { kind: 'LT' }    // <
| { kind: 'GT' }    // >
| { kind: 'LTE' }   // <=
| { kind: 'GTE' }   // >=
| { kind: 'EQEQ' }  // ==
| { kind: 'NEQ' }   // !=
```

`and`, `or`, `not`, `if`, `else` remain as `IDENT` tokens — the parser recognises them by name, same as `repeat`/`on`/`def`.

Tokenisation order: `<=` and `>=` must be checked before `<` and `>` (and `==` before `=`).

---

## Parser Changes (`packages/parser/src/parser.ts`)

### New grammar rule (in `parseAtom`)

```
atom ::= ...
       | 'not' atom
       | 'if' expr 'do' stmts ('else' stmts)? 'end'
```

### `peekOp` extended

```ts
case 'LT':   return ['<',  3];
case 'GT':   return ['>',  3];
case 'LTE':  return ['<=', 3];
case 'GTE':  return ['>=', 3];
case 'EQEQ': return ['==', 3];
case 'NEQ':  return ['!=', 3];
// IDENT 'and' → prec 1, 'or' → prec 0
```

For `and`/`or`: `peekOp` checks `t.kind === 'IDENT' && t.name === 'and'` → `['and', 1]`.

Comparisons are **non-associative** at precedence 3: `a < b < c` is a parse error (rejected by Pratt because right side stops at prec ≥ 3).

### `parseAtom` additions

```ts
if (name === 'not') {
  this.advance();
  const operand = this.parseAtom(); // right-recursive, handles 'not not x'
  return { kind: 'UnaryExpr', op: 'not', operand };
}

if (name === 'if') {
  this.advance();
  const cond = this.parseExpr();
  const thenBlock = this.parseDoBlock();         // consumes 'do' ... stops at 'else'/'end'
  let elseBlock: BlockExpr | null = null;
  if (this.checkIdent('else')) {
    this.advance();
    const elseStmts = this.parseBodyUntilEnd();  // consumes stmts + 'end'
    elseBlock = { kind: 'BlockExpr', body: elseStmts };
  }
  // if no else, 'end' was already consumed by parseDoBlock
  return { kind: 'IfExpr', cond, then: thenBlock, else: elseBlock };
}
```

`parseDoBlock` currently parses `do stmts end`. For `if`, we need it to stop at `else` as well. Solution: add a variant `parseDoBlockOrElse` that returns `{ block, hadElse }`, or factor out `parseBodyUntil(stopWords)`.

Concrete approach — add a private helper:

```ts
private parseBodyUntil(stops: string[]): Stmt[] {
  const stmts: Stmt[] = [];
  while (!stops.some(s => this.checkIdent(s)) && !this.check('EOF')) {
    stmts.push(this.parseStmt());
  }
  return stmts;
}
```

Then `parseBodyUntilEnd` is refactored to call `parseBodyUntil(['end'])` + `eatIdent('end')`. The `if` parser uses `parseBodyUntil(['else', 'end'])`, peeks to check for `else`, then consumes `end` (or the else stmts + `end`).

---

## Serializer Changes (`packages/lang/src/serializer.ts`)

```ts
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

Comparison/boolean infix expressions are handled by the existing `InfixExpr` serializer case (no change needed, since they now share the same node type).

---

## Public API (`packages/lang/src/index.ts`)

Export `IfExpr` and `UnaryExpr` from the AST re-export list.

---

## Blocks (`packages/blocks/src/definitions/`)

New blocks in a new file `conditionals.ts`:

| Block name        | Kind      | Inputs / fields                                   | Colour |
|-------------------|-----------|---------------------------------------------------|--------|
| `sprout_if`       | statement | `COND` (value), `THEN` (statement), `ELSE` (statement, optional via mutator or always present) | 210 |
| `sprout_compare`  | value     | `LEFT` (value), `OP` dropdown (`<`/`>`/`<=`/`>=`/`==`/`!=`), `RIGHT` (value) | 210 |
| `sprout_not`      | value     | `OPERAND` (value) | 210 |
| `sprout_and`      | value     | `LEFT` (value), `RIGHT` (value) | 210 |
| `sprout_or`       | value     | `LEFT` (value), `RIGHT` (value) | 210 |
| `sprout_bool`     | value     | `VALUE` dropdown (`true`/`false`) | 210 |

`sprout_if` always renders both `THEN` and `ELSE` statement inputs (MVP — no mutator complexity). An unconnected `ELSE` compiles to `null`.

---

## Compiler Changes (`packages/blocks/src/compiler.ts`)

`compileStmt` — add `sprout_if` to the statement switch.

`compileExprBlock` — add `sprout_if` case:

```ts
case 'sprout_if': {
  const cond = compileExpr(mustGetInput(block, 'COND'));
  const thenFirst = block.getInputTargetBlock('THEN');
  const thenBlock = compileBlockExpr(thenFirst);
  const elseFirst = block.getInputTargetBlock('ELSE');
  const elseBlock = elseFirst !== null ? compileBlockExpr(elseFirst) : null;
  return { kind: 'IfExpr', cond, then: thenBlock, else: elseBlock };
}
```

`compileExpr` — add cases for `sprout_compare`, `sprout_not`, `sprout_and`, `sprout_or`, `sprout_bool`:

```ts
case 'sprout_compare': {
  const op = block.getFieldValue('OP') as '<' | '>' | '<=' | '>=' | '==' | '!=';
  const left = compileExpr(mustGetInput(block, 'LEFT'));
  const right = compileExpr(mustGetInput(block, 'RIGHT'));
  return { kind: 'InfixExpr', op, left, right };
}
case 'sprout_not': {
  const operand = compileExpr(mustGetInput(block, 'OPERAND'));
  return { kind: 'UnaryExpr', op: 'not', operand };
}
case 'sprout_and': {
  const left = compileExpr(mustGetInput(block, 'LEFT'));
  const right = compileExpr(mustGetInput(block, 'RIGHT'));
  return { kind: 'InfixExpr', op: 'and', left, right };
}
case 'sprout_or': {
  const left = compileExpr(mustGetInput(block, 'LEFT'));
  const right = compileExpr(mustGetInput(block, 'RIGHT'));
  return { kind: 'InfixExpr', op: 'or', left, right };
}
case 'sprout_bool': {
  const value = block.getFieldValue('VALUE') === 'true';
  return { kind: 'BoolLit', value };
}
```

---

## Testing Strategy

Each layer gets its own tests, following the existing pattern:

- **`packages/lang/tests/interpreter.test.ts`** — `if` with true/false conditions, missing else → EMPTY, `not`, `and`/`or` short-circuit, comparison operators, type errors (non-bool condition, non-number comparison)
- **`packages/lang/tests/renderer.test.ts`** — no changes (IfExpr produces a Drawing, not a new Drawing node)
- **`packages/parser/tests/parser.test.ts`** — `if`/`else` parse round-trips, comparison operators, `and`/`or`/`not`, operator precedence
- **`packages/blocks/tests/compiler.test.ts`** — `sprout_if` with and without else, `sprout_compare`, `sprout_not`, `sprout_and`/`sprout_or`, `sprout_bool`

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
| Create | `packages/blocks/src/definitions/conditionals.ts` | Register 6 new blocks |
| Modify | `packages/blocks/src/definitions/index.ts` | Call `registerConditionalBlocks()` |
| Modify | `packages/blocks/src/compiler.ts` | Compile all 6 new block types |
| Modify | `packages/lang/tests/interpreter.test.ts` | Tests for all new language features |
| Modify | `packages/parser/tests/parser.test.ts` | Tests for lexer/parser additions |
| Modify | `packages/blocks/tests/compiler.test.ts` | Tests for all new block compilations |
