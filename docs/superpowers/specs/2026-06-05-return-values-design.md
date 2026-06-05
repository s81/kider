# Return Values Design

**Date:** 2026-06-05  
**Status:** Approved

## Goal

Allow user-defined functions to both produce drawings and return a computed value, enabling programs like:

```
def drawCircle(r) {
  circle(r)
  return r
}

let size = drawCircle(50)
forward(size)
text("diameter: " + size * 2, 20)
```

## Language Semantics

### New AST node

```typescript
export interface ReturnStmt {
  readonly kind: 'ReturnStmt';
  readonly value: Expr;
}

export type Stmt = DefStmt | ExprStmt | LetStmt | AssignStmt | ReturnStmt;
```

### Interpreter behavior

**`evalBlock`** — when it reaches a `ReturnStmt`, evaluates the value expression, then throws an internal `ReturnSignal` carrying the value and all drawings accumulated so far:

```typescript
class ReturnSignal {
  constructor(public value: SproutValue, public drawings: Drawing) {}
}
```

`ReturnSignal` is internal to `interpreter.ts` — not exported, not a `SproutValue`.

**`evalCallExpr`** — wraps `evalExpr(fn.body, childEnv)` in a try/catch. If `ReturnSignal` is caught, it packages the result into an internal bundle `{ value, drawing }`. If no `return` is hit, the result is the Drawing from `evalExpr` as before.

**Statement-level callers** unpack the bundle:

| Call site | Drawing | Value |
|---|---|---|
| `let x = f()` | added to outer block's drawing list | bound to `x` |
| `set x = f()` | added to outer block's drawing list | assigned to `x` |
| `f()` as bare statement | added to outer block's drawing list | discarded |

**Limitation:** if a value-returning function call appears inside a nested expression (e.g. `2 * drawCircle(r)`), the drawings are dropped and only the value is used. Kids must assign to a variable first:
```
let r = drawCircle(n)
let doubled = 2 * r
```

**Functions without `return`** continue to work exactly as before — no behavior change.

**`return` with no value** — not supported. Every `return` must carry an expression.

**`return` outside a function body** — `ReturnSignal` propagates uncaught and becomes a `SproutRuntimeError`.

## Text Syntax

`return` is a reserved keyword. Inside a function body it is parsed as a statement:

```
return expr
```

Parser change: in `parseStmt`, add a case for the `return` token — advance past it, parse the expression, return `ReturnStmt { kind: 'ReturnStmt', value }`.

`return` is added to the lexer's keyword list so it is never parsed as an identifier.

## Blocks

### `sprout_return` — new statement block

```typescript
Blockly.Blocks['sprout_return'] = {
  init(this: Blockly.Block) {
    this.appendValueInput('VALUE')
      .appendField('return');
    this.setPreviousStatement(true);
    // no setNextStatement — nothing follows a return
    this.setColour(/* match sprout_def colour */);
  },
};
```

### Compiler case

```typescript
case 'sprout_return': {
  const value = compileExpr(mustGetInput(block, 'VALUE'));
  return { kind: 'ReturnStmt', value };
}
```

### Toolbox

```typescript
// Functions
{ kind: 'block', type: 'sprout_def' },
{ kind: 'block', type: 'sprout_call_stmt' },
{ kind: 'block', type: 'sprout_return' },
```

## Testing

### `packages/lang/tests/interpreter.test.ts` — `describe('return statement')`

- `def double(n) { return n * 2 }` → `double(3)` → `{ kind: 'number', value: 6 }`
- `def drawAndGet(r) { circle(r); return r }` → `let x = drawAndGet(50)` → x is `{ kind: 'number', value: 50 }` and outer drawing includes `circle(50)`
- `return` with no prior drawings — returns value, outer drawing is EMPTY
- Function without `return` still produces a Drawing (no regression)
- `return` outside a function body → throws `SproutRuntimeError`
- `return` value can be string, bool, number

### `packages/blocks/tests/compiler.test.ts` — `describe('sprout_return')`

- `sprout_return` with number input → `{ kind: 'ReturnStmt', value: { kind: 'NumberLit', value: 42 } }`
- `sprout_return` with infix expression → `{ kind: 'ReturnStmt', value: InfixExpr }`

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/ast.ts` | Add `ReturnStmt` interface; add to `Stmt` union |
| `packages/lang/src/parser.ts` | Add `return` keyword; add `ReturnStmt` parse case |
| `packages/lang/src/interpreter.ts` | Add `ReturnSignal` class; update `evalBlock` to throw on `ReturnStmt`; update `evalCallExpr` to catch `ReturnSignal`; update statement-level callers in `evalStmtWithEnv` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('return statement')` |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_return` block definition |
| `packages/blocks/src/compiler.ts` | Add `sprout_return` compiler case |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('sprout_return')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_return` to Functions section of toolbox |

## Out of Scope

- `return` with no value (bare `return`) — not needed; drawing-only functions don't use `return`
- Static analysis to detect `return` outside a function at parse time
- Drawings propagating through nested expressions like `2 * drawCircle(r)`
- Multiple return paths / early return from loops
