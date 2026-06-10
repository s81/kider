import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawUpTo, getTurtleState, buildPlayback, STAGE_W, STAGE_H } from '../src/stage-utils.js';
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

  it('setColor flushes current path and begins a new one with new strokeStyle', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'moveTo', x: 0, y: -100 },
      { kind: 'lineTo', x: 100, y: -100 },
    ];
    drawUpTo(ctx, commands, 4);
    // stroke called twice: once on setColor, once at end
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    // beginPath called twice: once initial setup, once on setColor
    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
    // strokeStyle ends with the new color
    expect(ctx.strokeStyle).toBe('#dc2626');
  });

  it('setColor at limit boundary stops before flushing if not reached', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'setColor', color: '#dc2626' },
      { kind: 'lineTo', x: 100, y: -100 },
    ];
    // limit=1: only the first lineTo, no setColor
    drawUpTo(ctx, commands, 1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1); // only final stroke
    expect(ctx.strokeStyle).toBe('#2563eb'); // default color unchanged
  });

  it('setLineWidth flushes current path and begins a new one with new lineWidth', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'setLineWidth', width: 4 },
      { kind: 'moveTo', x: 0, y: -100 },
      { kind: 'lineTo', x: 100, y: -100 },
    ];
    drawUpTo(ctx, commands, 4);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
    expect(ctx.lineWidth).toBe(4);
  });

  it('setLineWidth at limit boundary stops before flushing if not reached', () => {
    const commands: CanvasCommand[] = [
      { kind: 'lineTo', x: 0, y: -100 },
      { kind: 'setLineWidth', width: 4 },
      { kind: 'lineTo', x: 100, y: -100 },
    ];
    drawUpTo(ctx, commands, 1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.lineWidth).toBe(2); // default lineWidth unchanged
  });
});

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

// ---------------------------------------------------------------------------
// Shape drawing
// ---------------------------------------------------------------------------

function makeShapeMockCtx() {
  let globalAlphaValue = 1;
  let fillStyleValue: string = '';
  let fontValue: string = '';
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    ellipse: vi.fn(),
    closePath: vi.fn(),
    fillText: vi.fn(),
    get globalAlpha() { return globalAlphaValue; },
    set globalAlpha(v: number) { globalAlphaValue = v; },
    get fillStyle() { return fillStyleValue; },
    set fillStyle(v: string) { fillStyleValue = v; },
    get font() { return fontValue; },
    set font(v: string) { fontValue = v; },
    strokeStyle: '#2563eb' as CanvasRenderingContext2D['strokeStyle'],
    lineWidth: 2,
    lineCap: 'round' as CanvasRenderingContext2D['lineCap'],
    lineJoin: 'round' as CanvasRenderingContext2D['lineJoin'],
  } as unknown as CanvasRenderingContext2D;
}

describe('shape drawing', () => {
  it('drawCircle calls arc with correct center and radius', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawCircle', x: 0, y: 0, radius: 50 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.arc).toHaveBeenCalledWith(STAGE_W / 2, STAGE_H / 2, 50, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('drawCircle offsets by turtle position', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawCircle', x: 20, y: -30, radius: 10 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.arc).toHaveBeenCalledWith(STAGE_W / 2 + 20, STAGE_H / 2 - 30, 10, 0, Math.PI * 2);
  });

  it('drawRect calls rect with correct centered bounds', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawRect', x: 0, y: 0, width: 80, height: 40 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.rect).toHaveBeenCalledWith(STAGE_W / 2 - 40, STAGE_H / 2 - 20, 80, 40);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('drawEllipse calls ellipse with correct radii', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawEllipse', x: 0, y: 0, rx: 60, ry: 30 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.ellipse).toHaveBeenCalledWith(STAGE_W / 2, STAGE_H / 2, 60, 30, 0, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('drawTriangle calls moveTo/lineTo for triangle vertices', () => {
    const ctx = makeShapeMockCtx();
    const size = 60;
    const commands: CanvasCommand[] = [{ kind: 'drawTriangle', x: 0, y: 0, size }];
    drawUpTo(ctx, commands, 1);
    const cx = STAGE_W / 2;
    const cy = STAGE_H / 2;
    const tipY  = size * Math.sqrt(3) / 3;
    const baseY = size * Math.sqrt(3) / 6;
    const halfW = size / 2;
    expect(ctx.moveTo).toHaveBeenCalledWith(cx, cy - tipY);
    expect(ctx.lineTo).toHaveBeenCalledWith(cx + halfW, cy + baseY);
    expect(ctx.lineTo).toHaveBeenCalledWith(cx - halfW, cy + baseY);
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe('polygon drawing', () => {
  it('drawPolygon with n=4, size=80 calls moveTo/lineTo for 4 vertices, fill, closePath', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawPolygon', x: 0, y: 0, n: 4, size: 80 }];
    drawUpTo(ctx, commands, 1);
    // fill must be called (semi-transparent fill pass)
    expect(ctx.fill).toHaveBeenCalled();
    // closePath must be called (closes polygon path)
    expect(ctx.closePath).toHaveBeenCalled();
    // 4 vertices → 1 moveTo (first vertex) + 3 lineTo (remaining vertices)
    // Note: additional moveTo calls from setup and turtle reset are also present.
    expect(ctx.lineTo).toHaveBeenCalledTimes(3);
    // stroke must be called for the outline pass
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('drawPolygon offsets vertices by turtle position', () => {
    const ctx = makeShapeMockCtx();
    const n = 4;
    const size = 80;
    const ox = 30;
    const oy = -20;
    const commands: CanvasCommand[] = [{ kind: 'drawPolygon', x: ox, y: oy, n, size }];
    drawUpTo(ctx, commands, 1);
    const cx = STAGE_W / 2 + ox;
    const cy = STAGE_H / 2 + oy;
    const R = size / (2 * Math.sin(Math.PI / n));
    // First vertex: k=0 → angle = -π/2 → x=cx+R*cos(-π/2)≈cx, y=cy+R*sin(-π/2)=cy-R (top)
    const v0x = cx + R * Math.cos(-Math.PI / 2);
    const v0y = cy + R * Math.sin(-Math.PI / 2);
    expect(ctx.moveTo).toHaveBeenCalledWith(expect.closeTo(v0x, 5), expect.closeTo(v0y, 5));
  });
});

describe('text drawing', () => {
  it('drawText calls fillText with correct canvas-offset position', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawText', x: 10, y: -20, str: 'hello', size: 24 }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.fillText).toHaveBeenCalledWith('hello', STAGE_W / 2 + 10, STAGE_H / 2 - 20);
  });

  it('drawText sets fillStyle to strokeStyle before drawing', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'drawText', x: 0, y: 0, str: 'hi', size: 16 }];
    drawUpTo(ctx, commands, 1);
    expect((ctx as unknown as { fillStyle: string }).fillStyle).toBe('#2563eb');
    expect((ctx as unknown as { font: string }).font).toBe('16px sans-serif');
  });

  it('drawText sets fillStyle before calling fillText', () => {
    const ctx = makeShapeMockCtx();
    let fillStyleAtCall = '';
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(() => {
      fillStyleAtCall = (ctx as unknown as { fillStyle: string }).fillStyle;
    });
    const commands: CanvasCommand[] = [{ kind: 'drawText', x: 0, y: 0, str: 'hi', size: 16 }];
    drawUpTo(ctx, commands, 1);
    expect(fillStyleAtCall).toBe('#2563eb');
  });
});

describe('background drawing', () => {
  it('fillBackground calls ctx.fillRect(0, 0, STAGE_W, STAGE_H)', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'fillBackground', color: '#dc2626' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, STAGE_W, STAGE_H);
  });

  it('fillBackground sets fillStyle to the given color', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'fillBackground', color: '#ff4400' }];
    drawUpTo(ctx, commands, 1);
    expect((ctx as unknown as { fillStyle: string }).fillStyle).toBe('#ff4400');
  });

  it('fillBackground flushes path and restores state', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'fillBackground', color: '#dc2626' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
  });
});

describe('clearCanvas drawing', () => {
  it('clearCanvas calls ctx.stroke() before clearRect', () => {
    const ctx = makeShapeMockCtx();
    let strokeCalledBeforeClear = false;
    let clearRectCallCount = 0;
    (ctx.stroke as ReturnType<typeof vi.fn>).mockImplementation(() => {
      strokeCalledBeforeClear = true;
    });
    (ctx.clearRect as ReturnType<typeof vi.fn>).mockImplementation(() => {
      clearRectCallCount++;
      // Only check on the second call — the first is the initial canvas wipe at the top of drawUpTo
      if (clearRectCallCount >= 2) {
        expect(strokeCalledBeforeClear).toBe(true);
      }
    });
    const commands: CanvasCommand[] = [{ kind: 'clearCanvas' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
  });

  it('clearCanvas calls ctx.clearRect(0, 0, STAGE_W, STAGE_H)', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'clearCanvas' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, STAGE_W, STAGE_H);
  });

  it('clearCanvas calls ctx.beginPath() and ctx.moveTo(STAGE_W/2, STAGE_H/2)', () => {
    const ctx = makeShapeMockCtx();
    const commands: CanvasCommand[] = [{ kind: 'clearCanvas' }];
    drawUpTo(ctx, commands, 1);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(STAGE_W / 2, STAGE_H / 2);
  });
});

describe('buildPlayback — sound segments', () => {
  const drawCmd = (i: number): CanvasCommand => ({ kind: 'lineTo', x: i, y: i });

  it('sound in middle → [draw, sound, draw] with frequency carried through', () => {
    const cmds: CanvasCommand[] = [
      drawCmd(0),
      { kind: 'sound', frequency: 440, durationMs: 500 },
      drawCmd(2),
    ];
    expect(buildPlayback(cmds)).toEqual([
      { kind: 'draw', upTo: 0 },
      { kind: 'sound', frequency: 440, durationMs: 500 },
      { kind: 'draw', upTo: 2 },
    ]);
  });

  it('consecutive sounds each become their own segment (melody)', () => {
    const cmds: CanvasCommand[] = [
      { kind: 'sound', frequency: 262, durationMs: 300 },
      { kind: 'sound', frequency: 330, durationMs: 300 },
      { kind: 'sound', frequency: 392, durationMs: 300 },
    ];
    expect(buildPlayback(cmds)).toEqual([
      { kind: 'sound', frequency: 262, durationMs: 300 },
      { kind: 'sound', frequency: 330, durationMs: 300 },
      { kind: 'sound', frequency: 392, durationMs: 300 },
    ]);
  });

  it('mixed wait and sound keep their order', () => {
    const cmds: CanvasCommand[] = [
      drawCmd(0),
      { kind: 'wait', durationMs: 100 },
      { kind: 'sound', frequency: 880, durationMs: 200 },
    ];
    expect(buildPlayback(cmds)).toEqual([
      { kind: 'draw', upTo: 0 },
      { kind: 'wait', durationMs: 100 },
      { kind: 'sound', frequency: 880, durationMs: 200 },
    ]);
  });
});
