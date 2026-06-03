# Math Builtins Design

**Date:** 2026-06-03
**Status:** Approved

## Goal

Add 15 math functions as interpreter builtins and Blockly value blocks, enabling programs like spirals, waves, and generative art.

## Function Set

| Function | Signature | Returns | Notes |
|---|---|---|---|
| `sin` | `sin(x)` | number | x in degrees |
| `cos` | `cos(x)` | number | x in degrees |
| `tan` | `tan(x)` | number | x in degrees |
| `abs` | `abs(x)` | number | absolute value |
| `sqrt` | `sqrt(x)` | number | square root |
| `pow` | `pow(base, exp)` | number | base^exp |
| `mod` | `mod(a, b)` | number | a % b |
| `log` | `log(x)` | number | natural log |
| `floor` | `floor(x)` | number | round down |
| `ceil` | `ceil(x)` | number | round up |
| `round` | `round(x)` | number | round to nearest |
| `max` | `max(a, b)` | number | larger of two |
| `min` | `min(a, b)` | number | smaller of two |
| `random` | `random(n)` | number | float in [0, n) |
| `pi` | `pi()` | number | 3.14159… |

Trig functions use **degrees** (not radians), consistent with `turn(90)`.

## Architecture

No AST, serializer, or parser changes. Math functions are `CallExpr` nodes — the parser already handles arbitrary function calls by name.

### `packages/lang/src/interpreter.ts`

Add 15 entries to the base env (the `Map` already containing `forward`, `turn`, etc.). All return `{ kind: 'number', value: ... } satisfies SproutNumber`.

Implementations:
- `sin(x)`: `Math.sin(x * Math.PI / 180)`
- `cos(x)`: `Math.cos(x * Math.PI / 180)`
- `tan(x)`: `Math.tan(x * Math.PI / 180)`
- `abs(x)`: `Math.abs(x)`
- `sqrt(x)`: `Math.sqrt(x)`
- `pow(base, exp)`: `Math.pow(base, exp)`
- `mod(a, b)`: `a % b` (follows JS semantics: sign matches dividend, e.g. `mod(-7, 3) = -1`)
- `log(x)`: `Math.log(x)`
- `floor(x)`: `Math.floor(x)`
- `ceil(x)`: `Math.ceil(x)`
- `round(x)`: `Math.round(x)`
- `max(a, b)`: `Math.max(a, b)`
- `min(a, b)`: `Math.min(a, b)`
- `random(n)`: `Math.random() * n`
- `pi()`: `Math.PI`

Each builtin validates arity (throws `SproutRuntimeError` on wrong arg count) and asserts all args are numbers via the existing `assertNumber` helper.

### `packages/blocks/src/definitions/math.ts` (new file)

`registerMathBlocks()` registers all 15 Blockly value blocks. Naming convention: `sprout_<name>` (e.g. `sprout_sin`, `sprout_pow`, `sprout_pi`).

- 1-arg blocks (`sin`, `cos`, `tan`, `abs`, `sqrt`, `log`, `floor`, `ceil`, `round`, `random`): one `appendValueInput('X')` with `setCheck(null)`
- 2-arg blocks (`pow`, `mod`, `max`, `min`): inputs named `A` and `B`
- 0-arg block (`pi`): no inputs, just `appendDummyInput().appendField('pi')`

All blocks: `this.setOutput(true, null)`, colour `230` (matching variables/math convention).

### `packages/blocks/src/definitions/index.ts`

Import and call `registerMathBlocks()` inside `registerAllBlocks()`.

### `packages/blocks/src/compiler.ts`

Add all 15 block types to `compileExpr`. Pattern:

- 1-arg: `{ kind: 'CallExpr', callee: 'sin', args: [compileExpr(mustGetInput(block, 'X'))], block: null }`
- 2-arg: args `[compileExpr(mustGetInput(block, 'A')), compileExpr(mustGetInput(block, 'B'))]`
- 0-arg (`pi`): `{ kind: 'CallExpr', callee: 'pi', args: [], block: null }`

### `apps/ide/src/BlockWorkspace.tsx`

Add a "Math" section to the toolbox between "Values" and "Output":

```typescript
// Math
{ kind: 'block', type: 'sprout_sin' },
{ kind: 'block', type: 'sprout_cos' },
{ kind: 'block', type: 'sprout_tan' },
{ kind: 'block', type: 'sprout_abs' },
{ kind: 'block', type: 'sprout_sqrt' },
{ kind: 'block', type: 'sprout_pow' },
{ kind: 'block', type: 'sprout_mod' },
{ kind: 'block', type: 'sprout_log' },
{ kind: 'block', type: 'sprout_floor' },
{ kind: 'block', type: 'sprout_ceil' },
{ kind: 'block', type: 'sprout_round' },
{ kind: 'block', type: 'sprout_max' },
{ kind: 'block', type: 'sprout_min' },
{ kind: 'block', type: 'sprout_random' },
{ kind: 'block', type: 'sprout_pi' },
```

## Testing

### Interpreter tests (`packages/lang/tests/interpreter.test.ts`)

One `describe('math builtins')` block with:

- Correct values: `sin(90) ≈ 1`, `cos(0) = 1`, `tan(45) ≈ 1`, `abs(-5) = 5`, `sqrt(4) = 2`, `pow(2, 3) = 8`, `mod(7, 3) = 1`, `log(1) = 0`, `floor(3.7) = 3`, `ceil(3.2) = 4`, `round(3.5) = 4`, `max(3, 7) = 7`, `min(3, 7) = 3`, `random(0) = 0`, `pi() ≈ 3.14159`
- Arity errors: each function called with wrong arg count throws `SproutRuntimeError`
- Edge cases: `sqrt(0) = 0`, `abs(0) = 0`, `floor(-1.5) = -2`, `ceil(-1.5) = -1`

### Compiler tests (`packages/blocks/tests/compiler.test.ts`)

One test per block type confirming it compiles to a `CallExpr` with the correct callee and arg count.

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/interpreter.ts` | Add 15 builtin entries to base env |
| `packages/blocks/src/definitions/math.ts` | New — register 15 Blockly value blocks |
| `packages/blocks/src/definitions/index.ts` | Import + call `registerMathBlocks()` |
| `packages/blocks/src/compiler.ts` | Add 15 cases to `compileExpr` |
| `apps/ide/src/BlockWorkspace.tsx` | Add Math section to toolbox |

## Out of Scope

- `atan2`, `log2`, `log10`, `hypot` — not in the agreed set
- Degrees/radians toggle — degrees only, consistent with turtle
- Math blocks as statement blocks — these are value-returning expressions only
