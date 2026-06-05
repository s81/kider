# Stamp Design Spec

## Goal

Add a `stamp()` builtin to Sprout so kids can leave a visible turtle-shaped mark at the turtle's current position and heading — primarily for animation loops: `clearCanvas(); forward(x); stamp()`.

## Architecture

Two-layer feature following the existing pattern:

1. **Lang layer** — new `stamp` Drawing variant + `mkStamp` constructor + `stamp` builtin + renderer support
2. **Blocks layer** — one new value block `sprout_stamp` + compiler case

No new AST node — `stamp()` is a plain `CallExpr`.

---

## Section 1: Drawing variant

New variant added to the `Drawing` union in `packages/lang/src/values.ts`:

```typescript
| { readonly kind: 'stamp' }
```

Constructor helper exported from `values.ts`:

```typescript
export const mkStamp = (): Drawing => ({ kind: 'stamp' });
```

Added to `SproutValue` via the existing `Drawing` union — no change to `SproutValue` itself.

`isDrawing` already has `default: return false` so no update needed.

`scaleDrawing` passes `stamp` through unchanged (fixed-size icon — scaling the drawing doesn't resize the stamp).

Update the INVARIANT comment in `values.ts` to include `'stamp'` in the list of Drawing kind strings.

---

## Section 2: Builtin

One new entry in the `BUILTINS` map in `packages/lang/src/interpreter.ts`:

### `stamp()`

Zero arguments. Returns `mkStamp()`.

```
stamp()  →  { kind: 'stamp' }
```

No error cases — zero-arg builtin, no validation needed.

---

## Section 3: Renderer

### renderInto

New case in `renderInto` in `packages/lang/src/renderer.ts`:

```typescript
case 'stamp':
  out.push({ kind: 'drawStamp', x: state.x, y: state.y, heading: state.heading });
  break;
```

Turtle state is **not mutated** — stamp is a pure mark at the current position.

### CanvasCommand variant

New variant added to the `CanvasCommand` union in `packages/lang/src/renderer.ts`:

```typescript
| { readonly kind: 'drawStamp'; readonly x: number; readonly y: number; readonly heading: number }
```

### drawUpTo

New case in `drawUpTo` in `apps/ide/src/stage-utils.ts`:

```typescript
case 'drawStamp': {
  const cx = STAGE_W / 2 + cmd.x;
  const cy = STAGE_H / 2 + cmd.y;
  const size = 12; // tip-to-base in px
  ctx.stroke();    // flush pending path
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((cmd.heading * Math.PI) / 180);
  ctx.beginPath();
  // equilateral triangle: tip at front (north = up = negative y), base at rear
  ctx.moveTo(0, -size);                      // tip
  ctx.lineTo(size * 0.5, size * 0.5);        // base right
  ctx.lineTo(-size * 0.5, size * 0.5);       // base left
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle; // inherit pen color
  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  break;
}
```

The stamp inherits the current `ctx.strokeStyle` and `ctx.fillStyle` (set by the most recent `setColor` command), so it naturally matches the pen color.

---

## Section 4: Blockly block

One new value block in `packages/blocks/src/definitions/values.ts`, colour **290** (purple):

```typescript
Blockly.Blocks['sprout_stamp'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput().appendField('stamp');
    this.setOutput(true, null);
    this.setInputsInline(true);
    this.setColour(290);
  },
};
```

### Compiler case

In `packages/blocks/src/compiler.ts`, inside `compileExpr`, before `default: throw`:

```typescript
case 'sprout_stamp':
  return { kind: 'CallExpr', callee: 'stamp', args: [], block: null };
```

### Toolbox

In `apps/ide/src/BlockWorkspace.tsx`, add `sprout_stamp` to the toolbox. Place it in the existing turtle movement group (alongside `sprout_forward`, `sprout_turn`, etc.):

```typescript
{ kind: 'block', type: 'sprout_stamp' },
```

---

## Section 5: Exports

Export `mkStamp` from `packages/lang/src/index.ts` alongside the other Drawing constructors.

---

## Section 6: Tests

### Lang — interpreter test

In `packages/lang/tests/interpreter.test.ts`:

```typescript
describe('stamp builtin', () => {
  it('returns a stamp Drawing', () => {
    const prog = program([exprStmt(call('stamp', []))]);
    expect(interpretFull(prog).drawing).toEqual({ kind: 'stamp' });
  });
});
```

### Lang — renderer tests

In `packages/lang/tests/renderer.test.ts`, import `mkStamp` alongside existing imports. Use the existing `render(drawing)` helper which returns `CanvasCommand[]`.

```typescript
describe('stamp rendering', () => {
  it('emits drawStamp at origin with default heading', () => {
    expect(render(mkStamp())).toContainEqual({ kind: 'drawStamp', x: 0, y: 0, heading: 0 });
  });

  it('emits drawStamp at turtle position after forward', () => {
    expect(render(mkSequence([mkForward(50), mkStamp()]))).toContainEqual(
      { kind: 'drawStamp', x: 0, y: -50, heading: 0 }
    );
  });

  it('emits drawStamp with correct heading after turn', () => {
    expect(render(mkSequence([mkTurn(90), mkStamp()]))).toContainEqual(
      { kind: 'drawStamp', x: 0, y: 0, heading: 90 }
    );
  });
});
```

### Blocks — compiler test

In `packages/blocks/tests/compiler.test.ts`:

```typescript
it('sprout_stamp compiles to stamp()', () => {
  const ws = makeWorkspace();
  const stampBlock = ws.newBlock('sprout_stamp');
  const letBlock = ws.newBlock('sprout_let');
  letBlock.setFieldValue('s', 'NAME');
  letBlock.getInput('INIT')!.connection!.connect(stampBlock.outputConnection!);
  const result = compileWorkspace(ws);
  expect(result.stmts[0]).toEqual({
    kind: 'LetStmt',
    name: 's',
    init: { kind: 'CallExpr', callee: 'stamp', args: [], block: null },
  });
});
```

---

## What's not in scope

- Size argument to `stamp()`
- Named stamp shapes (`:star`, `:arrow`, `:circle`)
- Erasing individual stamps
- Sprite objects with mutable position/state
