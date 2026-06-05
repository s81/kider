# Lists Design Spec

## Goal

Add a `list` type to Sprout so kids can store and loop through sequences of values — colors, sizes, scores, or anything else.

## Architecture

Three-layer feature following the existing pattern:

1. **Lang layer** — new `SproutList` value type + 5 builtins (`list`, `push`, `get`, `size`, `isEmpty`) + `isDrawing` guard update
2. **Blocks layer** — 5 new Blockly value blocks + compiler cases
3. **Serializer** — `list(...)` round-trips through existing `CallExpr` serialization (no new AST node needed)

Lists are **functional / immutable**. `push` returns a new list; mutation uses the existing `set` statement pattern: `set colors = push(colors, :yellow)`.

---

## Section 1: Value type

New interface in `packages/lang/src/values.ts`:

```typescript
export interface SproutList {
  readonly kind: 'list';
  readonly items: readonly SproutValue[];
}
```

Added to the `SproutValue` union:

```typescript
export type SproutValue =
  | SproutNumber
  | SproutString
  | SproutSymbol
  | SproutBool
  | SproutFunction
  | SproutVar
  | SproutList   // NEW
  | Drawing;
```

Constructor helper exported from `values.ts`:

```typescript
export const mkList = (items: readonly SproutValue[]): SproutList =>
  ({ kind: 'list', items });
```

The `kind: 'list'` string does not clash with any existing `Drawing` variant kind (confirmed by inspection).

The `isDrawing` type guard in `interpreter.ts` does not need updating — its switch does not fall through to a default that would incorrectly match `'list'`, and a `SproutList` will correctly return `false`.

---

## Section 2: Builtins

Five new entries in the `BUILTINS` map in `packages/lang/src/interpreter.ts`:

### `list(...)`

Variadic. Zero or more arguments. Any type. Returns a `SproutList`.

```
list()           → { kind: 'list', items: [] }
list(1, 2, 3)    → { kind: 'list', items: [1, 2, 3] }
list(:red, :blue) → { kind: 'list', items: [:red, :blue] }
```

### `push(list, val)`

Takes exactly 2 arguments. First must be a `SproutList`. Returns a new `SproutList` with `val` appended at the end. Does not mutate the original.

```
push(list(1, 2), 3)  → { kind: 'list', items: [1, 2, 3] }
```

Throws `SproutRuntimeError("push expects 2 arguments, got N")` on wrong arity.
Throws `SproutRuntimeError("push: expected list, got number")` if arg 0 is not a list.

### `get(list, i)`

Takes exactly 2 arguments. First must be a `SproutList`. Second must be a `SproutNumber`. Index is **1-based**. Returns the item at position `i`.

```
get(list(10, 20, 30), 1)  → 10
get(list(10, 20, 30), 3)  → 30
```

Throws `SproutRuntimeError("get: index N is out of bounds (size M)")` when index < 1 or index > size.
Throws `SproutRuntimeError("get: expected list, got string")` if arg 0 is not a list.
Throws `SproutRuntimeError("get: expected number index, got bool")` if arg 1 is not a number.

### `size(list)`

Takes exactly 1 argument, must be a `SproutList`. Returns a `SproutNumber` — the item count.

```
size(list(1, 2, 3))  → 3
size(list())         → 0
```

Throws `SproutRuntimeError("size: expected list, got number")` if arg is not a list.

### `isEmpty(list)`

Takes exactly 1 argument, must be a `SproutList`. Returns a `SproutBool`.

```
isEmpty(list())        → true
isEmpty(list(1, 2))    → false
```

Throws `SproutRuntimeError("isEmpty: expected list, got string")` if arg is not a list.

---

## Section 3: Serializer

No new AST node is introduced — `list(...)` is a plain `CallExpr`. The existing `serializeExpr` for `CallExpr` already produces `list(arg1, arg2, ...)` correctly. No serializer changes needed.

---

## Section 4: Blockly blocks

Five new value blocks in `packages/blocks/src/definitions/values.ts`, all colour **180** (teal).

### `sprout_list`

Creates a list from up to 3 items. Value inputs VALUE_0, VALUE_1, VALUE_2 — all optional. Compiler collects the connected ones (skips `null`) and emits `list(connected...)`.

```typescript
Blockly.Blocks['sprout_list'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput().appendField('list');
    this.appendValueInput('VALUE_0').setCheck(null);
    this.appendValueInput('VALUE_1').setCheck(null);
    this.appendValueInput('VALUE_2').setCheck(null);
    this.setOutput(true, null);
    this.setInputsInline(true);
    this.setColour(180);
  },
};
```

### `sprout_push`

Returns new list with one item appended.

```typescript
Blockly.Blocks['sprout_push'] = {
  init(this: Blockly.Block) {
    this.appendValueInput('LIST').setCheck(null).appendField('push');
    this.appendValueInput('VAL').setCheck(null).appendField('+');
    this.setOutput(true, null);
    this.setInputsInline(true);
    this.setColour(180);
  },
};
```

### `sprout_get`

Returns item at 1-based index.

```typescript
Blockly.Blocks['sprout_get'] = {
  init(this: Blockly.Block) {
    this.appendValueInput('LIST').setCheck(null).appendField('get');
    this.appendValueInput('INDEX').setCheck('Number').appendField('at');
    this.setOutput(true, null);
    this.setInputsInline(true);
    this.setColour(180);
  },
};
```

### `sprout_size`

Returns number of items.

```typescript
Blockly.Blocks['sprout_size'] = {
  init(this: Blockly.Block) {
    this.appendValueInput('LIST').setCheck(null).appendField('size of');
    this.setOutput(true, 'Number');
    this.setInputsInline(true);
    this.setColour(180);
  },
};
```

### `sprout_is_empty`

Returns bool.

```typescript
Blockly.Blocks['sprout_is_empty'] = {
  init(this: Blockly.Block) {
    this.appendValueInput('LIST').setCheck(null).appendField('is');
    this.appendDummyInput().appendField('empty?');
    this.setOutput(true, 'Boolean');
    this.setInputsInline(true);
    this.setColour(180);
  },
};
```

---

## Section 5: Compiler cases

In `packages/blocks/src/compiler.ts`, inside `compileExpr`:

```typescript
case 'sprout_list': {
  const items: Expr[] = [];
  for (const key of ['VALUE_0', 'VALUE_1', 'VALUE_2']) {
    const b = block.getInputTargetBlock(key);
    if (b !== null) items.push(compileExpr(b));
  }
  return { kind: 'CallExpr', callee: 'list', args: items, block: null };
}
case 'sprout_push': {
  const lst = compileExpr(mustGetInput(block, 'LIST'));
  const val = compileExpr(mustGetInput(block, 'VAL'));
  return { kind: 'CallExpr', callee: 'push', args: [lst, val], block: null };
}
case 'sprout_get': {
  const lst = compileExpr(mustGetInput(block, 'LIST'));
  const idx = compileExpr(mustGetInput(block, 'INDEX'));
  return { kind: 'CallExpr', callee: 'get', args: [lst, idx], block: null };
}
case 'sprout_size': {
  const lst = compileExpr(mustGetInput(block, 'LIST'));
  return { kind: 'CallExpr', callee: 'size', args: [lst], block: null };
}
case 'sprout_is_empty': {
  const lst = compileExpr(mustGetInput(block, 'LIST'));
  return { kind: 'CallExpr', callee: 'isEmpty', args: [lst], block: null };
}
```

---

## Section 6: Toolbox

In `apps/ide/src/BlockWorkspace.tsx`, add a new **Lists** section before Values:

```typescript
    // Lists
    { kind: 'block', type: 'sprout_list' },
    { kind: 'block', type: 'sprout_push' },
    { kind: 'block', type: 'sprout_get' },
    { kind: 'block', type: 'sprout_size' },
    { kind: 'block', type: 'sprout_is_empty' },
```

---

## Section 7: Exports

Export `SproutList` type and `mkList` constructor from `packages/lang/src/index.ts`.

---

## What's not in scope

- `pop`, `concat`, `update(list, i, val)` — deferred
- For-each loop sugar — kids use `while` + `get` + index counter
- Type restriction on list items — heterogeneous lists are valid
- `sprout_list` with more than 3 slots — kids use `push` for longer lists
