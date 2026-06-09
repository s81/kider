# Turtle State Queries — Implementation Plan
**Date:** 2026-06-09
**Spec:** docs/superpowers/specs/2026-06-09-turtle-state-queries-design.md

## Context

Add `getX()`, `getY()`, `getHeading()` builtins to the Sprout interpreter. These read from a shadow turtle state maintained by the interpreter as it evaluates drawing commands. The renderer already tracks state identically during rendering — the interpreter needs its own parallel tracking.

## Tasks

### Task 1 — Shadow turtle state + builtins in interpreter.ts

File: `packages/lang/src/interpreter.ts`

1. Add three module-level mutable variables after `_mouseX`/`_mouseY`:
   ```ts
   let _turtleX    = 0;
   let _turtleY    = 0;
   let _turtleHeading = 0;
   ```

2. Reset them at the top of `interpretFull` (and `interpretFullWithInputs` if it doesn't delegate through `interpretFull`):
   ```ts
   _turtleX = 0;
   _turtleY = 0;
   _turtleHeading = 0;
   ```

3. In the existing `forward` builtin, add shadow state update after `mkForward`:
   ```ts
   const rad = _turtleHeading * Math.PI / 180;
   _turtleX += d.value * Math.sin(rad);
   _turtleY -= d.value * Math.cos(rad);
   ```

4. In the existing `turn` builtin, add:
   ```ts
   _turtleHeading = ((_turtleHeading + deg.value) % 360 + 360) % 360;
   ```

5. In `goto` builtin (already exists), add:
   ```ts
   _turtleX = x.value;
   _turtleY = y.value;
   ```

6. In `home` builtin (already exists), add:
   ```ts
   _turtleX = 0;
   _turtleY = 0;
   _turtleHeading = 0;
   ```

7. In `arc` builtin (already exists), add arc end-state math matching renderer's `case 'arc'`:
   Look at renderer.ts `case 'arc'` for the exact end-x, end-y, end-heading calculation and replicate it.

8. Add the three new builtins to `BUILTINS` map:
   ```ts
   ['getX', (args) => { /* 0 args, return { kind: 'number', value: _turtleX } */ }],
   ['getY', (args) => { /* 0 args, return { kind: 'number', value: _turtleY } */ }],
   ['getHeading', (args) => { /* 0 args, return { kind: 'number', value: _turtleHeading } */ }],
   ```

### Task 2 — Tests

File: `packages/lang/tests/turtle-state-queries.test.ts`

Write tests using TDD. Use the helper pattern from other test files:
- `forward(d)` → `exprStmt(callExpr('forward', [num(d)]))`
- Build a `Program` with a sequence of stmts, interpret it, check the returned value of `getX()` etc.

Test groups (see spec):
1. getX/getY after forward(100) — getY ≈ -100, getX ≈ 0
2. getHeading after turn(90) — = 90
3. turn(90) + forward(50) — getX ≈ 50, getY ≈ 0
4. Reset between runs — call interpretFull twice; second call starts at (0,0,0)
5. goto(30, 40) — getX = 30, getY = 40
6. home() resets — forward(100), home(), then getX=0, getY=0, getHeading=0
7. arc(50, 90) — getHeading = 90
8. getX(1) throws

Use `toBeCloseTo(val, 1)` for floating-point positions.

Run: `bun test packages/lang/tests/turtle-state-queries.test.ts`

### Task 3 — Blocks and toolbox wiring

Files:
- `packages/blocks/src/definitions/values.ts`
- `packages/blocks/src/compiler.ts`
- `apps/ide/src/BlockWorkspace.tsx`

1. In `values.ts`, add three zero-argument value blocks at colour 120:
   ```ts
   Blockly.Blocks['sprout_get_x'] = {
     init(this: Blockly.Block) {
       this.appendDummyInput().appendField('turtle x');
       this.setOutput(true, 'Number');
       this.setColour(120);
     },
   };
   // same for sprout_get_y ('turtle y') and sprout_get_heading ('turtle heading')
   ```

2. In `compiler.ts`, add cases in `compileValueBlock`:
   ```ts
   case 'sprout_get_x':
     return { kind: 'CallExpr', callee: 'getX', args: [], block: null };
   case 'sprout_get_y':
     return { kind: 'CallExpr', callee: 'getY', args: [], block: null };
   case 'sprout_get_heading':
     return { kind: 'CallExpr', callee: 'getHeading', args: [], block: null };
   ```

3. In `BlockWorkspace.tsx`, add toolbox entries after `sprout_home` in the Turtle section:
   ```ts
   { kind: 'block', type: 'sprout_get_x' },
   { kind: 'block', type: 'sprout_get_y' },
   { kind: 'block', type: 'sprout_get_heading' },
   ```

## Verification

- `bun test` — all existing tests pass plus new turtle-state-queries tests
- TypeScript: no new errors
