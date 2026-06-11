# pick(list) — Random Element Design

**Date:** 2026-06-11

## Goal

`pick(list)` returns a uniformly random element of a list. The kid-friendly
companion to `random(min, max)`: `pick(["red", "blue", "gold"])` for random
colors, `pick(range(1, 6))` for dice with list semantics, random enemy
spawn points, etc.

## Language (packages/lang)

New builtin `pick`:

- Arity 1; non-1 arity → `pick expects 1 argument, got N`.
- Argument must be a list → `pick: expected list, got <kind>` (via `assertList`).
- Empty list → `pick: list is empty` (matches `first`/`last`/`pop` wording).
- Returns `lst.items[Math.floor(Math.random() * lst.items.length)]` —
  the element itself, any SproutValue kind.

No parser, serializer, AST, or renderer changes — it's a plain call.

## Blocks (packages/blocks)

- New value block `sprout_pick`: `pick from [LIST]`, output unchecked
  (element can be any kind), colour 260 (list colour, same as `sprout_first`).
- Compiler: `sprout_pick` → `CallExpr pick(LIST)` (mirrors `sprout_first`).
- Decompiler: `pick: { type: 'sprout_pick', inputs: ['LIST'] }` in
  EXPR_CALL_BLOCKS.

## IDE (apps/ide)

- Toolbox: `sprout_pick` in the Lists category next to `sprout_first`.

## Testing

- lang: returns an element of the list (run many times, all results ∈ list);
  single-element list always returns it; empty list throws; non-list throws;
  arity errors; works on mixed-kind lists.
- blocks: compile test (sprout_pick → pick call); decompiler round-trip for
  `pick(list(1, 2, 3))`.
