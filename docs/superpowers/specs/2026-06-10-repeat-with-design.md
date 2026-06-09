# repeat with i — Design Spec
**Date:** 2026-06-10

## Summary

Extend `repeat N do` with an optional index variable: `repeat N with i do ... end`. The variable `i` is 0-based, making it consistent with general programming conventions. No new AST node — `RepeatExpr` gains one optional field.

---

## AST

**File:** `packages/lang/src/ast.ts`

Add `readonly item: string | null` to `RepeatExpr`:

```ts
export interface RepeatExpr {
  readonly kind: 'RepeatExpr';
  readonly count: Expr;
  readonly item: string | null;   // null = plain repeat; string = index variable name
  readonly body: BlockExpr;
}
```

All existing construction sites add `item: null`:
- `packages/blocks/src/compiler.ts` — `compileRepeatExpr`
- Any AST fixtures in `examples/`

---

## Serializer

**File:** `packages/lang/src/serializer.ts`

```ts
case 'RepeatExpr': {
  const countStr = serializeExpr(expr.count, indentLevel);
  const body = serializeBlock(expr.body, indentLevel + 1);
  const withClause = expr.item !== null ? ` with ${expr.item}` : '';
  return `repeat ${countStr}${withClause} do\n${body}\n${indent(indentLevel)}end`;
}
```

---

## Parser

**File:** `packages/parser/src/parser.ts`

After consuming the `count` expression, check for optional `with <ident>` before the `do` block:

```ts
if (name === 'repeat') {
  this.advance();
  const count = this.parseExpr();
  let item: string | null = null;
  if (this.peek()?.value === 'with') {
    this.advance(); // consume 'with'
    const identToken = this.expect('ident');
    item = identToken.value;
  }
  const body = this.parseDoBlock();
  return { kind: 'RepeatExpr', count, item, body };
}
```

`with` is parsed as a contextual keyword (not reserved) — existing programs using `with` as a variable name continue to work.

---

## Interpreter

**File:** `packages/lang/src/interpreter.ts`

`evalRepeat` already loops `for (let i = 0; i < count; i++)`. When `expr.item` is non-null, extend the child env with the index on each iteration:

```ts
function evalRepeat(expr: RepeatExpr, env: Env): Drawing {
  const countVal = assertNumber(evalExpr(expr.count, env), 'repeat count');
  const count = Math.trunc(countVal.value);
  const drawings: Drawing[] = [];
  for (let i = 0; i < count; i++) {
    const iterEnv = expr.item !== null
      ? envExtend(env, [[expr.item, { kind: 'number', value: i } satisfies SproutNumber]])
      : env;
    drawings.push(evalBlock(expr.body, iterEnv));
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}
```

Index is 0-based: `repeat 5 with i` gives `i = 0, 1, 2, 3, 4`.

The index variable is scoped to the loop body — not visible outside.

---

## Blocks

### Block definition

**File:** `packages/blocks/src/definitions/statements.ts`

New `sprout_repeat_with` block in the Control colour (same as `sprout_repeat`):

```
repeat [ COUNT ] with [ i ] do
  BODY
```

- `COUNT`: Number value input
- `i`: `FieldTextInput` defaulting to `"i"` — same pattern as `sprout_for_each`'s `ITEM` field, stored as field `'VAR'`
- `BODY`: StatementInput
- `setPreviousStatement(true)`, `setNextStatement(true)`

### Index value block

**File:** `packages/blocks/src/definitions/statements.ts` (or `variables.ts`)

New `sprout_repeat_index` value block — lets kids snap the index variable into expressions:

```
[ i ] (index)
```

- Single `FieldTextInput` defaulting to `"i"`, stored as field `'VAR'`
- Output type: Number
- Colour 120 (same as turtle state query values — read-only bound variable)
- Compiles to: `{ kind: 'Ident', name: varName }`

### Compiler

**File:** `packages/blocks/src/compiler.ts`

New `compileRepeatWithExpr`:

```ts
function compileRepeatWithExpr(block: Blockly.Block): RepeatExpr {
  const count = compileExpr(mustGetInput(block, 'COUNT'));
  const item = block.getFieldValue('VAR') as string;
  const body = compileBlockExpr(block.getInputTargetBlock('BODY'));
  return { kind: 'RepeatExpr', count, item, body };
}
```

`sprout_repeat_index` compiles to `{ kind: 'Ident', name: block.getFieldValue('VAR') }`.

### Toolbox

**File:** `apps/ide/src/BlockWorkspace.tsx`

Add `sprout_repeat_with` immediately after `sprout_repeat` in the Control section. Add `sprout_repeat_index` in the same section (or Variables section) so kids can snap it in.

---

## Testing

**File:** `packages/lang/tests/repeat-with.test.ts`

### Interpreter
1. `repeat 3 with i` — sequence of 3 drawings, index values 0, 1, 2 accessible inside body
2. `repeat 1 with i` — single iteration, i = 0
3. `repeat 0 with i` — returns EMPTY
4. Scope isolation — index variable not visible after the loop ends
5. Plain `repeat N do` (item: null) still works unchanged

### Parser
6. `repeat 5 with i do forward(i * 10) end` — parses to correct `RepeatExpr` with `item: 'i'`
7. Parser round-trip — serialize then parse gives identical AST

### Serializer
8. `item: null` → `repeat N do`
9. `item: 'i'` → `repeat N with i do`

---

## Out of scope

- Step/stride: `repeat N with i step 2` — not needed now
- Counting down — not needed now
- Blockly variable rename propagation — Sprout doesn't use Blockly's variable system; renaming the field in one block doesn't rename the other. Acceptable for now.
