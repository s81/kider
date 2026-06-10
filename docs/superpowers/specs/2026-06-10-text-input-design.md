# Text Input Design (textInput)

**Date:** 2026-06-10
**Status:** Approved

## Goal

String inputs for personalized programs — the classic "What's your name?":

```
let name = textInput("name")
text(join("Hello ", name), 30)
```

`input("speed")` already gives kids a number field in the IDE's input panel;
`textInput("name")` is its string twin and renders a text field in the same
panel.

## Semantics

- `textInput(name)` — exactly 1 argument, a string naming the field. Returns
  the string the user typed in the panel; `""` when unset (mirrors `input()`
  returning 0 when unset).
- AST scan `collectTextInputNames(program)` finds `textInput("literal")` calls
  in document order, deduplicated — the existing `collectInputNames` walker is
  generalized over the callee name and both become thin wrappers.
- Host supplies values via `setTextInputs(map)` (the `setKeyState` /
  `setMousePosition` host-setter pattern) — avoids growing the
  `interpretFullWithInputs` signature.

## Pieces

- **lang**: `_textInputValues` module state + `setTextInputs` export;
  `textInput` builtin; `collectTextInputNames`; exports from the index.
- **blocks**: `sprout_text_input` value block — "answer [NAME]" with a text
  field, String output, same colour as `sprout_input`. Compiler case emits
  `CallExpr textInput [StringLit name]`; decompiler maps it back (the same
  special case `input` has).
- **ide**: scan for text-input names alongside number inputs; render text
  fields in the same Inputs panel; call `setTextInputs` before each run.
  Toolbox: `sprout_text_input` next to `sprout_input`.

## Testing

- lang: returns the set value; `""` default; re-set values replace; arity and
  type errors; `collectTextInputNames` finds names in order, dedupes, and
  ignores non-literal args; `collectInputNames` still works after the
  refactor (existing tests).
- blocks: compile + decompiler round-trip of a `textInput` program.
- ide: none beyond the existing pattern (the panel is untested UI, same as
  number inputs).
