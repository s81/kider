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
