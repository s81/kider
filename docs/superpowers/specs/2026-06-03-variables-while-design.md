# Variables + While Loops — Design Spec

**Goal:** Add mutable variables (`let`/`set`) and `while` loops to the Sprout language, enabling programs that accumulate state across iterations.

**Architecture:** Mutable cells approach — `let x = 0` stores a `SproutVar` cell in the env; `set x = expr` mutates the cell in-place. No changes to `Env`'s type (`Map<string, SproutValue>`). `evalBlock` is updated to thread env through its statements so `let` declarations are visible to subsequent statements in the same block. `while` loops without any signature change to `evalBlock`.

**Tech Stack:** TypeScript, Vitest, Blockly (node), existing `@sprout/lang` / `@sprout/blocks` / `@sprout/parser` packages.

---

## AST Nodes

Three new nodes added to `packages/lang/src/ast.ts`:

```typescript
export interface LetStmt {
  readonly kind: 'LetStmt';
  readonly name: string;
  readonly init: Expr;
}

export interface AssignStmt {
  readonly kind: 'AssignStmt';
  readonly name: string;
  readonly value: Expr;
}

export interface WhileExpr {
  readonly kind: 'WhileExpr';
  readonly cond: Expr;
  readonly body: BlockExpr;
}
```

`LetStmt` and `AssignStmt` join the `Stmt` union. `WhileExpr` joins the `Expr` union. `WhileExpr` is used as an `ExprStmt` (same pattern as `RepeatExpr`).

---

## Values

New value type added to `packages/lang/src/values.ts`:

```typescript
export interface SproutVar {
  readonly kind: 'var';
  readonly cell: { value: SproutValue };
}
```

`SproutVar` is not a `Drawing` — it never contributes to visual output. The `cell` object is mutable by design; only `cell.value` is mutated, never the `SproutVar` wrapper itself.

---

## Interpreter Semantics

Changes to `packages/lang/src/interpreter.ts`:

**`evalBlock` — thread env through statements:**
```typescript
function evalBlock(block: BlockExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  let currentEnv = env;
  for (const stmt of block.body) {
    const [val, newEnv] = evalStmtWithEnv(stmt, currentEnv);
    currentEnv = newEnv;
    if (val !== null && isDrawing(val)) drawings.push(val);
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}
```

**`evalStmtWithEnv` — new cases:**

- `LetStmt`: evaluate `init`, wrap in `SproutVar` cell, extend env with `name → cell`, return `[null, newEnv]`.
- `AssignStmt`: look up `name` in env — must be `kind: 'var'`; mutate `cell.value`; return `[null, env]` (same env — mutation was in-place).

**`Ident` lookup — auto-dereference vars:**
```typescript
case 'Ident': {
  const val = env.get(expr.name);
  if (val === undefined) throw new SproutRuntimeError(`Unbound identifier: '${expr.name}'`);
  return val.kind === 'var' ? val.cell.value : val;
}
```

**`evalWhile`:**
```typescript
function evalWhile(expr: WhileExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  while (true) {
    const cond = evalExpr(expr.cond, env);
    if (cond.kind !== 'bool') throw new SproutRuntimeError(`while: condition must be bool, got ${cond.kind}`);
    if (!cond.value) break;
    drawings.push(evalBlock(expr.body, env));
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}
```

**Error cases:**
- `AssignStmt` on an unbound name → runtime error: `set: 'x' is not declared`
- `AssignStmt` on a non-var binding (e.g. a `def`) → runtime error: `set: 'x' is not a variable`
- `while` condition that evaluates to non-bool → runtime error

No infinite-loop guard in this phase.

---

## Syntax

No new lexer tokens. `let`, `set`, and `while` are parsed as `IDENT` tokens.

Parser changes in `packages/parser/src/parser.ts`:

**`parseStmt`** — check for `let` and `set` before falling through to `ExprStmt`:
```
let name = expr    →  LetStmt { name, init: expr }
set name = expr    →  AssignStmt { name, value: expr }
```

**`parseAtom`** — new `while` case (same pattern as `repeat`):
```
while expr do
  ...
end              →  WhileExpr { cond: expr, body: BlockExpr }
```

Serialized form:
```
let x = 0
set x = x + 1
while x < 10 do
  forward(x)
end
```

`let` and `set` serialize on a single line. `while` uses the `do...end` indented block format identical to `repeat`.

---

## Blocks

New file `packages/blocks/src/definitions/variables.ts` registers three statement-shaped blocks (previous/next connectors, no output):

| Block | Fields / Inputs | Compiles to |
|---|---|---|
| `sprout_let` | text field `NAME`, value input `INIT` | `LetStmt` |
| `sprout_set` | text field `NAME`, value input `VALUE` | `AssignStmt` |
| `sprout_while` | value input `COND`, statement input `BODY` | `ExprStmt { WhileExpr }` |

All three blocks are coloured `230` (teal — distinct from control-flow blue `210`).

Registered in `definitions/index.ts` by calling `registerVariableBlocks()`. Compiler cases added in `compiler.ts`:

- `sprout_let` → handled in `compileStmt` (returns `LetStmt` directly, not via `compileExprBlock`)
- `sprout_set` → handled in `compileStmt` (returns `AssignStmt` directly)
- `sprout_while` → handled in `compileStmt` via `compileExprBlock`, which returns a `WhileExpr`

---

## Testing

Each layer gets dedicated tests:

- **Interpreter:** `let`/`set`/`while` evaluation, var auto-deref via Ident, error on unbound set, error on non-bool while condition, canonical counting spiral pattern
- **Serializer:** `let`, `set`, `while` round-trips
- **Parser:** `let name = expr`, `set name = expr`, `while cond do...end`, `while` with comparison condition
- **Compiler (blocks):** `sprout_let`, `sprout_set`, `sprout_while` → correct AST

---

## Canonical Usage Pattern

```
let x = 0
while x < 10 do
  forward(x * 10)
  turn(36)
  set x = x + 1
end
```

`x` declared before the loop; `set` mutates it each iteration; condition auto-dereferences the cell each check.
