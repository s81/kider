# Custom Timer Interval — Design Spec

## Goal

Let kids control how fast the timer fires by writing `on timer every 500 do...end` instead of being locked to the hardcoded 200ms default.

## Architecture

Extend `OnExpr` with an optional `interval` field. The parser accepts both the old `:timer` symbol form and the new `timer every N` keyword form. The interpreter evaluates the interval at registration time and surfaces it through `interpretFull`. The IDE passes the result to `setInterval` instead of the hardcoded constant. A dedicated `sprout_on_timer` block replaces the "timer" option in `sprout_on_event` for block-mode programs.

Five-layer change: AST, interpreter, serializer, parser, blocks + IDE.

---

## Section 1: AST

`OnExpr` in `packages/lang/src/ast.ts` gains one field:

```typescript
export interface OnExpr {
  readonly kind: 'OnExpr';
  readonly event: SymbolLit;
  readonly body: BlockExpr;
  readonly interval: Expr | null;  // null = use default (200ms)
}
```

All existing `OnExpr` nodes (keydown, click, timer without interval) get `interval: null`. The field is only meaningful when `event.name === 'timer'`; the interpreter ignores it for all other events.

---

## Section 2: Parser

**File:** `packages/parser/src/parser.ts`

Two text forms both produce the same `OnExpr`:

| Syntax | `interval` |
|---|---|
| `on :timer do...end` | `null` (backward compat) |
| `on timer do...end` | `null` (new ident form, defaults to 200ms) |
| `on timer every 500 do...end` | `NumberLit(500)` |
| `on :keydown do...end` | `null` (unchanged) |
| `on :click do...end` | `null` (unchanged) |

Logic after advancing past `on`:

```
if next token is IDENT 'timer':
  advance past 'timer'
  if next token is IDENT 'every':
    advance past 'every'
    set noBlockCall = true
    interval = parseExpr()
    restore noBlockCall
  else:
    interval = null
  body = parseDoBlock()
  return OnExpr { event: SymbolLit('timer'), interval, body }
else:
  // existing symbol path: on :event do...end → interval: null
```

`timer` and `every` are plain IDENT tokens — no lexer changes. The existing `noBlockCall` flag prevents the interval expression from consuming `do` as a call-with-block argument.

---

## Section 3: Interpreter + `interpretFull`

**File:** `packages/lang/src/interpreter.ts`

`interpretFull`'s return type gains:

```typescript
timerInterval: number   // always present; 200 if no custom interval was set
```

A module-level mutable `_timerInterval: number` (initialized to 200 at the top of `interpretFull`, alongside `_hudValues`) stores the evaluated interval.

In `evalStmtWithEnv`, when registering an `OnExpr` for `:timer` with a non-null `interval`:

```typescript
if (onExpr.event.name === 'timer' && onExpr.interval !== null) {
  const val = evalExpr(onExpr.interval, env);
  if (val.kind !== 'number' || val.value <= 0) {
    throw new SproutRuntimeError(
      `on timer: interval must be a positive number, got ${
        val.kind === 'number' ? val.value : val.kind
      }`
    );
  }
  _timerInterval = val.value;
}
```

`interpretFull` reads `_timerInterval` when building its result. `interpret()` (the non-full variant) is unchanged.

`App.tsx` changes:
- Replace `TIMER_INTERVAL_MS` constant with `result.timerInterval` when calling `setInterval`
- Update status badge: `"timer active (${result.timerInterval}ms)"`

---

## Section 4: Serializer

**File:** `packages/lang/src/serializer.ts`

In the `OnExpr` case:

```typescript
case 'OnExpr': {
  if (expr.interval !== null) {
    // new form — timer with custom interval
    const intervalStr = serializeExpr(expr.interval, indentLevel);
    const body = serializeBlock(expr.body, indentLevel + 1);
    return `on timer every ${intervalStr} do\n${body}\n${indent(indentLevel)}end`;
  }
  // existing form — :symbol event
  const body = serializeBlock(expr.body, indentLevel + 1);
  return `on :${expr.event.name} do\n${body}\n${indent(indentLevel)}end`;
}
```

Non-timer events always have `interval: null`, so their output is unchanged.

---

## Section 5: Blocks + Toolbox

**Files:** `packages/blocks/src/definitions/statements.ts`, `packages/blocks/src/compiler.ts`, `apps/ide/src/BlockWorkspace.tsx`

### New block: `sprout_on_timer`

```typescript
Blockly.Blocks['sprout_on_timer'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('on timer every')
      .appendField(new Blockly.FieldNumber(200, 1), 'INTERVAL')
      .appendField('ms');
    this.appendStatementInput('BODY').appendField('do');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(65);
  },
};
```

Colour 65 (yellow-green) distinguishes it from `sprout_on_event` (teal).

### Compiler case

In `compileStmt` fall-through list (alongside `sprout_on_event`):

```typescript
case 'sprout_on_timer':
  return { kind: 'ExprStmt', expr: compileOnTimerExpr(block) };
```

New `compileOnTimerExpr` function:

```typescript
function compileOnTimerExpr(block: Blockly.Block): OnExpr {
  const interval = Number(block.getFieldValue('INTERVAL'));
  return {
    kind: 'OnExpr',
    event: { kind: 'SymbolLit', name: 'timer' },
    interval: { kind: 'NumberLit', value: interval },
    body: compileBlockExpr(block.getInputTargetBlock('BODY')),
  };
}
```

### `sprout_on_event` change

Remove `['timer', 'timer']` from the dropdown — kids use `sprout_on_timer` instead. `keydown` and `click` remain.

### Toolbox

In `BlockWorkspace.tsx`, add `sprout_on_timer` alongside `sprout_on_event` in the Events section.

---

## Section 6: Tests

### Lang — interpreter (`packages/lang/tests/interpreter.test.ts`)

- `on timer every 500 do...end` → `interpretFull` returns `timerInterval: 500`
- `on :timer do...end` (old symbol form) → `timerInterval: 200`
- `on timer do...end` (new ident form, no `every`) → `timerInterval: 200`
- interval evaluates to non-number → throws `"on timer: interval must be a positive number, got <kind>"`
- interval evaluates to `0` → throws same error
- interval evaluates to negative → throws same error
- non-timer event (`on :keydown`) with timer handler absent → `timerInterval: 200`

### Lang — serializer (`packages/lang/tests/serializer.test.ts`)

- `OnExpr` with `interval: NumberLit(500)` → `"on timer every 500 do\n  forward(10)\nend"`
- `OnExpr` with `interval: null`, event `:timer` → `"on :timer do\n  forward(10)\nend"`

### Parser (`packages/parser/tests/parser.test.ts`)

- `"on timer every 500 do\n  forward(x)\nend"` → `OnExpr { event: SymbolLit('timer'), interval: NumberLit(500), body }`
- `"on timer do\n  forward(x)\nend"` → `OnExpr { ..., interval: null }`
- `"on :timer do\n  forward(x)\nend"` → `OnExpr { ..., interval: null }` (old form still parses)

### Blocks — compiler (`packages/blocks/tests/compiler.test.ts`)

- `sprout_on_timer` block with field value `300` → `ExprStmt` wrapping `OnExpr` with `interval: NumberLit(300)`

---

## Out of scope

- Multiple simultaneous timers at different intervals
- Non-integer intervals (FieldNumber already accepts them; interpreter accepts any positive number)
- Changing the interval at runtime (interval is fixed at registration time)
- `on :keydown every N` or `on :click every N` — interval is timer-only
- Migration of existing block programs that used the "timer" option in `sprout_on_event` — they will need to switch to `sprout_on_timer`; old saved programs using the timer dropdown will break (acceptable since this is a dev-stage project with no public users)
