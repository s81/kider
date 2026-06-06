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
  mkColor,
  mkPenWidth,
  mkPolygon,
  mkText,
  mkBackground,
  mkClearCanvas,
  mkStamp,
  mkArc,
  mkGoto,
  mkHome,
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
  if (c.kind === 'drawCircle')   return { ...c, x: roundNum(c.x), y: roundNum(c.y) };
  if (c.kind === 'drawRect')     return { ...c, x: roundNum(c.x), y: roundNum(c.y) };
  if (c.kind === 'drawEllipse')  return { ...c, x: roundNum(c.x), y: roundNum(c.y) };
  if (c.kind === 'drawTriangle') return { ...c, x: roundNum(c.x), y: roundNum(c.y) };
  if (c.kind === 'drawPolygon')  return { ...c, x: roundNum(c.x), y: roundNum(c.y) };
  if (c.kind === 'drawText')     return { ...c, x: roundNum(c.x), y: roundNum(c.y) };
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
// Additional: render(above(top, bottom)) — bottom starts at maxY of top from origin
// ---------------------------------------------------------------------------
describe('render(above(top, bottom))', () => {
  it('bottom drawing starts at y = maxY of top (downward extent from origin)', () => {
    // top: turn 180 (south) + forward 50 → ends at (0, 50); maxY=50
    // bottomOffset = max(0, maxY=50) = 50
    // bottom starts at (0, 50) with heading=180 (south, carried from top).
    // bottom: turn(-90) → heading=90 (east); forward 30 → lineTo(30, 50)
    const top = mkSequence([mkTurn(180), mkForward(50)]);
    const bottom = mkSequence([mkTurn(-90), mkForward(30)]);
    const drawing = mkAbove(top, bottom);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, 50),   // top: south 50 from origin
      lineTo(30, 50),  // bottom: east 30 from (0, 50)
    ]);
  });

  it('above with top going north only: bottom starts at origin y (maxY=0)', () => {
    // top: forward 50 north → ends at (0,-50); maxY stays 0 (never went down)
    // bottomOffset = max(0, 0) = 0 → bottom starts at y=0 (origin)
    // heading 0 carries over from top. bottom: turn(90) east, forward 30 → lineTo(30, 0)
    const top = mkForward(50);
    const bottom = mkSequence([mkTurn(90), mkForward(30)]);
    const drawing = mkAbove(top, bottom);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -50), // top: north 50
      lineTo(30, 0),  // bottom: east 30 from (0, 0) — maxY of top is 0
    ]);
  });
});

// ---------------------------------------------------------------------------
// Additional: beside bug fix — left going north has maxX=0, right starts at origin x
// ---------------------------------------------------------------------------
describe('beside: left child going north (maxX=0)', () => {
  it('right child starts at x=0 when left only goes north', () => {
    // left: forward 100 north → ends at (0, -100); maxX = 0
    // rightOffset = max(0, maxX=0) = 0 → right starts at x=0, y=0, heading=0 (carried)
    // right: turn(90) east + forward 50 → heading=90, forward 50 → lineTo(50, 0)
    const left = mkForward(100);
    const right = mkSequence([mkTurn(90), mkForward(50)]);
    const result = roundCmds(render(mkBeside(left, right)));
    expect(result).toEqual([
      lineTo(0, -100), // left: north 100
      lineTo(50, 0),   // right: east 50 from (0, 0) — maxX of left is 0
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

// ---------------------------------------------------------------------------
// color Drawing node in renderer
// ---------------------------------------------------------------------------
describe('render(color)', () => {
  it('color alone emits setColor + moveTo at origin', () => {
    expect(render(mkColor('#dc2626'))).toEqual([
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('forward + color + forward emits setColor and moveTo re-anchor', () => {
    const drawing = mkSequence([
      mkForward(100),
      mkColor('#dc2626'),
      mkForward(50),
    ]);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -100),
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'moveTo', x: 0, y: -100 },
      lineTo(0, -150),
    ]);
  });

  it('color does not affect bounding box — measure ignores it', () => {
    const drawing = mkSequence([mkColor('#dc2626'), mkForward(100)]);
    const result = measure(drawing);
    expect(result.height).toBeCloseTo(100, 10);
    expect(result.width).toBeCloseTo(0, 10);
  });

  it('scale passes color through unchanged', () => {
    const drawing = mkScale(2, mkSequence([mkForward(10), mkColor('#dc2626'), mkForward(10)]));
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -20),
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'moveTo', x: 0, y: -20 },
      lineTo(0, -40),
    ]);
  });
});

// ---------------------------------------------------------------------------
// penWidth Drawing node in renderer
// ---------------------------------------------------------------------------
describe('render(penWidth)', () => {
  it('penWidth alone emits setLineWidth + moveTo at origin', () => {
    expect(render(mkPenWidth(4))).toEqual([
      { kind: 'setLineWidth', width: 4 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('forward + penWidth + forward emits setLineWidth and moveTo re-anchor', () => {
    const drawing = mkSequence([
      mkForward(100),
      mkPenWidth(4),
      mkForward(50),
    ]);
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -100),
      { kind: 'setLineWidth', width: 4 },
      { kind: 'moveTo', x: 0, y: -100 },
      lineTo(0, -150),
    ]);
  });

  it('penWidth does not affect bounding box — measure ignores it', () => {
    const drawing = mkSequence([mkPenWidth(4), mkForward(100)]);
    const result = measure(drawing);
    expect(result.height).toBeCloseTo(100, 10);
    expect(result.width).toBeCloseTo(0, 10);
  });

  it('scale does not scale penWidth — width passes through unchanged', () => {
    const drawing = mkScale(2, mkSequence([mkForward(10), mkPenWidth(3), mkForward(10)]));
    const result = roundCmds(render(drawing));
    expect(result).toEqual([
      lineTo(0, -20),
      { kind: 'setLineWidth', width: 3 },
      { kind: 'moveTo', x: 0, y: -20 },
      lineTo(0, -40),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Shape rendering
// ---------------------------------------------------------------------------

describe('shape rendering', () => {
  it('render(circle(50)) emits drawCircle at origin + moveTo', () => {
    expect(render({ kind: 'circle', radius: 50 })).toEqual([
      { kind: 'drawCircle', x: 0, y: 0, radius: 50 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('render(rect(80, 40)) emits drawRect at origin + moveTo', () => {
    expect(render({ kind: 'rect', width: 80, height: 40 })).toEqual([
      { kind: 'drawRect', x: 0, y: 0, width: 80, height: 40 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('render(ellipse(60, 30)) emits drawEllipse at origin + moveTo', () => {
    expect(render({ kind: 'ellipse', rx: 60, ry: 30 })).toEqual([
      { kind: 'drawEllipse', x: 0, y: 0, rx: 60, ry: 30 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('render(triangle(50)) emits drawTriangle at origin + moveTo', () => {
    expect(render({ kind: 'triangle', size: 50 })).toEqual([
      { kind: 'drawTriangle', x: 0, y: 0, size: 50 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('shape position tracks turtle — forward then circle', () => {
    expect(render({ kind: 'sequence', steps: [mkForward(100), { kind: 'circle', radius: 10 }] })).toEqual([
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'drawCircle', x: 0, y: -100, radius: 10 },
      { kind: 'moveTo', x: 0, y: -100 },
    ]);
  });

  it('measure(circle(50)) → { width: 100, height: 100 }', () => {
    expect(measure({ kind: 'circle', radius: 50 })).toEqual({ width: 100, height: 100 });
  });

  it('measure(rect(80, 40)) → { width: 80, height: 40 }', () => {
    expect(measure({ kind: 'rect', width: 80, height: 40 })).toEqual({ width: 80, height: 40 });
  });

  it('measure(ellipse(60, 30)) → { width: 120, height: 60 }', () => {
    expect(measure({ kind: 'ellipse', rx: 60, ry: 30 })).toEqual({ width: 120, height: 60 });
  });

  it('measure(triangle(60)) → correct width and height', () => {
    const size = 60;
    const result = measure({ kind: 'triangle', size });
    expect(result.width).toBeCloseTo(size, 5);
    expect(result.height).toBeCloseTo(size * Math.sqrt(3) / 2, 5);
  });

  it('scale(2) doubles circle radius', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: { kind: 'circle', radius: 10 } })).toEqual([
      { kind: 'drawCircle', x: 0, y: 0, radius: 20 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Polygon rendering
// ---------------------------------------------------------------------------

describe('polygon rendering', () => {
  it('render(polygon(6, 60)) emits drawPolygon at origin + moveTo', () => {
    expect(render(mkPolygon(6, 60))).toEqual([
      { kind: 'drawPolygon', x: 0, y: 0, n: 6, size: 60 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('measure(polygon(6, 60)) → tight vertex-based bbox', () => {
    // hexagon: R = 60 / (2 * sin(π/6)) = 60
    // vertex x range: ±R*cos(30°) = ±60*(√3/2) → width ≈ 103.92
    // vertex y range: ±R → height = 120 (top vertex at -π/2, bottom at +π/2)
    const result = measure(mkPolygon(6, 60));
    expect(result.width).toBeCloseTo(60 * Math.sqrt(3), 5);
    expect(result.height).toBeCloseTo(120, 5);
  });

  it('scaleDrawing(2) doubles size, n unchanged', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: mkPolygon(6, 30) })).toEqual([
      { kind: 'drawPolygon', x: 0, y: 0, n: 6, size: 60 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('shape position tracks turtle — forward then polygon', () => {
    const drawing = { kind: 'sequence' as const, steps: [mkForward(100), mkPolygon(4, 40)] };
    expect(render(drawing)).toEqual([
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'drawPolygon', x: 0, y: -100, n: 4, size: 40 },
      { kind: 'moveTo', x: 0, y: -100 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------

describe('text rendering', () => {
  it('render(text("hi", 20)) emits drawText at origin + moveTo', () => {
    expect(render(mkText('hi', 20))).toEqual([
      { kind: 'drawText', x: 0, y: 0, str: 'hi', size: 20 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('measure(text("hi", 20)) → width = 2 * 20 * 0.6, height = 20', () => {
    const result = measure(mkText('hi', 20));
    expect(result.width).toBeCloseTo(2 * 20 * 0.6, 5);
    expect(result.height).toBeCloseTo(20, 5);
  });

  it('scaleDrawing(2) doubles size, str unchanged', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: mkText('hi', 10) })).toEqual([
      { kind: 'drawText', x: 0, y: 0, str: 'hi', size: 20 },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('shape position tracks turtle — forward then text', () => {
    const drawing = { kind: 'sequence' as const, steps: [mkForward(100), mkText('hi', 20)] };
    expect(render(drawing)).toEqual([
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'drawText', x: 0, y: -100, str: 'hi', size: 20 },
      { kind: 'moveTo', x: 0, y: -100 },
    ]);
  });

  it('measure bbox verifies text grows upward from baseline', () => {
    // After forward(50), turtle is at y=-50. Text of size 20 should have:
    // - baseline at y=-50
    // - minY = -50 - 20 = -70 (text grows upward)
    // - maxY = -50 (baseline)
    // Sequence bounds: forward(50) goes from (0,0) to (0,-50) with maxY=0
    // Text at (0,-50) with size 20: minY=-70, maxY=-50
    // Overall bbox: minX=0, maxX=0.6*20*2≈24, minY=-70, maxY=0
    // Height should be 70 (from -70 to 0)
    const seq = mkSequence([mkForward(50), mkText('hi', 20)]);
    const result = measure(seq);
    expect(result.height).toBeCloseTo(70, 5);
    expect(result.width).toBeCloseTo(2 * 20 * 0.6, 5); // 'hi' = 2 chars, width per char = size * 0.6
  });
});

// ---------------------------------------------------------------------------
// background rendering
// ---------------------------------------------------------------------------
describe('background rendering', () => {
  it('render(background) emits fillBackground — no moveTo', () => {
    expect(render(mkBackground('#dc2626'))).toEqual([
      { kind: 'fillBackground', color: '#dc2626' },
    ]);
  });

  it('scale(2, background) leaves color unchanged', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: mkBackground('#2563eb') })).toEqual([
      { kind: 'fillBackground', color: '#2563eb' },
    ]);
  });

  it('sequence [background, forward] emits fillBackground then lineTo', () => {
    expect(render(mkSequence([mkBackground('#dc2626'), mkForward(50)]))).toEqual([
      { kind: 'fillBackground', color: '#dc2626' },
      { kind: 'lineTo', x: 0, y: -50 },
    ]);
  });

  it('measure(background) returns width=0, height=0', () => {
    expect(measure(mkBackground('#dc2626'))).toEqual({ width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// clearCanvas rendering
// ---------------------------------------------------------------------------
describe('clearCanvas rendering', () => {
  it('render(clearCanvas) emits clearCanvas then moveTo(0,0)', () => {
    expect(render(mkClearCanvas())).toEqual([
      { kind: 'clearCanvas' },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('sequence [forward(50), clearCanvas, forward(30)] — second forward restarts from (0,0)', () => {
    expect(render(mkSequence([mkForward(50), mkClearCanvas(), mkForward(30)]))).toEqual([
      { kind: 'lineTo', x: 0, y: -50 },
      { kind: 'clearCanvas' },
      { kind: 'moveTo', x: 0, y: 0 },
      { kind: 'lineTo', x: 0, y: -30 },
    ]);
  });

  it('scale(2, clearCanvas) leaves it unchanged', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: mkClearCanvas() })).toEqual([
      { kind: 'clearCanvas' },
      { kind: 'moveTo', x: 0, y: 0 },
    ]);
  });

  it('measure(clearCanvas) returns width=0, height=0', () => {
    expect(measure(mkClearCanvas())).toEqual({ width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// stamp rendering
// ---------------------------------------------------------------------------
describe('stamp rendering', () => {
  it('emits drawStamp at origin with default heading', () => {
    expect(render(mkStamp())).toContainEqual(
      { kind: 'drawStamp', x: 0, y: 0, heading: 0 }
    );
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

// ---------------------------------------------------------------------------
// arc rendering
// ---------------------------------------------------------------------------
describe('render(mkArc)', () => {
  it('produces lineTo commands when pen is down', () => {
    const cmds = render(mkArc(100, 90));
    const lineToCount = cmds.filter(c => c.kind === 'lineTo').length;
    // 90/5 = 18 steps, each produces a lineTo
    expect(lineToCount).toBe(18);
  });

  it('produces moveTo commands when pen is up', () => {
    const cmds = render(mkSequence([PEN_UP, mkArc(100, 90)]));
    const lineToCount = cmds.filter(c => c.kind === 'lineTo').length;
    expect(lineToCount).toBe(0);
    // should have moveTo commands for each arc step
    const moveToCount = cmds.filter(c => c.kind === 'moveTo').length;
    expect(moveToCount).toBeGreaterThan(0);
  });

  it('uses at least 4 steps for small angles', () => {
    // angle=1 would give 1 step via round(1/5)=0, but min 4 is enforced
    const cmds = render(mkArc(100, 1));
    const lineToCount = cmds.filter(c => c.kind === 'lineTo').length;
    expect(lineToCount).toBe(4);
  });

  it('negative angle (clockwise) also produces arc steps', () => {
    const cmds = render(mkArc(100, -90));
    const lineToCount = cmds.filter(c => c.kind === 'lineTo').length;
    expect(lineToCount).toBe(18);
  });

  it('arc(100, 0) renders nothing (zero angle guard)', () => {
    const cmds = render(mkArc(100, 0));
    const lineToCount = cmds.filter(c => c.kind === 'lineTo').length;
    expect(lineToCount).toBe(0);
  });

  it('arc(0, 90) renders nothing (zero radius guard)', () => {
    const cmds = render(mkArc(0, 90));
    const lineToCount = cmds.filter(c => c.kind === 'lineTo').length;
    expect(lineToCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// goto rendering
// ---------------------------------------------------------------------------
describe('goto rendering', () => {
  it('render(mkGoto(50, 100)) emits moveTo(50, 100)', () => {
    expect(render(mkGoto(50, 100))).toEqual([moveTo(50, 100)]);
  });

  it('goto does not draw a line even when pen is down', () => {
    const cmds = render(mkSequence([mkForward(50), mkGoto(10, 20)]));
    expect(cmds).toEqual([lineTo(0, -50), moveTo(10, 20)]);
  });

  it('sequence [forward(50), goto(0,0), forward(30)] continues from goto position', () => {
    const cmds = render(mkSequence([mkForward(50), mkGoto(0, 0), mkForward(30)]));
    expect(cmds).toEqual([lineTo(0, -50), moveTo(0, 0), lineTo(0, -30)]);
  });

  it('measure(mkGoto(50, 100)) returns width=0, height=0', () => {
    expect(measure(mkGoto(50, 100))).toEqual({ width: 0, height: 0 });
  });

  it('scale(2, goto) leaves coordinates unchanged', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: mkGoto(50, 100) })).toEqual([moveTo(50, 100)]);
  });
});

// ---------------------------------------------------------------------------
// home rendering
// ---------------------------------------------------------------------------
describe('home rendering', () => {
  it('render(mkHome()) emits moveTo(0, 0)', () => {
    expect(render(mkHome())).toEqual([moveTo(0, 0)]);
  });

  it('home resets position — forward after home starts from origin', () => {
    const cmds = render(mkSequence([mkForward(50), mkHome(), mkForward(30)]));
    expect(cmds).toEqual([lineTo(0, -50), moveTo(0, 0), lineTo(0, -30)]);
  });

  it('home resets heading — forward after home with prior turn goes north', () => {
    const cmds = render(mkSequence([mkTurn(90), mkHome(), mkForward(30)]));
    expect(cmds).toEqual([moveTo(0, 0), lineTo(0, -30)]);
  });

  it('measure(mkHome()) returns width=0, height=0', () => {
    expect(measure(mkHome())).toEqual({ width: 0, height: 0 });
  });

  it('scale(2, home) leaves it unchanged', () => {
    expect(render({ kind: 'scale', factor: 2, drawing: mkHome() })).toEqual([moveTo(0, 0)]);
  });
});
