# List Access Builtins — Design Spec

**Date:** 2026-06-06  
**Status:** Approved

## Summary

Add two list builtins: `at(list, index)` for index access and `range(start, end)` for generating number sequences. Both follow the existing pattern: interpreter BUILTINS entry + Blockly block definition + compiler case.

## Builtins

### `at(list, index)`

Returns the item at the given 0-based index in `list`.

- `at(list(10, 20, 30), 0)` → `10`
- `at(list(10, 20, 30), 2)` → `30`
- Throws `SproutRuntimeError` if `index` is out of bounds (< 0 or >= list length)
- Throws `SproutRuntimeError` if first arg is not a list
- Throws `SproutRuntimeError` if second arg is not a number
- Throws `SproutRuntimeError` if arg count ≠ 2

### `range(start, end)`

Returns a list of integers `[start, start+1, ..., end-1]` (exclusive end).

- `range(0, 5)` → `[0, 1, 2, 3, 4]`
- `range(3, 6)` → `[3, 4, 5]`
- `range(5, 5)` → `[]` (empty list)
- Throws `SproutRuntimeError` if either arg is not a number
- Throws `SproutRuntimeError` if `start > end`
- Throws `SproutRuntimeError` if arg count ≠ 2

## Files Changed

| File | Change |
|------|--------|
| `packages/lang/src/interpreter.ts` | Add `at` and `range` to BUILTINS map |
| `packages/lang/tests/interpreter.test.ts` | Add tests for both builtins |
| `packages/blocks/src/definitions/values.ts` | Add `sprout_at` and `sprout_range` block definitions |
| `packages/blocks/src/compiler.ts` | Add `sprout_at` and `sprout_range` compiler cases |

## No Changes Needed

- `packages/lang/src/values.ts` — these return existing `SproutList`/`SproutNumber`/`SproutValue` types
- `packages/lang/src/ast.ts` — pure builtins, no new AST nodes
- `packages/parser/` — no new syntax

## Block Shapes

- `sprout_at` — value block with two inputs: LIST and INDEX; outputs any type; colour 200
- `sprout_range` — value block with two inputs: START and END (both Number); outputs Array; colour 200
