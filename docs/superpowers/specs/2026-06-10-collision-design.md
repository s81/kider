# Collision Detection Design

**Date:** 2026-06-10
**Status:** Approved

## Goal

Give kids the core primitive for game mechanics: detecting when two things are close
enough to count as "touching" (catching, dodging, hit detection). Combined with the
already-shipped `mouseX()`/`mouseY()`, `getX()`/`getY()`, keyboard events, and timers,
this unlocks chase games, catch games, and click-target games.

## Approach

Sprout has no sprite/object model — positions are just numbers kids track in variables
or read from the turtle/mouse. So collision is two pure builtins over coordinates,
not an object-level `isTouching(sprite)` API:

- `distance(x1, y1, x2, y2)` → number — Euclidean distance between two points.
- `touching(x1, y1, x2, y2, radius)` → bool — true when `distance(x1,y1,x2,y2) <= radius`.

Circle-vs-circle (distance threshold) collision is the standard kid-friendly model:
one number to tune ("how close counts"), no rectangles or rotation math.

Rejected alternatives:
- **Sprite registry with `isTouching(a, b)`** — requires introducing named objects,
  a much bigger language change. YAGNI; coordinates already exist everywhere.
- **`distance` only (kids write the compare themselves)** — `touching` removes the
  `<=` step that trips up beginners and reads like the game logic they're thinking.

## Semantics

- `distance(x1, y1, x2, y2)`: exactly 4 arguments, all numbers (else
  `SproutRuntimeError` matching existing builtin arity/type messages).
  Returns `sqrt((x2-x1)^2 + (y2-y1)^2)`. Same point → 0.
- `touching(x1, y1, x2, y2, radius)`: exactly 5 arguments, all numbers.
  Returns bool `distance <= radius`. Boundary is inclusive (distance exactly equal
  to radius counts as touching). Negative radius is allowed and simply never
  touches (except never — distance is non-negative, so only matches nothing);
  no special-case error, consistent with other math builtins not range-checking.
- Both are pure: no turtle state read or written, no drawing produced
  (they return values, used in expressions).
- Text syntax: ordinary call expressions; no parser or serializer changes needed.

## Layers

1. **packages/lang** — two BUILTINS entries (next to the math builtins), tests.
2. **packages/blocks** — `sprout_distance` (4 Number inputs, Number output,
   colour 230 like other math/value blocks) and `sprout_touching`
   (5 Number inputs, Boolean output, colour 230) in `values.ts`;
   `compileExpr` cases emitting `CallExpr`; compiler tests.
3. **apps/ide** — toolbox entries: `sprout_distance` under Math,
   `sprout_touching` next to it (it's a Boolean-producing sensor, but kids will
   look for it near distance).

## Testing

- lang: distance of (0,0)-(3,4) is 5; same point is 0; negative coordinates;
  arity errors (3 and 5 args); type error on non-number.
  touching: inside radius true; exactly at radius true (inclusive boundary);
  outside false; arity error (4 args); works inside an `if` condition end-to-end.
- blocks: workspace with `sprout_touching` wired to number blocks compiles to
  `CallExpr { callee: 'touching', args: [...] }`; same for `sprout_distance`.
