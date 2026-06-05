# Number Input Design Spec

## Goal

Let Sprout programs read numbers typed by the user before the program runs, via an `input("name")` builtin and a matching IDE input panel.

## Architecture

The feature has three layers:

1. **Lang layer** — `input("name")` builtin + `collectInputNames` AST utility + `interpretWithInputs` entry point
2. **IDE layer** — dynamic input panel above the canvas that renders fields discovered by `collectInputNames`
3. **Glue** — IDE calls `interpretWithInputs` instead of `interpret`, passing current field values

---

## Section 1: Language semantics

### `input("name")` builtin

- Takes exactly one argument: a `StringLit` name.
- Returns a `NumberVal` — the value the user typed in the matching IDE field before pressing Run.
- If the field is empty, missing, or contains non-numeric text, returns `0`.
- Duplicate calls with the same name within one run all return the same value (looked up once from the input map).
- Calling `input` with a non-string-literal argument (e.g. a variable) is a runtime error: `input() argument must be a string literal`.

### `collectInputNames(program: Program): string[]`

New exported function in `packages/lang/src/interpreter.ts`.

- Walks the full AST looking for `CallExpr` nodes where `fn` is `'input'` and the first argument is a `StringLit`.
- Returns deduplicated names in order of first appearance.
- Names from nested function bodies are included.
- Returns `[]` if no `input(...)` calls exist.

### `interpretWithInputs(program: Program, inputs: Map<string, number>): Drawing`

New exported function alongside `interpret`.

- Identical to `interpret` but threads `inputs` through to the `input` builtin handler.
- `interpret` remains unchanged — programs without inputs continue to work as before.

### `interpret` (existing)

No change. Programs that don't call `input` are unaffected.

---

## Section 2: IDE input panel

- Located between the toolbar and the canvas.
- Rendered only when `collectInputNames` returns a non-empty list for the current program.
- Each distinct name gets one labeled `<input type="number">` field, in order of first appearance.
- Field labels are the raw name strings (e.g. `"speed"` → label `speed`).
- Field values persist between runs (React state, keyed by name).
- When the program changes:
  - New names → new fields added with default value `0`.
  - Removed names → fields removed; their stored values are discarded.
  - Renamed names → treated as remove + add.
- The panel has no submit button — values are read at Run time.

---

## Section 3: Data flow

1. User edits the program (text or blocks).
2. IDE re-runs `collectInputNames` on every program change to keep the panel in sync.
3. User fills in the input fields (or leaves them at their defaults).
4. User clicks **Run**.
5. IDE reads current field values → builds `Map<string, number>`.
6. IDE calls `interpretWithInputs(program, inputMap)` instead of `interpret(program)`.
7. Interpreter's `input` builtin looks up the name in the map. Missing key → `0`.
8. Drawing is rendered to canvas as normal.

---

## What's not in scope

- String inputs (only numbers).
- Runtime input prompts / mid-program dialogs.
- Validation UI (non-numeric input silently becomes `0`).
- Input from blocks other than `input("literal-name")` (variable names not supported).
