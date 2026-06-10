# keyDown Design (held-key polling)

**Date:** 2026-06-10
**Status:** Approved

## Goal

Smooth, game-feel keyboard movement. Today `on :left do ... end` fires once per
keypress and then stutters at the OS auto-repeat rate. Real games poll "is the
key held right now?" every timer tick:

```
on timer every 50 do
  if keyDown(:right) do
    set x = x + 5
  end
  clearCanvas()
  goto(x, y)
  stamp()
end
```

This completes the game loop that collision (`touching`) and sound (`beep`)
joined earlier today: tick → poll keys → move → check collision → react.

## Semantics

- `keyDown(key)` — exactly 1 argument, a symbol or string naming a key:
  `left`, `right`, `up`, `down`, `space` (the same set the `on` event dropdown
  offers). Returns bool: whether that key is held at this instant.
- Unknown key names throw `SproutRuntimeError`
  (`keyDown: unknown key 'banana' (expected left, right, up, down, space)`) —
  a silent `false` would hide kids' typos forever.
- Pure read of host state; no drawing produced. No parser/serializer changes.

## Architecture

Mirrors `mouseX()`/`setMousePosition` exactly:

- **interpreter.ts**: module-level `_keysDown: Set<string>`;
  `export function setKeyState(key: string, down: boolean)` (re-exported from
  the package index); `keyDown` builtin reading the set.
- **App.tsx (IDE)**: the existing `keydown` listener additionally calls
  `setKeyState(name, true)` for mapped keys (Set semantics absorb auto-repeat);
  a new `keyup` listener calls `setKeyState(name, false)`; a `blur` listener
  clears all five keys so nothing sticks when the window loses focus.
  The existing per-press `on :key` handler dispatch is unchanged.
- **blocks**: `sprout_key_down` value block — "key [dropdown] held?" with
  Boolean output, colour 230 (same family as the mouse value blocks).
  Compiles to `CallExpr keyDown [SymbolLit <name>]`.
- **toolbox**: next to `sprout_mouse_x`/`sprout_mouse_y` in Values.

## Testing

- lang: `setKeyState('left', true)` → `keyDown(:left)` is true, `:right` false;
  releasing flips back to false; string argument `keyDown("left")` works;
  unknown key throws; arity errors; non-string/symbol argument throws.
- blocks: `sprout_key_down` with the dropdown set compiles to the right
  CallExpr.
- ide: listener wiring is not unit-tested (no DOM in the test environment),
  same as the mouse listeners.
