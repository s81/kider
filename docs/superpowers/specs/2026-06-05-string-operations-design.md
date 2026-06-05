# String Operations Design

**Date:** 2026-06-05  
**Status:** Approved

## Goal

Add string manipulation builtins and operator support to Sprout so users can build dynamic text for canvas output (e.g. `text("Score: " + score, 20)`) and compare strings at runtime.

## Functions

| Call | Effect |
|---|---|
| `join(a, b, ...)` | Concatenate 0+ values as strings. Each arg auto-converts: number → `"42"`, bool → `"true"`/`"false"`, symbol → `":name"`, string → as-is. Functions and drawings throw `SproutRuntimeError`. |
| `length(str)` | Return character count of `str` as a number. Non-string arg throws `SproutRuntimeError`. |

## Operator Changes

### `+` — polymorphic concatenation

- Both operands numbers → add (unchanged)
- Either operand a string → convert both via `toStr`, concatenate
- Any other combination → `SproutRuntimeError`

```
"Score: " + 42   →  "Score: 42"
42 + " pts"      →  "42 pts"
3 + 4            →  7
"a" + true       →  "atrue"
```

### `==` / `!=` — string equality

Add `string == string` case alongside the existing number and bool cases. Mixed-type comparisons (e.g. `"x" == 42`) keep the existing behavior: throw `SproutRuntimeError`.

## Value-to-String Conversion (`toStr`)

Shared helper used by `+` and `join`:

| Input kind | Output |
|---|---|
| `string` | value as-is |
| `number` | integer if whole (`42`), decimal otherwise (`3.14`) |
| `bool` | `"true"` or `"false"` |
| `symbol` | `":name"` |
| `function` | throws `SproutRuntimeError` |
| `drawing` | throws `SproutRuntimeError` |

## Architecture

### `packages/lang/src/interpreter.ts`

**New helper** (file-local, before `evalInfix`):
```typescript
function toStr(v: SproutValue, context: string): string {
  if (v.kind === 'string') return v.value;
  if (v.kind === 'number') return String(v.value);
  if (v.kind === 'bool') return String(v.value);
  if (v.kind === 'symbol') return `:${v.name}`;
  throw new SproutRuntimeError(`${context}: cannot convert ${v.kind} to string`);
}
```

**`evalInfix` — update `+` case:**
```typescript
case '+': {
  if (left.kind === 'number' && right.kind === 'number') {
    return { kind: 'number', value: left.value + right.value };
  }
  if (left.kind === 'string' || right.kind === 'string') {
    return { kind: 'string', value: toStr(left, '+') + toStr(right, '+') };
  }
  throw new SproutRuntimeError(`+: cannot add ${left.kind} and ${right.kind}`);
}
```

Note: remove the `assertNumber` calls before the switch for `+` — the type check is now inside the case.

**`evalInfix` — update `==`/`!=` block:**
```typescript
} else if (lv.kind === 'string' && rv.kind === 'string') {
  eq = lv.value === rv.value;
}
```

**New builtins** (after `length` math builtin):
```typescript
['join', (args) => {
  return { kind: 'string', value: args.map(a => toStr(a, 'join')).join('') };
}],
['length', (args) => {
  if (args.length !== 1) throw new SproutRuntimeError(`length expects 1 argument, got ${args.length}`);
  const s = assertString(args[0], 'length');
  return { kind: 'number', value: s.value.length };
}],
```

No existing `length` builtin — the math library covers `sqrt`, `abs`, `floor`, `ceil`, `sin`, `cos`, `tan`, `log`, `pow`, `min`, `max`, `round`, `random`. Safe to add `length` for strings.

### `packages/lang/src/interpreter.ts` — `evalInfix` structure fix

Currently `assertNumber` is called unconditionally before the operator switch for arithmetic operators. The fix: move the `assertNumber` calls inside each numeric case (`-`, `*`, `/`, `<`, `>`, `<=`, `>=`) and remove the shared `assertNumber` before the switch. The `+` case handles its own type checking as above.

### `packages/blocks/src/definitions/values.ts`

Three new blocks, all colour `160`:

**`sprout_string`** — string literal reporter:
```typescript
Blockly.Blocks['sprout_string'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('"')
      .appendField(new Blockly.FieldTextInput('hello'), 'VALUE')
      .appendField('"');
    this.setOutput(true, 'String');
    this.setColour(160);
  },
};
```

**`sprout_join`** — two-value concatenation:
```typescript
Blockly.Blocks['sprout_join'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput().appendField('join');
    this.appendValueInput('A').setCheck(null);
    this.appendValueInput('B').setCheck(null);
    this.setOutput(true, 'String');
    this.setInputsInline(true);
    this.setColour(160);
  },
};
```

**`sprout_length`** — string length:
```typescript
Blockly.Blocks['sprout_length'] = {
  init(this: Blockly.Block) {
    this.appendValueInput('STR').setCheck('String').appendField('length of');
    this.setOutput(true, 'Number');
    this.setInputsInline(true);
    this.setColour(160);
  },
};
```

### `packages/blocks/src/compiler.ts`

New cases in `compileExprBlock`:
```typescript
case 'sprout_string':
  return { kind: 'StringLit', value: block.getFieldValue('VALUE') as string };

case 'sprout_join': {
  const a = compileExpr(mustGetInput(block, 'A'));
  const b = compileExpr(mustGetInput(block, 'B'));
  return { kind: 'CallExpr', callee: 'join', args: [a, b], block: null };
}

case 'sprout_length': {
  const str = compileExpr(mustGetInput(block, 'STR'));
  return { kind: 'CallExpr', callee: 'length', args: [str], block: null };
}
```

### `apps/ide/src/BlockWorkspace.tsx`

Add a **"Text"** section to the toolbox, between values and the math/logic sections:
```typescript
{ kind: 'label', text: 'Text' },
{ kind: 'block', type: 'sprout_string' },
{ kind: 'block', type: 'sprout_join' },
{ kind: 'block', type: 'sprout_length' },
```

## Testing

### `packages/lang/tests/interpreter.test.ts` — `describe('join builtin')`

- `join()` → `{ kind: 'string', value: '' }`
- `join("hello")` → `{ kind: 'string', value: 'hello' }`
- `join("Score: ", 42)` → `{ kind: 'string', value: 'Score: 42' }`
- `join(true, "!")` → `{ kind: 'string', value: 'true!' }`
- `join("a", "b", "c")` → `{ kind: 'string', value: 'abc' }`
- `join(mkFunction, ...)` → throws `SproutRuntimeError` matching `/join/`

### `packages/lang/tests/interpreter.test.ts` — `describe('length builtin')`

- `length("hello")` → `{ kind: 'number', value: 5 }`
- `length("")` → `{ kind: 'number', value: 0 }`
- `length(42)` → throws `SproutRuntimeError` matching `/length/`
- `length("a", "b")` → throws `SproutRuntimeError` (wrong arg count)

### `packages/lang/tests/interpreter.test.ts` — `describe('+ with strings')`

- `"a" + "b"` → `{ kind: 'string', value: 'ab' }`
- `"Score: " + 42` → `{ kind: 'string', value: 'Score: 42' }`
- `42 + " pts"` → `{ kind: 'string', value: '42 pts' }`
- `3 + 4` → `{ kind: 'number', value: 7 }` (unchanged)
- `"x" + true` → `{ kind: 'string', value: 'xtrue' }`

### `packages/lang/tests/interpreter.test.ts` — `describe('== for strings')`

- `"hello" == "hello"` → `{ kind: 'bool', value: true }`
- `"hello" == "world"` → `{ kind: 'bool', value: false }`
- `"hello" != "world"` → `{ kind: 'bool', value: true }`
- `"hello" == 42` → throws `SproutRuntimeError`

### `packages/blocks/tests/compiler.test.ts` — `describe('string blocks')`

- `sprout_string` (VALUE='hi') → `{ kind: 'StringLit', value: 'hi' }`
- `sprout_join` with A=string, B=number → `CallExpr { callee: 'join', args: [StringLit, NumberLit] }`
- `sprout_length` with STR=string → `CallExpr { callee: 'length', args: [StringLit] }`

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/interpreter.ts` | Add `toStr` helper; update `+` case; add string `==`; add `join` and `length` builtins |
| `packages/lang/tests/interpreter.test.ts` | Add 4 describe blocks: `join builtin`, `length builtin`, `+ with strings`, `== for strings` |
| `packages/blocks/src/definitions/values.ts` | Add `sprout_string`, `sprout_join`, `sprout_length` blocks |
| `packages/blocks/src/compiler.ts` | Add 3 `compileExprBlock` cases |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('string blocks')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add Text section to toolbox |

## Out of Scope

- `str(value)` explicit conversion builtin — implicit conversion via `join`/`+` covers this
- `contains`, `upper`, `lower`, `substring` — not needed for the current use cases
- String ordering comparisons (`<`, `>`) — not needed
- Multi-line strings
- String interpolation syntax
