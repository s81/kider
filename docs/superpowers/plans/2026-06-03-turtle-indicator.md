# Turtle Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overlay a small teal triangle on the canvas showing the turtle's current position and heading, inferred from CanvasCommands.

**Architecture:** `getTurtleState` is a pure function in `stage-utils.ts` that walks CanvasCommands up to a limit and infers position + heading from position deltas. `drawTurtle` renders a filled equilateral triangle at that state. `Stage.tsx` calls both after `drawUpTo` — no changes to the lang package.

**Tech Stack:** TypeScript, React, HTML Canvas API, Vitest

---

## File Map

| File | Change |
|---|---|
| `apps/ide/src/stage-utils.ts` | Add `TurtleState` type, `getTurtleState`, `drawTurtle` |
| `apps/ide/src/Stage.tsx` | Call `getTurtleState` + `drawTurtle` after `drawUpTo` |
| `apps/ide/tests/stage-utils.test.ts` | New — unit tests for `getTurtleState` |

---

### Task 1: `getTurtleState` — pure function with unit tests

**Files:**
- Modify: `apps/ide/src/stage-utils.ts`
- Create: `apps/ide/tests/stage-utils.test.ts`

**Background:**

`CanvasCommand` from `@sprout/lang`:
```typescript
type CanvasCommand =
  | { kind: 'moveTo'; x: number; y: number }
  | { kind: 'lineTo'; x: number; y: number }
  | { kind: 'penDown' }
  | { kind: 'penUp' }
  | { kind: 'setColor'; color: string }
  | { kind: 'setLineWidth'; width: number };
```

Heading convention: 0° = up, 90° = right, 180° = down, 270° = left.
Conversion: `heading = ((Math.atan2(dx, -dy) * 180 / Math.PI) % 360 + 360) % 360`

- [ ] **Step 1: Write the failing tests**

Create `apps/ide/tests/stage-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTurtleState } from '../src/stage-utils.js';
import type { CanvasCommand } from '@sprout/lang';

describe('getTurtleState', () => {
  it('returns default state for empty commands', () => {
    expect(getTurtleState([], 0)).toEqual({ x: 0, y: 0, heading: 0 });
  });

  it('returns default state for limit 0', () => {
    const cmds: CanvasCommand[] = [{ kind: 'moveTo', x: 50, y: 50 }];
    expect(getTurtleState(cmds, 0)).toEqual({ x: 0, y: 0, heading: 0 });
  });

  it('moveTo to same position does not change heading', () => {
    const cmds: CanvasCommand[] = [{ kind: 'moveTo', x: 0, y: 0 }];
    expect(getTurtleState(cmds, 1)).toEqual({ x: 0, y: 0, heading: 0 });
  });

  it('lineTo moving up (y decreases) sets heading to 0', () => {
    const cmds: CanvasCommand[] = [
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'lineTo', x: 0, y: -50 },
    ];
    expect(getTurtleState(cmds, 2)).toEqual({ x: 0, y: -50, heading: 0 });
  });

  it('lineTo moving right (x increases) sets heading to 90', () => {
    const cmds: CanvasCommand[] = [
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'lineTo', x: 50, y: 0 },
    ];
    expect(getTurtleState(cmds, 2)).toEqual({ x: 50, y: 0, heading: 90 });
  });

  it('lineTo moving down (y increases) sets heading to 180', () => {
    const cmds: CanvasCommand[] = [
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'lineTo', x: 0, y: 50 },
    ];
    expect(getTurtleState(cmds, 2)).toEqual({ x: 0, y: 50, heading: 180 });
  });

  it('limit is respected — stops before later commands', () => {
    const cmds: CanvasCommand[] = [
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'lineTo', x: 50, y: 0 },
      { kind: 'lineTo', x: 50, y: -50 },
    ];
    // limit=2: only first two commands processed, turtle at (50, 0) heading 90
    expect(getTurtleState(cmds, 2)).toEqual({ x: 50, y: 0, heading: 90 });
  });

  it('penUp and penDown do not affect position or heading', () => {
    const cmds: CanvasCommand[] = [
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'penUp' },
      { kind: 'lineTo', x: 0, y: -50 },
      { kind: 'penDown' },
    ];
    expect(getTurtleState(cmds, 4)).toEqual({ x: 0, y: -50, heading: 0 });
  });

  it('setColor and setLineWidth do not affect position or heading', () => {
    const cmds: CanvasCommand[] = [
      { kind: 'setColor', color: 'red' },
      { kind: 'setLineWidth', width: 5 },
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'lineTo', x: 30, y: 0 },
    ];
    expect(getTurtleState(cmds, 4)).toEqual({ x: 30, y: 0, heading: 90 });
  });

  it('heading is retained when position does not change (pen up move)', () => {
    const cmds: CanvasCommand[] = [
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'lineTo', x: 50, y: 0 },   // heading becomes 90
      { kind: 'moveTo', x: 50, y: 0 },   // same position — heading stays 90
    ];
    expect(getTurtleState(cmds, 3)).toEqual({ x: 50, y: 0, heading: 90 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test
```

Expected: multiple failures with "getTurtleState is not a function" or similar export error.

- [ ] **Step 3: Add `TurtleState` type and `getTurtleState` to `stage-utils.ts`**

Add after the existing imports at the top of `apps/ide/src/stage-utils.ts`:

```typescript
export interface TurtleState {
  x: number;
  y: number;
  /** Degrees clockwise from north: 0=up, 90=right, 180=down, 270=left */
  heading: number;
}

export function getTurtleState(commands: CanvasCommand[], limit: number): TurtleState {
  let x = 0;
  let y = 0;
  let heading = 0;

  const end = Math.min(limit, commands.length);
  for (let i = 0; i < end; i++) {
    const cmd = commands[i];
    if (cmd.kind === 'moveTo' || cmd.kind === 'lineTo') {
      if (cmd.x !== x || cmd.y !== y) {
        const dx = cmd.x - x;
        const dy = cmd.y - y;
        heading = ((Math.atan2(dx, -dy) * 180 / Math.PI) % 360 + 360) % 360;
        x = cmd.x;
        y = cmd.y;
      }
    }
  }

  return { x, y, heading };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm test
```

Expected: all `getTurtleState` tests pass; total test count increases by 9.

- [ ] **Step 5: Commit**

```
git add apps/ide/src/stage-utils.ts apps/ide/tests/stage-utils.test.ts
git commit -m "feat(ide): add getTurtleState to infer turtle position and heading from CanvasCommands"
```

---

### Task 2: `drawTurtle` — canvas rendering function

**Files:**
- Modify: `apps/ide/src/stage-utils.ts`

**Background:**

The triangle points up by default (heading 0). `ctx.rotate(heading * Math.PI / 180)` rotates it clockwise to match any heading. SIZE = 10 means the tip is 10px from center; base corners are at roughly (±6, 6) from center. Color: `#20c997` (teal).

Canvas save/restore ensures the transform doesn't leak into subsequent draw calls.

- [ ] **Step 1: Add `drawTurtle` to `stage-utils.ts`**

Add after `getTurtleState`:

```typescript
const TURTLE_SIZE = 10;

export function drawTurtle(ctx: CanvasRenderingContext2D, state: TurtleState): void {
  const cx = STAGE_W / 2 + state.x;
  const cy = STAGE_H / 2 + state.y;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.heading * Math.PI / 180);

  ctx.beginPath();
  ctx.moveTo(0, -TURTLE_SIZE);                          // tip (up)
  ctx.lineTo(TURTLE_SIZE * 0.6, TURTLE_SIZE * 0.7);    // bottom-right
  ctx.lineTo(-TURTLE_SIZE * 0.6, TURTLE_SIZE * 0.7);   // bottom-left
  ctx.closePath();

  ctx.fillStyle = '#20c997';
  ctx.fill();

  ctx.restore();
}
```

- [ ] **Step 2: Run tests to verify nothing broke**

```
pnpm test
```

Expected: same passing count as after Task 1 (no new tests for `drawTurtle` — canvas ctx not available in Vitest).

- [ ] **Step 3: Commit**

```
git add apps/ide/src/stage-utils.ts
git commit -m "feat(ide): add drawTurtle — renders teal triangle at turtle position and heading"
```

---

### Task 3: Wire up in `Stage.tsx`

**Files:**
- Modify: `apps/ide/src/Stage.tsx`

**Background:**

`Stage.tsx` currently calls `drawUpTo(ctx, commands, step)` in two places:
1. Non-animated branch (line 20): `drawUpTo(ctx, commands, commands.length)`
2. Animation tick (line 29): `drawUpTo(ctx, commands, step)`

Both need `getTurtleState` + `drawTurtle` called immediately after with the same limit value. Import `getTurtleState`, `drawTurtle`, `TurtleState` from `./stage-utils.js`.

- [ ] **Step 1: Update `Stage.tsx`**

Replace the entire file content with:

```typescript
import { useEffect, useRef } from 'react';
import type { CanvasCommand } from '@sprout/lang';
import { drawUpTo, getTurtleState, drawTurtle, STAGE_W, STAGE_H } from './stage-utils.js';

interface Props {
  commands: CanvasCommand[];
  animated?: boolean;
  stepsPerFrame?: number;
  onClick?: () => void;
}

export function Stage({ commands, animated = false, stepsPerFrame = 3, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    if (!animated || commands.length === 0) {
      const limit = commands.length;
      drawUpTo(ctx, commands, limit);
      drawTurtle(ctx, getTurtleState(commands, limit));
      return;
    }

    let step = 0;
    let rafId = 0;

    function tick() {
      step = Math.min(step + stepsPerFrame, commands.length);
      drawUpTo(ctx, commands, step);
      drawTurtle(ctx, getTurtleState(commands, step));
      if (step < commands.length) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [commands, animated, stepsPerFrame]);

  return (
    <canvas
      ref={canvasRef}
      width={STAGE_W}
      height={STAGE_H}
      onClick={onClick}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 4,
        background: '#fff',
        display: 'block',
        cursor: onClick ? 'crosshair' : 'default',
      }}
    />
  );
}
```

- [ ] **Step 2: Run tests and typecheck**

```
pnpm test && pnpm typecheck
```

Expected: all tests pass, no type errors.

- [ ] **Step 3: Commit**

```
git add apps/ide/src/Stage.tsx
git commit -m "feat(ide): draw turtle indicator after each canvas frame"
```

---

## Done

After all three tasks, the turtle indicator is live. The canvas always shows a small teal triangle at the turtle's current position pointing in its current heading direction — including when the canvas is empty (turtle at center, pointing up).
