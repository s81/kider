# Running-Line Highlight — Design Spec

**Date:** 2026-06-12
**Status:** Approved, ready for implementation planning

## Goal

In **Animate mode** in the text editor, highlight the source line of the command currently being drawn, as the drawing reveals. Loops light up per-iteration. Text/editor mode only.

This is a v1 scoped to the **main program drawing**. Timer / loop-forever / event-handler highlighting and blocks-mode highlighting are explicitly out of scope.

## Tech stack

TypeScript, CodeMirror 6, React 19, Vitest (node environment — pure logic tested headlessly with `EditorState.create`, like `apps/ide/tests/sprout-lint.test.ts`).

## Background: why this needs line threading

`Drawing` (`packages/lang/src/values.ts:64`) is a **tree** value type whose composition nodes (`beside`/`above`/`scale`) rearrange geometry; `render()` (`packages/lang/src/renderer.ts`) linearizes it into `CanvasCommand[]` via a turtle walk. Neither type carries a source line, so there is no statement→command mapping to exploit — it must be threaded through. The IDE already calls `render(drawing)` and hands the resulting `commands` to `Stage`, and `Stage`'s animation reveals `commands[0..step]`, so once a command carries a `line`, the IDE has everything it needs.

Only `CallExpr` and `Ident` AST nodes carry `line` (`packages/lang/src/ast.ts`), and only in text mode. Block-built ASTs have no lines → commands carry no line → no highlight (correct; blocks mode shows read-only generated code, not an editable buffer).

---

## Part 1 — Lang: thread source lines onto commands

### 1.1 `Drawing` carries an optional line (one structural edit)

In `packages/lang/src/values.ts`, rename the current `Drawing` union to `DrawingNode` and define:

```ts
export type Drawing = DrawingNode & { readonly line?: number };
```

Intersecting a union with `{ readonly line?: number }` distributes across all members, so **every** `Drawing` node gains an optional `line` while keeping its `kind` discriminant (narrowing on `.kind` is unaffected). This is a single edit instead of touching ~22 variants, and it is purely additive — existing construction sites and exhaustive switches compile unchanged.

### 1.2 `tagLines` helper

Add to `values.ts` (next to the `mk*` constructors):

```ts
/**
 * Stamp `line` onto every node of a drawing that doesn't already carry one.
 * Innermost tag wins: an already-tagged subtree (from a nested statement) is
 * returned untouched. Used by the interpreter to attribute a statement's
 * drawing output to its source line.
 */
export function tagLines(d: Drawing, line: number): Drawing {
  if (d.line !== undefined) return d;
  switch (d.kind) {
    case 'sequence': return { ...d, line, steps: d.steps.map(s => tagLines(s, line)) };
    case 'beside':   return { ...d, line, left: tagLines(d.left, line), right: tagLines(d.right, line) };
    case 'above':    return { ...d, line, top: tagLines(d.top, line), bottom: tagLines(d.bottom, line) };
    case 'scale':    return { ...d, line, drawing: tagLines(d.drawing, line) };
    case 'fillPath': return { ...d, line, drawing: tagLines(d.drawing, line) };
    default:         return { ...d, line };
  }
}
```

### 1.3 Interpreter tags each statement's drawing

`packages/lang/src/interpreter.ts` accumulates `Drawing` values in two loops — `evalBlock` (bodies, ~line 1197) and `interpret` (top-level, ~line 1521). Add a helper and tag at both push-sites:

```ts
function stmtLine(stmt: Stmt): number | undefined {
  if (stmt.kind === 'ExprStmt' && (stmt.expr.kind === 'CallExpr' || stmt.expr.kind === 'Ident')) {
    return stmt.expr.line;
  }
  return undefined;
}
```

At each site that currently does `drawings.push(val)` for a drawing value:

```ts
const line = stmtLine(stmt);
drawings.push(line !== undefined ? tagLines(val, line) : val);
```

Because loop and function bodies re-evaluate their statements through `evalBlock` each iteration, every iteration's primitives carry that body statement's line → per-iteration highlighting falls out for free. Block-mode ASTs have no `line` → `stmtLine` returns `undefined` → drawings stay untagged.

### 1.4 `render()` copies the line onto emitted commands

In `packages/lang/src/renderer.ts`:

- Add `readonly line?: number` to the `CanvasCommand` union (a single optional field, undefined by default).
- At each command-emitting case in `render()`, add `line: d.line` to the emitted command object.
- `scaleDrawing` rebuilds nodes with fresh object literals (e.g. `{ kind: 'forward', distance: d.distance * factor }`) — change these to spread (`{ ...d, distance: d.distance * factor }`) so the `line` is preserved through `scale`.

**Known limitation:** primitives that emit no canvas command — notably `turn` (it only rotates turtle state) and `empty` — cannot be highlighted, because there is no revealed command to sync to. The highlight follows drawing output. (`forward`, `circle`, `rect`, `goto`, `home`, `penUp/Down`, `color`, `penWidth`, `stamp`, `hideTurtle/showTurtle`, etc. all emit commands and do highlight.)

---

## Part 2 — IDE: highlight the active line

### 2.1 `Stage` reports the active line

In `apps/ide/src/Stage.tsx`, add a prop `onActiveLine?: (line: number | null) => void` and a `lastLine` ref. Fire it from the reveal paths:

- **Animated `tick`:** after advancing `step`, `const line = commands[step - 1]?.line; if (line !== undefined) { lastLine.current = line; onActiveLine?.(line); }` — only update when the just-drawn command has a line, so no-command/line-less steps keep the previous highlight (no flicker).
- **`drawLimit` branch** (wait/sound playback): same lookup using `drawLimit`.
- **Static full-draw branch** and **on animation completion / effect cleanup:** `onActiveLine?.(null)` to clear.

`Stage` owns the index→line lookup, so the IDE never threads command indices through React.

### 2.2 App wires it straight to the editor (no per-frame re-render)

In `apps/ide/src/App.tsx`, pass a stable callback that imperatively updates the editor, bypassing React state so animation frames don't re-render the whole app:

```tsx
<Stage ... onActiveLine={(line) => editorRef.current?.highlightLine(line)} />
```

### 2.3 `TextPanel` gains a highlight decoration

Extend `EditorHandle` (`apps/ide/src/TextPanel.tsx`):

```ts
export interface EditorHandle {
  jumpToLine(line: number): void;
  highlightLine(line: number | null): void;
}
```

Implement with a CodeMirror line decoration driven by a `StateField` + `StateEffect` (a self-contained module `apps/ide/src/run-line-highlight.ts`):

- `setActiveLine` — a `StateEffect<number | null>`.
- `activeLineField` — a `StateField<DecorationSet>` that, on `setActiveLine(n)`, produces a single line decoration (`Decoration.line({ attributes: { class: 'cm-activeRunLine' } })`) at `state.doc.line(clamp(n))`; on `setActiveLine(null)`, produces `Decoration.none`.
- Theme rule `.cm-activeRunLine { background: rgba(255, 213, 0, 0.18) }` (soft amber, debugger-style), added to `EDITOR_THEME`.
- `highlightLine(line)` dispatches `setActiveLine(line)`.

The field + effect are added to the editor's extensions. Clamping reuses the same 1-based logic as `lineToPos`.

---

## Components & boundaries

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `tagLines` (`values.ts`) | Stamp a line onto an untagged drawing subtree | `Drawing` |
| `stmtLine` + tagging (`interpreter.ts`) | Attribute each statement's drawing to its line | `tagLines`, AST |
| `render` line copy (`renderer.ts`) | Carry `Drawing.line` onto `CanvasCommand.line` | `Drawing`, `CanvasCommand` |
| `Stage.onActiveLine` (`Stage.tsx`) | Map the revealing command index → its line | `CanvasCommand.line` |
| `run-line-highlight.ts` | CodeMirror decoration for the active line | `@codemirror/state`, `/view` |
| `EditorHandle.highlightLine` (`TextPanel.tsx`) | Imperative entry to set/clear the decoration | `run-line-highlight.ts` |

## Testing

**Lang (headless, `packages/lang/tests/`):**
- `tagLines`: tags an untagged `circle` node; recurses into `beside`/`sequence` leaves; leaves an already-tagged subtree untouched (innermost wins).
- `render`: a line-tagged `forward`/`circle` Drawing emits commands carrying that `line`; an untagged Drawing emits commands with `line === undefined`.
- End-to-end: `interpret(parse("circle(20)\nforward(50)"))` → `render` → the circle's command carries line 1, the forward's carries line 2.
- Loop: `repeat 2 do forward(10) end` (forward on line N) → every emitted forward command carries line N.
- `scale(2, <line-tagged forward>)` preserves the line through `scaleDrawing`.

**IDE (headless, `apps/ide/tests/`):**
- `run-line-highlight`: on an `EditorState` with the field, dispatching `setActiveLine(2)` yields a decoration on line 2's range; `setActiveLine(null)` yields an empty set; out-of-range line clamps.
- The `Stage` rAF firing and the visual decoration are covered by manual QA (canvas + animation frames aren't unit-testable in the node env).

## Verification

- `npm test` green, including the new lang and `run-line-highlight` suites; the existing 1036 stay green (every type change is an undefined-by-default optional field).
- IDE production build succeeds.
- Manual: in the editor, enable **Animate**, run a multi-line drawing (e.g. `circle(20)` / `forward(50)` / `rect(10,30)` on separate lines) → the amber highlight steps down the lines as each shape draws; a `repeat` body line stays lit while it iterates; the highlight clears when the drawing finishes; blocks mode shows no highlight.

## Out of scope (deferred)

- Timer / loop-forever / event-handler highlighting (no reveal timeline; runs to completion per tick).
- Highlighting `turn` and other no-command statements.
- Blocks-mode highlighting.

## Self-review

- **Placeholders:** none.
- **Consistency:** every lang type change is an optional field, so the 1036 existing tests are unaffected; the IDE highlight is additive and imperative (no per-frame React re-render). `EditorHandle` extends the one shipped for click-to-jump.
- **Scope:** single implementation plan — Part 1 (lang threading) then Part 2 (IDE decoration), each independently testable.
- **Ambiguity:** missing-line steps keep the previous highlight; completion/static clears it; `turn`-style no-command lines are explicitly un-highlighted. All resolved.
