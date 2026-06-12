# Phase 4a — Turtle Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RAF-based step-by-step animation to the turtle canvas so drawings appear being drawn rather than appearing all at once.

**Architecture:** Extract the canvas drawing logic from `Stage.tsx`'s `useEffect` into a pure helper function `drawUpTo()` in a separate `stage-utils.ts` module. `Stage.tsx` gains `animated` and `stepsPerFrame` props; when `animated=true`, a `requestAnimationFrame` loop steps through `CanvasCommand[]` one chunk at a time. `App.tsx` adds a checkbox toggle and a speed slider.

**Tech Stack:** React, TypeScript, `requestAnimationFrame`, HTML Canvas 2D API, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/ide/src/stage-utils.ts` | Pure `drawUpTo()` helper, testable without DOM |
| Modify | `apps/ide/src/Stage.tsx` | Import `drawUpTo`, add `animated`/`stepsPerFrame` props, RAF loop |
| Modify | `apps/ide/src/App.tsx` | Add `animated` + `stepsPerFrame` state, animation controls UI |
| Create | `apps/ide/tests/stage-utils.test.ts` | Unit tests for `drawUpTo` with mock canvas context |

---

### Task 1: Extract `drawUpTo` into `stage-utils.ts`

**Files:**
- Create: `apps/ide/src/stage-utils.ts`
- Create: `apps/ide/tests/stage-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/ide/tests/stage-utils.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawUpTo } from '../src/stage-utils.js';
import type { CanvasCommand } from '@sprout/lang';

function makeMockCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '' as CanvasRenderingContext2D['strokeStyle'],
    lineWidth: 0,
    lineCap: '' as CanvasFillStrokeStyles['strokeStyle'],
    lineJoin: '' as CanvasRenderingContext2D['lineJoin'],
  } as unknown as CanvasRenderingContext2D;
}

const W = 500;
const H = 500;

describe('drawUpTo', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears canvas and skips stroke when limit is 0', () => {
    const commands: CanvasCommand[] = [{ kind: 'lineTo', x: 10, y: 20 }];
    drawUpTo(ctx, commands, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, W, H);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws moveTo commands as ctx.moveTo offset by canvas center', () => {
    const commands: CanvasCommand[] = [{ kind: 'moveTo', x: 10, y: -5 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.moveTo).toHaveBeenCalledWith(W / 2 + 10, H / 2 + (-5));
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('draws lineTo commands as ctx.lineTo offset by canvas center', () => {
    const commands: CanvasCommand[] = [{ kind: 'lineTo', x: 50, y: 30 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.lineTo).toHaveBeenCalledWith(W / 2 + 50, H / 2 + 30);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('respects limit — only draws first N commands', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 10, y: 0 },
      { kind: 'lineTo', x: 20, y: 0 },
      { kind: 'lineTo', x: 30, y: 0 },
    ];
    drawUpTo(ctx, commands, 2);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(1, W / 2 + 10, H / 2);
    expect(ctx.lineTo).toHaveBeenNthCalledWith(2, W / 2 + 20, H / 2);
  });

  it('ignores penDown and penUp commands (no ctx call)', () => {
    const commands: CanvasCommand[] = [
      { kind: 'penDown' },
      { kind: 'lineTo', x: 10, y: 0 },
      { kind: 'penUp' },
    ];
    drawUpTo(ctx, commands, 3);
    // Only lineTo emits a ctx call (beyond the initial moveTo from beginPath setup)
    expect(ctx.lineTo).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```
bun run vitest run apps/ide/tests/stage-utils.test.ts
```

Expected: FAIL with `Cannot find module '../src/stage-utils.js'`

- [ ] **Step 3: Create `apps/ide/src/stage-utils.ts`**

```typescript
import type { CanvasCommand } from '@sprout/lang';

export const STAGE_W = 500;
export const STAGE_H = 500;

export function drawUpTo(
  ctx: CanvasRenderingContext2D,
  commands: CanvasCommand[],
  limit: number,
): void {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  if (limit === 0) return;

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(STAGE_W / 2, STAGE_H / 2);

  for (let i = 0; i < limit; i++) {
    const cmd = commands[i];
    switch (cmd.kind) {
      case 'moveTo':
        ctx.moveTo(STAGE_W / 2 + cmd.x, STAGE_H / 2 + cmd.y);
        break;
      case 'lineTo':
        ctx.lineTo(STAGE_W / 2 + cmd.x, STAGE_H / 2 + cmd.y);
        break;
      case 'penDown':
      case 'penUp':
        break;
    }
  }
  ctx.stroke();
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```
bun run vitest run apps/ide/tests/stage-utils.test.ts
```

Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```
git add apps/ide/src/stage-utils.ts apps/ide/tests/stage-utils.test.ts
git commit -m "feat(ide): extract drawUpTo helper with unit tests"
```

---

### Task 2: Refactor Stage.tsx to use `drawUpTo` and add animation loop

**Files:**
- Modify: `apps/ide/src/Stage.tsx`

- [ ] **Step 1: Write the updated Stage.tsx**

Replace the entire contents of `apps/ide/src/Stage.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import type { CanvasCommand } from '@sprout/lang';
import { drawUpTo, STAGE_W, STAGE_H } from './stage-utils.js';

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
      drawUpTo(ctx, commands, commands.length);
      return;
    }

    let step = 0;
    let rafId: number;

    function tick() {
      step = Math.min(step + stepsPerFrame, commands.length);
      drawUpTo(ctx, commands, step);
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

- [ ] **Step 2: Run the full test suite to verify no regressions**

```
bun run vitest run
```

Expected: All tests pass (stage-utils tests + existing lang/blocks tests)

- [ ] **Step 3: Commit**

```
git add apps/ide/src/Stage.tsx
git commit -m "refactor(ide): wire Stage.tsx to drawUpTo, add animated + onClick props"
```

---

### Task 3: Add animation controls to App.tsx

**Files:**
- Modify: `apps/ide/src/App.tsx`

- [ ] **Step 1: Write the updated App.tsx**

Replace the entire contents of `apps/ide/src/App.tsx`:

```typescript
import { useRef, useState } from 'react';
import type * as Blockly from 'blockly';
import { compileWorkspace } from '@sprout/blocks';
import { interpret, render, SproutRuntimeError } from '@sprout/lang';
import type { CanvasCommand } from '@sprout/lang';
import { BlockWorkspace } from './BlockWorkspace.js';
import { TextPanel } from './TextPanel.js';
import { Stage } from './Stage.js';

export function App() {
  const wsRef = useRef<Blockly.Workspace | null>(null);
  const [programText, setProgramText] = useState('');
  const [commands, setCommands] = useState<CanvasCommand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [stepsPerFrame, setStepsPerFrame] = useState(3);

  function handleRun() {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      setError(null);
      const program = compileWorkspace(ws);
      const drawing = interpret(program);
      setCommands(render(drawing));
    } catch (e) {
      setError(e instanceof SproutRuntimeError ? e.message : String(e));
      setCommands([]);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'sans-serif' }}>
      {/* Left: Blockly workspace */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <BlockWorkspace
          onTextChange={setProgramText}
          onWorkspaceReady={ws => { wsRef.current = ws; }}
        />
      </div>

      {/* Right: controls + text panel + stage */}
      <div
        style={{
          width: 524,
          display: 'flex',
          flexDirection: 'column',
          padding: 8,
          gap: 8,
          background: '#f8fafc',
          borderLeft: '1px solid #e2e8f0',
        }}
      >
        <button
          onClick={handleRun}
          style={{
            padding: '8px 0',
            fontSize: 15,
            fontWeight: 600,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ▶ Run
        </button>

        {/* Animation controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={animated}
              onChange={e => setAnimated(e.target.checked)}
            />
            Animate
          </label>
          {animated && (
            <>
              <span>Speed:</span>
              <input
                type="range"
                min={1}
                max={20}
                value={stepsPerFrame}
                onChange={e => setStepsPerFrame(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ minWidth: 20, textAlign: 'right' }}>{stepsPerFrame}</span>
            </>
          )}
        </div>

        <TextPanel text={programText} />

        <Stage commands={commands} animated={animated} stepsPerFrame={stepsPerFrame} />

        {error && (
          <pre
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 8,
              borderRadius: 4,
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </pre>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

```
bun run vitest run
```

Expected: All tests pass

- [ ] **Step 3: Manual visual verification**

Start the dev server: `bun run --cwd apps/ide dev`

Checklist:
- [ ] Drag a `forward 100` + `turn 90` repeat-4 loop (square) and press Run — turtle draws the square instantly (animate unchecked)
- [ ] Check "Animate" checkbox, press Run — turtle steps draw one by one
- [ ] Move speed slider left (slower), press Run — fewer steps per frame, slower animation
- [ ] Move speed slider right (faster), press Run — more steps per frame, finishes quickly
- [ ] Uncheck "Animate" — speed slider disappears; Run draws instantly again
- [ ] No console errors during any of the above

- [ ] **Step 4: Commit**

```
git add apps/ide/src/App.tsx
git commit -m "feat(ide): add animate toggle and speed slider to App"
```

---

## Self-Review Checklist

- Spec coverage: RAF animation ✓, toggle ✓, speed control ✓
- No `any` types: `STAGE_W`/`STAGE_H` constants shared between Stage and utils ✓
- Cleanup: `cancelAnimationFrame` called in effect cleanup ✓
- `drawUpTo` redraws from scratch each frame (clear + full redraw) — correct for small command lists ✓
- `stepsPerFrame` defaults to 3 so medium programs animate smoothly ✓
- When `animated=false` or `commands.length=0`, falls through to instant render ✓
