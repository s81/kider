# Else If Chains — Design Spec

## Goal

Let kids write multi-branch conditionals using `else if` without nesting extra `end` keywords:

```
if x > 10 do
  forward(10)
else if x > 5 do
  forward(5)
else
  forward(1)
end
```

## Architecture

`else if` is syntactic sugar — no AST change. The parser detects `else if` and represents it as a nested `IfExpr` inside the else `BlockExpr`. The serializer flattens that pattern back to `else if` form when round-tripping. The interpreter is unchanged; it already evaluates nested `IfExpr` nodes through the existing else-block path.

Text mode only. Blocks mode out of scope (nesting `sprout_if` inside ELSE already works there).

Three-layer change: parser, serializer, tests.

---

## Section 1: Parser

**File:** `packages/parser/src/parser.ts`

After eating `else`, check whether the next token is ident `if`. If it is, parse the inner `if` recursively — it consumes its own `end` — wrap the result in a single-statement `BlockExpr`, and return early (skipping the outer `eatIdent('end')`). If it isn't, fall through to the existing else handling unchanged.

```typescript
if (this.checkIdent('else')) {
  this.advance();                     // consume 'else'
  if (this.checkIdent('if')) {        // else if branch
    const innerIf = this.parseExpr(); // parses if...end, consumes its 'end'
    elseBlock = {
      kind: 'BlockExpr',
      body: [{ kind: 'ExprStmt', expr: innerIf }],
    };
    return { kind: 'IfExpr', cond, then: thenBlock, else: elseBlock } satisfies IfExpr;
    // early return: outer 'end' was already consumed by the recursive call
  }
  const elseStmts = this.parseBodyUntil(['end']);
  elseBlock = { kind: 'BlockExpr', body: elseStmts };
}
this.eatIdent('end');
```

Chains of any length are handled by recursion — each `else if` recurses, and the single `end` in the source closes the innermost branch, which unwinds the stack naturally.

---

## Section 2: Serializer

**File:** `packages/lang/src/serializer.ts`

Replace the `IfExpr` case with a call to a private helper that serializes the chain recursively, substituting `else if` for `if` at each nested level:

```typescript
function serializeIfChain(expr: IfExpr, indentLevel: number, keyword: 'if' | 'else if'): string {
  const ind = indent(indentLevel);
  const condStr = serializeExpr(expr.cond, indentLevel);
  const thenStr = serializeBlock(expr.then, indentLevel + 1);

  if (expr.else === null) {
    return `${keyword} ${condStr} do\n${thenStr}\n${ind}end`;
  }

  const elseBody = expr.else.body;
  if (
    elseBody.length === 1 &&
    elseBody[0].kind === 'ExprStmt' &&
    elseBody[0].expr.kind === 'IfExpr'
  ) {
    const inner = serializeIfChain(elseBody[0].expr, indentLevel, 'else if');
    return `${keyword} ${condStr} do\n${thenStr}\n${ind}${inner}`;
  }

  const elseStr = serializeBlock(expr.else, indentLevel + 1);
  return `${keyword} ${condStr} do\n${thenStr}\n${ind}else\n${elseStr}\n${ind}end`;
}

// In serializeExpr switch:
case 'IfExpr':
  return serializeIfChain(expr, indentLevel, 'if');
```

---

## Section 3: Interpreter

No change. The interpreter already handles `else: BlockExpr | null` — if the else block contains a single `ExprStmt(IfExpr)`, it evaluates that block, which evaluates the inner `IfExpr`, which evaluates its own else, and so on.

---

## Section 4: Tests

### Parser (`packages/parser/tests/parser.test.ts`)

- `"if x > 10 do\n  forward(10)\nelse if x > 5 do\n  forward(5)\nend"` → outer `IfExpr` with `else` containing one `ExprStmt(IfExpr { cond: x > 5, else: null })`
- Three-branch chain → two levels of nesting in the AST
- `"if x do\n  forward(1)\nelse\n  forward(2)\nend"` → existing two-branch form still parses (regression guard)

### Serializer (`packages/lang/tests/serializer.test.ts`)

- Two-branch chain (nested `IfExpr` in else) → flattened `else if` output, single `end`
- Three-branch chain → both levels flattened, single `end`
- Regular `if/else` with non-`IfExpr` else body → output unchanged

### Interpreter (`packages/lang/tests/interpreter.test.ts`)

- Three-branch chain, first condition true → first body runs
- Three-branch chain, middle condition true → middle body runs
- Three-branch chain, no conditions true → else body runs

---

## Out of Scope

- `else if` in blocks mode — nesting `sprout_if` inside ELSE already works; no new block needed
- `else if` without a final `else` — supported naturally (innermost `IfExpr` can have `else: null`)
- `on :keydown`, `on :click`, or other non-`if` constructs — unaffected
