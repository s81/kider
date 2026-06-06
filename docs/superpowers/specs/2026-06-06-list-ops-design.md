# List Operations — Design Spec
**Date:** 2026-06-06
**Branch:** worktree-bridge-cse_014bGuSpnPXD2gQbPFw7Ldv8

## Summary

Two parallel tracks:
1. Wire five already-implemented list operations into the IDE toolbox.
2. Add six new list operations (five new builtins + one overload extension).

---

## Track 1 — Toolbox wiring

Five blocks exist in `packages/blocks/src/definitions/values.ts` and `compiler.ts` but are absent from the IDE toolbox in `apps/ide/src/BlockWorkspace.tsx`:

| Block | Builtin |
|---|---|
| `sprout_at` | `at(list, index)` — 0-based access |
| `sprout_range` | `range(start, end)` — integer list |
| `sprout_map` | `map(list, fn)` — transform each item |
| `sprout_filter` | `filter(list, fn)` — keep matching items |
| `sprout_reduce` | `reduce(list, fn, init)` — fold to single value |

No code changes required — only `BlockWorkspace.tsx` is modified.

---

## Track 2 — New operations

### Builtins

| Function | Signature | Semantics |
|---|---|---|
| `first` | `first(list)` | Returns `list.items[0]`; throws if empty |
| `last` | `last(list)` | Returns `list.items[list.items.length - 1]`; throws if empty |
| `pop` | `pop(list)` | Returns new list with last item removed; throws if empty |
| `concat` | `concat(list1, list2)` | Returns new list joining both; both args must be lists |
| `reverse` | `reverse(list)` | Returns new list in reversed order |
| `contains` | `contains(list_or_str, item_or_substr)` | Overloads existing string builtin; if first arg is a list, checks membership using structural equality over primitives (number, string, bool, symbol); throws if item type is drawing, function, or list |

### `contains` overload detail

The existing string implementation is untouched. At the top of the builtin handler, branch on `args[0].kind`:
- `'string'` → existing substring logic
- `'list'` → membership check with structural equality
- anything else → throw `contains: expected string or list, got <kind>`

Structural equality for list membership:
- `number`: value equality
- `string`: value equality
- `bool`: value equality
- `symbol`: name equality
- `drawing`, `function`, `list`: throw `contains: cannot compare items of type <kind>`

### Immutability

All new operations return new `SproutList` values. No mutation. Consistent with `push`, `filter`, `map`, etc.

---

## Implementation touches per operation

Each new builtin requires changes in four places:

1. **`packages/lang/src/interpreter.ts`** — add to `BUILTINS` map (or inline handler for `contains`)
2. **`packages/blocks/src/definitions/values.ts`** — add Blockly block definition (colour 180)
3. **`packages/blocks/src/compiler.ts`** — add compiler case in `compileValueBlock`
4. **`apps/ide/src/BlockWorkspace.tsx`** — add toolbox entry

### Final toolbox order (Lists section)

```
// Create
sprout_list, sprout_range
// Access
sprout_at, sprout_get, sprout_first, sprout_last
// Query
sprout_size, sprout_is_empty, sprout_contains
// Modify
sprout_push, sprout_pop, sprout_concat, sprout_reverse
// Transform
sprout_map, sprout_filter, sprout_reduce
```

---

## Testing

All tests in `packages/lang/tests/`.

For each new builtin: happy path, empty-list error (where applicable), wrong-type error.

For `contains`: separate test groups for the list path and the string path (regression).

Existing list tests must continue to pass unchanged.

---

## Out of scope

- `indexOf`, `slice`, `sort` — deferred
- Nested list equality in `contains` — throws, not silently false
- Parser changes — text panel remains read-only
