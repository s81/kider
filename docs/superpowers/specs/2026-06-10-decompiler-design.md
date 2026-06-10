# Decompiler Design (text → blocks)

**Date:** 2026-06-10
**Status:** Approved

## Goal

Examples currently load as text only, but blocks mode is the primary mode for
kids. A decompiler — the inverse of `compileWorkspace` — materializes a parsed
program as draggable blocks, so picking "Catch Game" from the Examples
dropdown fills the Blockly workspace instead of dumping text.

## Scope

- `packages/blocks/src/decompiler.ts`:
  `decompileProgram(ws: Blockly.Workspace, program: Program): void` plus a
  `DecompileError` class. Headless-testable (same `ws.newBlock` API the
  compiler tests use).
- IDE: the Examples dropdown tries blocks first — clear workspace, decompile,
  render, stay in blocks mode; on `DecompileError` fall back to the current
  text-mode behavior. Import/Share text stays text-mode for now (arbitrary
  user text; can adopt the decompiler later once it has mileage).

## Mapping rules

The compiler (compiler.ts) is the ground truth; the decompiler inverts each of
its cases:

- **Statements**: Let/Assign/Return/Def map to their blocks (Def with > 3
  params is a DecompileError — the block has 3 param fields). ExprStmt
  dispatches on its expression.
- **Control**: Repeat (`item` null → `sprout_repeat`, else `sprout_repeat_with`),
  Fill, If (THEN/ELSE chains), While, ForEach, On (`:timer` + numeric-literal
  interval → `sprout_on_timer`; `on timer do` with null interval materializes
  as interval 200, matching the interpreter default; other events →
  `sprout_on_event` when the event is in the dropdown).
- **Builtin calls** map to their dedicated blocks via a table (forward, turn,
  shapes, goto, wait, show, random, distance, touching, keyDown, playNote, …).
  Field-backed blocks (color, background, randomColor, playNote, keyDown,
  on-event) are used only when the argument is the right literal kind AND its
  value is one of the dropdown's options; otherwise fall through to the
  generic path.
- **Generic fallback**: any other call with ≤ 2 args becomes
  `sprout_call_stmt` / `sprout_call_expr` (which compile back to the identical
  CallExpr). A call with > 2 args and no dedicated block is a DecompileError.
- **Expressions**: literals/idents map to their value blocks; InfixExpr to
  `sprout_infix` / `sprout_compare` / `sprout_and` / `sprout_or`;
  `not` to `sprout_not`; unary minus folds into a negative `sprout_number`
  when the operand is a number literal, else becomes `0 - x` via
  `sprout_infix`. A bare SymbolLit outside a field-backed position has no
  block — DecompileError.
- `list(...)` with > 3 items is a DecompileError (the block has 3 sockets).

## Correctness criterion

Round-trip equivalence through the serializer:

```
serialize(compileWorkspace(decompiled)) === serialize(parse(source))
```

Serializer-level (not AST-deep-equality) because the decompiler may normalize
representation without changing meaning (e.g. `-200` as UnaryExpr vs. a
negative NumberLit, `on timer do` gaining the default interval — the latter
compared after one normalizing round).

## Testing

- blocks (`tests/decompiler.test.ts`, with `@sprout/parser` as a new
  devDependency to author cases as text): round-trips covering every example
  program's constructs — repeat, fill + color, negative numbers, playNote
  melody, and a catch-game program (let/set, on timer, if, keyDown, touching,
  show, stopTimer); generic-fallback round-trip for an unknown callee; def
  with params; DecompileError for a 3-arg unknown call.
- ide (`tests/examples.test.ts` additions): every gallery example decompiles
  and round-trips — the gallery guarantee, end to end.
