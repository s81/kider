# Turtle State Queries — Design Spec
**Date:** 2026-06-09

## Summary

Add three builtins — `getX()`, `getY()`, `getHeading()` — that return the turtle's current position and heading during program execution.

---

## Problem

The turtle's state (x, y, heading) is currently only computed during rendering (`renderInto` in `renderer.ts`), after the entire Drawing tree is built. The interpreter has no knowledge of where the turtle is while the program runs. This means a program like:

```
forward(100)
turn(90)
let x = getX()   -- should be ~0; getY() should be ~-100
```

…cannot be written today.

---

## Solution

Maintain a **shadow turtle state** in `interpreter.ts` — a module-level mutable object updated in real time by the same builtins that emit drawing commands. This mirrors the pattern already used for `_mouseX` / `_mouseY`.

```ts
// module-level mutable shadow state
let _turtleX    = 0;
let _turtleY    = 0;
let _turtleHeading = 0; // degrees clockwise from north
```

### State reset

Reset all three to `0` at the top of `interpretFull` / `interpretFullWithInputs`, before evaluating the program. This ensures a clean slate on each Run.

### Update rules (must match renderer math exactly)

| Builtin  | Shadow state update |
|----------|-------------------|
| `forward(d)` | `_turtleX += d * sin(heading_rad); _turtleY -= d * cos(heading_rad)` |
| `turn(deg)` | `_turtleHeading = (heading + deg % 360 + 360) % 360` |
| `goto(x, y)` | `_turtleX = x; _turtleY = y` |
| `home()` | `_turtleX = 0; _turtleY = 0; _turtleHeading = 0` |
| `penUp` / `penDown` | no change to x/y/heading |
| `arc(radius, angle)` | see arc math below |

### Arc math

`arc(radius, angle)` traces a circular arc. The turtle ends at a new position and heading:

```
// heading before arc
const h0 = _turtleHeading;
// chord direction bisects the arc — turtle moves like "turn(angle/2), forward(chord), turn(angle/2)"
// but simpler: just compute end state using renderer's renderInto math.
// The renderer uses:
//   startAngle = (heading - 90) * DEG_TO_RAD   (arc starts perpendicular to heading)
//   endAngle = startAngle + angle * DEG_TO_RAD
//   cx = x - radius * cos(startAngle)
//   cy = y + radius * sin(startAngle)
//   endX = cx + radius * cos(endAngle)
//   endY = cy - radius * sin(endAngle)
//   new heading = heading + angle
```

The shadow state should apply the same math. See `renderer.ts` `case 'arc'` for exact values.

### New builtins

```ts
['getX', (args) => {
  if (args.length !== 0) throw new SproutRuntimeError(`getX expects 0 arguments, got ${args.length}`);
  return { kind: 'number', value: _turtleX };
}],
['getY', (args) => {
  if (args.length !== 0) throw new SproutRuntimeError(`getY expects 0 arguments, got ${args.length}`);
  return { kind: 'number', value: _turtleY };
}],
['getHeading', (args) => {
  if (args.length !== 0) throw new SproutRuntimeError(`getHeading expects 0 arguments, got ${args.length}`);
  return { kind: 'number', value: _turtleHeading };
}],
```

---

## Block definitions

Three value blocks (colour 120 — light green, matching turtle commands):

| Block | Output | Code emitted |
|-------|--------|--------------|
| `sprout_get_x` | number | `getX()` |
| `sprout_get_y` | number | `getY()` |
| `sprout_get_heading` | number | `getHeading()` |

Each block:
- `setOutput(true, 'Number')`
- No inputs — zero-argument call
- Label: "turtle x" / "turtle y" / "turtle heading"

Toolbox placement: add at end of the **Turtle** section in `BlockWorkspace.tsx`, after `sprout_home`.

---

## Testing

Test file: `packages/lang/tests/turtle-state-queries.test.ts`

Groups:

1. **getX / getY after forward** — forward(100) → getY() ≈ -100, getX() ≈ 0
2. **getHeading after turn** — turn(90) → getHeading() = 90
3. **getX / getY after turn + forward** — turn(90), forward(50) → getX() ≈ 50, getY() ≈ 0
4. **state resets between programs** — sequential interpretFull calls each start at (0,0,0)
5. **goto updates state** — goto(30, 40) → getX() = 30, getY() = 40
6. **home resets state** — forward(100), home() → getX() = 0, getY() = 0, getHeading() = 0
7. **arc updates heading** — arc(50, 90) → heading = 90 (angle increase)
8. **wrong arity** — getX(1) throws

Floating-point comparisons use `toBeCloseTo(val, 1)` (1 decimal place).

---

## Out of scope

- Text parser changes (text mode already handles `getX()` as a zero-arg `CallExpr`)
- Serializer changes (no new AST nodes)
- `penDown` state query — not needed for now
