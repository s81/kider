import { describe, it, expect } from 'vitest';
import { render, measure } from '../src/renderer.js';
import {
  EMPTY,
  PEN_UP,
  PEN_DOWN,
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
} from '../src/values.js';
import type { CanvasCommand } from '../src/renderer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const lineTo = (x: number, y: number): CanvasCommand => ({ kind: 'lineTo', x, y });
const moveTo = (x: number, y: number): CanvasCommand => ({ kind: 'moveTo', x, y });
const penUpCmd  = (): CanvasCommand => ({ kind: 'penUp' });
const penDownCmd = (): CanvasCommand => ({ kind: 'penDown' });

/** Round all numeric fields to 10 decimal places and normalise -0 to 0. */
function roundNum(n: number): number {
  const r = +n.toFixed(10);
  return r === 0 ? 0 : r;  // coerce -0 → 0
}
function roundCmd(c: CanvasCommand): CanvasCommand {
  if (c.kind === 'lineTo' || c.kind === 'moveTo') {
    return { kind: c.kind, x: roundNum(c.x), y: roundNum(c.y) };
  }
  return c;
}
const roundCmds = (cmds: CanvasCommand[]) => cmds.map(roundCmd);

// ---------------------------------------------------------------------------
// 1. render(EMPTY) → []
// ---------------------------------------------------------------------------
describe('render(EMPTY)', () => {
  it('returns an empty command list', () => {
    expect(render(EMPTY)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. render(forward(100)) with pen down → lineTo(0, -100)
//    heading 0 = north; sin(0)=0, cos(0)=1 → dx=0, dy=-100
// ---------------------------------------------------------------------------
describe('render(forward(100))', () => {
  it('emits lineTo(0, -100) when pen is down (default)', () => {
    expect(render(mkForward(100))).toEqual([lineTo(0, -100)]);
  });
});

// ---------------------------------------------------------------------------
// 3. sequence([forward(100), turn(90), forward(100)]) → right-angle path
//    After turn(90) heading = 90 (east): sin(90°)=1, cos(90°)=0 → dx=100, dy=0
// ---------------------------------------------------------------------------
describe('render(sequence([forward(100), turn(90), forward(100)]))', () => {
  it('produces a right-angle L-shaped path', () => {
    const drawing = mkSequence([mkForward(100), mkTurn(90), mkForward(100)]);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -100),   // heading 0 (north), forward 100
      lineTo(100, -100), // heading 90 (east), forward 100
    ]);
  });
});

// ---------------------------------------------------------------------------
// 4. penUp emits penUp command; subsequent forward emits moveTo not lineTo
// ---------------------------------------------------------------------------
describe('render(penUp)', () => {
  it('emits a penUp command', () => {
    expect(render(PEN_UP)).toEqual([penUpCmd()]);
  });

  it('subsequent forward emits moveTo when pen is up', () => {
    const drawing = mkSequence([PEN_UP, mkForward(50)]);
    expect(render(drawing)).toEqual([
      penUpCmd(),
      moveTo(0, -50),
    ]);
  });
});

// ---------------------------------------------------------------------------
// 5. turn(90) + forward(100) → heading east → lineTo(100, 0)
// ---------------------------------------------------------------------------
describe('render(sequence([turn(90), forward(100)]))', () => {
  it('heading 90° (east) → dx=100, dy=0 → lineTo(100, 0)', () => {
    const drawing = mkSequence([mkTurn(90), mkForward(100)]);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([lineTo(100, 0)]);
  });
});

// ---------------------------------------------------------------------------
// 6. measure(EMPTY) → { width: 0, height: 0 }
// ---------------------------------------------------------------------------
describe('measure(EMPTY)', () => {
  it('returns zero bounding box', () => {
    expect(measure(EMPTY)).toEqual({ width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// 7. measure(forward(100)) → { width: 0, height: 100 }
//    Straight north: x stays 0, y goes 0 → -100; height = |0 - (-100)| = 100
// ---------------------------------------------------------------------------
describe('measure(forward(100))', () => {
  it('returns { width: 0, height: 100 }', () => {
    const result = measure(mkForward(100));
    expect(result.width).toBeCloseTo(0, 10);
    expect(result.height).toBeCloseTo(100, 10);
  });
});

// ---------------------------------------------------------------------------
// 8. render(beside(left, right)) — right drawing starts after left's bounding width
//    left  = sequence([turn(90), forward(50)])   → goes east 50px; width=50, height=0
//    right = sequence([turn(-90), forward(40)])  → heading resets to 0 (north) from (50, 0)
//
// Note: heading carries over from the end of left's rendering (heading=90, east).
// right starts at x=50, y=0 (the measured width of left) and with heading=90.
// right does turn(-90) → heading=0 (north), then forward(40) → lineTo(50, -40).
// ---------------------------------------------------------------------------
describe('render(beside(left, right))', () => {
  it('right drawing starts at x = left bounding width, heading carries over', () => {
    // left: turn east then forward 50 → ends at (50, 0), width=50; heading=90 carries over
    const left = mkSequence([mkTurn(90), mkForward(50)]);
    // right: turn back north (-90°), then forward 40 from (50, 0) → lineTo(50, -40)
    const right = mkSequence([mkTurn(-90), mkForward(40)]);
    const drawing = mkBeside(left, right);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(50, 0),   // left arm: east 50
      lineTo(50, -40), // right arm: north 40 from (50, 0)
    ]);
  });

  it('simple beside: two north-facing strokes side by side', () => {
    // left: forward(60) north from (0,0) → width=0, height=60; width is 0
    // right starts at (0+0=0, 0) — same origin; but left's x-width is 0.
    // Instead, use side-by-side east strokes to get non-zero width:
    //   left: forward(80) east → width=80; right: forward(30) north from (80, 0)
    const left = mkSequence([mkTurn(90), mkForward(80)]); // width=80; heading=90 remains
    // right starts at (80, 0) with heading=90; turn(-90) → north; forward(30) → lineTo(80, -30)
    const right = mkSequence([mkTurn(-90), mkForward(30)]);
    const result = roundCmds(render(mkBeside(left, right)));
    expect(result).toEqual([
      lineTo(80, 0),   // left east 80
      lineTo(80, -30), // right north 30 from (80, 0)
    ]);
  });
});

// ---------------------------------------------------------------------------
// 9. render(scale(2, forward(100))) → equivalent to render(forward(200))
// ---------------------------------------------------------------------------
describe('render(scale(2, forward(100)))', () => {
  it('doubles the forward distance', () => {
    expect(render(mkScale(2, mkForward(100)))).toEqual([lineTo(0, -200)]);
  });
});

// ---------------------------------------------------------------------------
// Additional: penDown re-enables pen after penUp
// ---------------------------------------------------------------------------
describe('penUp + penDown round-trip', () => {
  it('moveTo while pen up, lineTo after penDown', () => {
    const drawing = mkSequence([PEN_UP, mkForward(30), PEN_DOWN, mkForward(30)]);
    expect(render(drawing)).toEqual([
      penUpCmd(),
      moveTo(0, -30),
      penDownCmd(),
      lineTo(0, -60),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Additional: render(above(top, bottom)) — bottom starts after top's bounding height
// ---------------------------------------------------------------------------
describe('render(above(top, bottom))', () => {
  it('bottom drawing starts at y = top bounding height', () => {
    // top: forward north 50 → ends at (0,-50); height=50
    const top = mkForward(50);
    // bottom: turn east + forward 30, starting from (0, 50) in canvas coords
    //   (originY + topHeight = 0 + 50 = 50; turtle y reset to 50)
    //   turn east: heading=90; forward 30 → dx=30, dy=0 → lineTo(30, 50)
    const bottom = mkSequence([mkTurn(90), mkForward(30)]);
    const drawing = mkAbove(top, bottom);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -50),  // top forward north
      lineTo(30, 50),  // bottom: east from (0, 50)
    ]);
  });
});

// ---------------------------------------------------------------------------
// Additional: scale is composable with sequence
// ---------------------------------------------------------------------------
describe('scale with sequence', () => {
  it('scales all forward steps in a sequence', () => {
    const drawing = mkScale(3, mkSequence([mkForward(10), mkTurn(90), mkForward(10)]));
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -30),  // forward(30) north
      lineTo(30, -30), // forward(30) east
    ]);
  });
});

// ---------------------------------------------------------------------------
// Additional: measure(sequence([turn(90), forward(100)])) → { width: 100, height: 0 }
// ---------------------------------------------------------------------------
describe('measure heading east', () => {
  it('returns { width: 100, height: 0 } for a purely eastward line', () => {
    const result = measure(mkSequence([mkTurn(90), mkForward(100)]));
    expect(result.width).toBeCloseTo(100, 10);
    expect(result.height).toBeCloseTo(0, 10);
  });
});

// ---------------------------------------------------------------------------
// Additional: turn wraps around correctly at 360
// ---------------------------------------------------------------------------
describe('heading wraps at 360', () => {
  it('turn(360) brings heading back to north', () => {
    // turn 360 then forward 100 → same as forward 100 (north)
    const drawing = mkSequence([mkTurn(360), mkForward(100)]);
    expect(render(drawing)).toEqual([lineTo(0, -100)]);
  });

  it('turn(-90) turns west', () => {
    // turn(-90) → heading = 270 (west); sin(270°)=-1, cos(270°)=0 → dx=-100, dy=0
    const drawing = mkSequence([mkTurn(-90), mkForward(100)]);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([lineTo(-100, 0)]);
  });
});
