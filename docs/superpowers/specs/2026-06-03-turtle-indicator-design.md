# Turtle Indicator Design

**Date:** 2026-06-03
**Status:** Approved

## Goal

Show the turtle's current position and heading as a small triangle overlaid on the canvas, so users can always see where the turtle is and which direction it faces — even when the pen is up or the canvas is empty.

## Approach

Pure function `getTurtleState` infers heading from position deltas in `CanvasCommand[]`. A separate `drawTurtle` function renders the triangle. `Stage.tsx` wires them together after `drawUpTo`. No changes to the lang package.

## Architecture

### New functions in `apps/ide/src/stage-utils.ts`

**`getTurtleState(commands: CanvasCommand[], limit: number): TurtleState`**

- `TurtleState = { x: number; y: number; heading: number }`
- Walks `commands[0..limit-1]`, tracking `(x, y)` and `lastHeading`
- Heading inference:
  - When `moveTo` or `lineTo` changes position: `heading = atan2(dx, -dy) * 180/π`
  - When position doesn't change (e.g. `penUp`/`penDown`, same-position move): keep `lastHeading`
- Default state: `{ x: 0, y: 0, heading: 0 }` (origin, pointing up)
- Pure function — no side effects, deterministic

**`drawTurtle(ctx: CanvasRenderingContext2D, state: TurtleState): void`**

- Draws a filled equilateral triangle, ~12px tip-to-base, color `#20c997` (teal)
- Canvas position: `(STAGE_W/2 + state.x, STAGE_H/2 + state.y)`
- Rotation: `state.heading` degrees clockwise from north
- Uses canvas save/restore to avoid affecting subsequent draws
- Always visible regardless of pen state

### Changes to `apps/ide/src/Stage.tsx`

After calling `drawUpTo(ctx, commands, step)`, call:
```typescript
const turtle = getTurtleState(commands, step);
drawTurtle(ctx, turtle);
```

No signature changes to `drawUpTo`.

## Heading Convention

- 0° = up (north)
- 90° = right (east)
- 180° = down (south)
- 270° = left (west)

Conversion from canvas `atan2`: `heading = atan2(dx, -dy) * (180 / Math.PI)`

Normalized to `[0, 360)` using `((heading % 360) + 360) % 360`.

## Visual Appearance

- Shape: filled equilateral triangle, tip pointing in heading direction
- Size: 12px from center to tip
- Color: `#20c997` (teal)
- Drawn on top of all drawing output
- Always present — even on empty canvas (turtle at center, pointing up)

## Testing

Unit tests in `apps/ide/src/stage-utils.test.ts` for `getTurtleState`:

| Scenario | Input commands | Expected state |
|---|---|---|
| Empty | `[]` | `{ x: 0, y: 0, heading: 0 }` |
| moveTo only | `[moveTo(0,0)]` | `{ x: 0, y: 0, heading: 0 }` |
| Forward (up) | `moveTo(0,0), lineTo(0,-50)` | `{ x: 0, y: -50, heading: 0 }` |
| Forward (right) | `moveTo(0,0), lineTo(50,0)` | `{ x: 50, y: 0, heading: 90 }` |
| Forward (down) | `moveTo(0,0), lineTo(0,50)` | `{ x: 0, y: 50, heading: 180 }` |
| limit respected | 5 commands, limit=2 | only first 2 processed |
| penUp/penDown | interspersed | heading/position unchanged |
| setColor/setLineWidth | interspersed | heading/position unchanged |

No visual tests for `drawTurtle` — canvas context testing is not set up in this project.

## Files Changed

| File | Change |
|---|---|
| `apps/ide/src/stage-utils.ts` | Add `TurtleState` type, `getTurtleState`, `drawTurtle` |
| `apps/ide/src/Stage.tsx` | Call `getTurtleState` + `drawTurtle` after `drawUpTo` |
| `apps/ide/src/stage-utils.test.ts` | Add unit tests for `getTurtleState` |

## Out of Scope

- Turtle sprite / image — triangle only
- Turtle visibility toggle
- Heading readout in UI
- Changes to lang package
