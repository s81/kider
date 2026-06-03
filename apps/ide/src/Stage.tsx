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
