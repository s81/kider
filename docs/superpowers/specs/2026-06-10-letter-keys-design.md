# Letter Keys Design (two-player controls)

**Date:** 2026-06-10
**Status:** Approved

## Goal

Two-player games: player 1 on the arrow keys, player 2 on WASD.
`keyDown` currently accepts only `left/right/up/down/space`; this extends it
to the letters `a`–`z`:

```
if keyDown(:w) do set y2 = y2 - 5 end
if keyDown(:up) do set y1 = y1 - 5 end
```

## Design

- **lang**: `keyDown` accepts the existing five names plus any single letter
  `a`–`z`. The unknown-key error becomes
  `keyDown: unknown key 'banana' (expected left, right, up, down, space, or a letter a-z)`.
- **ide**: the key listener maps letter KeyboardEvent keys (normalized to
  lowercase, so held Shift doesn't break tracking) into `setKeyState`, in
  addition to the arrow/space map. `on :a do ... end` handlers fire for
  letters too — handler dispatch reuses the same mapping. preventDefault for
  letters only applies outside inputs/textareas (already guarded) and only
  once a program has run, same as arrows.
- **blocks**: the `sprout_key_down` dropdown gains `w`, `a`, `s`, `d` (the
  common second-player set — a 31-entry dropdown would be unusable; text mode
  covers the rest). Decompiler `KEY_OPTIONS` extends to match so
  `keyDown(:w)` round-trips to the block; other letters fall back to the
  generic call block, which also round-trips.

## Testing

- lang: `keyDown(:w)` true after `setKeyState('w', true)`; `:z` works;
  multi-char (`:ww`) and digits throw; error message mentions letters.
- blocks: `sprout_key_down` with `w` compiles; decompiler round-trips
  `keyDown(:w)` (dropdown) and `keyDown(:q)` (generic fallback).
