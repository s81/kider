# HUD Display & Variable Inspector — Design Spec
**Date:** 2026-06-06

## Summary

Two complementary features for game-making kids:

1. **`show(label, value)`** — a new builtin that writes to a persistent HUD overlay on the canvas, survives `clearCanvas()`, lets kids display score/lives/state without fighting the turtle drawing.
2. **Variable inspector** — an IDE panel below the canvas showing all `let`-bound mutable variables and their current values after each run or event.

Both are surfaced through a new `hud` and `variables` field on the `interpretFull` / `interpretFullWithInputs` return value.

---

## Architecture

No new AST nodes, no renderer changes, no new packages. All changes in:

| File | Change |
|---|---|
| `packages/lang/src/interpreter.ts` | `_hudValues` map, `show` builtin, `hud`/`variables` on return type |
| `packages/lang/src/index.ts` | Re-export updated return types |
| `packages/lang/tests/interpreter.test.ts` | Tests for `show`, `hud`, `variables` |
| `packages/blocks/src/definitions/statements.ts` | `sprout_show` block definition |
| `packages/blocks/src/compiler.ts` | `sprout_show` compiler case |
| `apps/ide/src/BlockWorkspace.tsx` | `sprout_show` toolbox entry under "Display" |
| `apps/ide/src/Stage.tsx` | `hud` prop + overlay div |
| `apps/ide/src/App.tsx` | `hud`/`variables` state, pass to Stage + VariableInspector |
| `apps/ide/src/VariableInspector.tsx` | New component |

---

## A1: `show(label, value)` builtin

### Semantics

- `show(label, value)` — `label` must be a string (throws `SproutRuntimeError` if not); `value` can be any `SproutValue`
- Writes `label → formatValue(value)` into a module-level `Map<string, string>` called `_hudValues`
- Calling `show("Score", 5)` then `show("Score", 6)` replaces — map key is the label
- Calling `show("Score", 5)` then `show("Lives", 3)` produces two entries in insertion order
- Returns `{ kind: 'empty' }` — same as `penDown`, `background`, etc.
- `_hudValues` is cleared at the top of each `interpret*` call

### Value formatting (`formatValue`)

| Type | Format |
|---|---|
| number | its numeric value (e.g. `42`, `3.14`) |
| string | its string value |
| bool | `true` or `false` |
| list | `[n items]` |
| function | `fn` |
| symbol | `:name` |
| drawing/empty | `<drawing>` / `<empty>` |

### Blockly block

- Block id: `sprout_show`
- Two value inputs: `LABEL` (string) and `VALUE` (any)
- Statement block (no output)
- Colour: 290 (events/action palette)
- Tooltip: `'Show a value on the canvas HUD'`
- Defined in `packages/blocks/src/definitions/statements.ts`
- Toolbox entry: new **"Display"** section in `BlockWorkspace.tsx`, above or below "Events"
- Compiler case compiles to `CallExpr { callee: 'show', args: [label, value] }`

### Arity / type errors

- `show` with wrong arg count → `show expects 2 arguments, got N`
- `show` with non-string label → `show: label must be a string, got <kind>`

---

## A2: Variable inspector

### What counts as a "variable"

Only `let`-bound names introduced by `LetStmt` — not builtins, not `def`-bound function definitions. The final env after the program (or handler) runs is filtered to this set.

### Interpreter return type extension

```typescript
// Before
{ drawing: Drawing; handlers: Map<string, SproutFunction> }

// After
{
  drawing: Drawing;
  handlers: Map<string, SproutFunction>;
  hud: Record<string, string>;      // show() entries, insertion order
  variables: Record<string, string>; // let-bound vars, formatValue'd
}
```

Both `interpretFull` and `interpretFullWithInputs` gain these two fields. `interpret` and `interpretWithInputs` are unchanged (they don't return handlers today).

---

## IDE Layer

### HUD overlay (`Stage.tsx`)

- `Stage` gains `hud?: Record<string, string>` prop
- Wrapper `<div style={{ position: 'relative', display: 'inline-block' }}>`
- Overlay `<div>` absolutely positioned bottom-left, inside wrapper:
  - `position: absolute; bottom: 8px; left: 8px`
  - Background: `rgba(0,0,0,0.55)`, border-radius: 4px, padding: `4px 8px`
  - Text: `#20c997` (teal), monospace, font-size 13px
  - `pointer-events: none` — never blocks canvas clicks
- Each entry rendered as `<div>{label}: {value}</div>` in insertion order
- Hidden entirely (`null`) when `hud` is empty or undefined

### `VariableInspector.tsx`

- Props: `variables: Record<string, string>`
- Returns `null` when `variables` is empty
- Rendered below the canvas, full canvas width (500px)
- Header row: "Variables" label, muted color
- Data rows: variable name left-aligned, formatted value right-aligned
- Alternating row background for readability
- No collapse/expand toggle

### `App.tsx` changes

- Add state: `const [hud, setHud] = useState<Record<string, string>>({})` and `const [variables, setVariables] = useState<Record<string, string>>({})`
- On **Run**: destructure `{ drawing, handlers, hud, variables }` from `interpretFullWithInputs`; set all four
- On **each event handler** call: `callHandler` currently returns `Drawing`; it will be extended to return `{ drawing: Drawing; hud: Record<string, string>; variables: Record<string, string> }`. `applyHandlerDelta` is updated to accept this shape and call `setHud` / `setVariables` alongside the existing drawing accumulation.
- Pass `hud` to `<Stage hud={hud} ... />`
- Render `<VariableInspector variables={variables} />` below `<Stage>`

---

## Testing

### Lang tests (`packages/lang/tests/interpreter.test.ts`)

**`show` builtin:**
- `show("Score", 5)` — `hud` on return has `{ Score: "5" }`
- `show("Score", 5)` then `show("Score", 6)` — `hud` has `{ Score: "6" }` (replaced)
- `show("Score", 5)` then `show("Lives", 3)` — `hud` has both entries
- `show` with wrong arity throws `SproutRuntimeError`
- `show` with non-string label throws `SproutRuntimeError`
- `show` with list value formats as `[n items]`

**`variables` field:**
- After `let x = 5`, `variables` has `{ x: "5" }`
- After `let x = 5; def f() = 1`, `variables` has `{ x: "5" }` — `f` excluded
- After `let xs = list(1,2,3)`, `variables` has `{ xs: "[3 items]" }`
- Empty program → `variables` is `{}`

---

## Out of scope

- `show` with positional arguments (x, y coords) — always bottom-left overlay for now
- Watching specific variables only — inspector shows all `let`-bound vars
- Variable history / sparklines
- Clearing the HUD explicitly (use `clearCanvas` equivalent) — `_hudValues` resets on each run
