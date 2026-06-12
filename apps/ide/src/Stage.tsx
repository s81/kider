import { useEffect, useRef } from 'react';
import type { CanvasCommand, SpriteSnapshot } from '@sprout/lang';
import { drawUpTo, drawSprites, getTurtleState, drawTurtle, STAGE_W, STAGE_H } from './stage-utils.js';

interface Props {
  commands: CanvasCommand[];
  animated?: boolean;
  stepsPerFrame?: number;
  drawLimit?: number | null;
  onClick?: () => void;
  onMouseMove?: (x: number, y: number) => void;
  hud?: Record<string, string>;
  sprites?: readonly SpriteSnapshot[];
  /** Called with the 1-based source line of the command just drawn, or null to clear. */
  onActiveLine?: (line: number | null) => void;
}

export function Stage({
  commands,
  animated = false,
  stepsPerFrame = 3,
  drawLimit = null,
  onClick,
  onMouseMove,
  hud,
  sprites = [],
  onActiveLine,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Most-recently emitted line, so steps that have no `line` (or no command emitted) don't flicker.
  const lastLine = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    if (drawLimit !== null) {
      const limit = drawLimit;
      drawUpTo(ctx, commands, limit);
      drawSprites(ctx, sprites);
      drawTurtle(ctx, getTurtleState(commands, limit));
      const line = (commands[limit - 1] as { line?: number } | undefined)?.line;
      if (line !== undefined && line !== lastLine.current) {
        lastLine.current = line;
        onActiveLine?.(line);
      }
      return;
    }

    if (!animated || commands.length === 0) {
      const limit = commands.length;
      drawUpTo(ctx, commands, limit);
      drawSprites(ctx, sprites);
      drawTurtle(ctx, getTurtleState(commands, limit));
      lastLine.current = null;
      onActiveLine?.(null);
      return;
    }

    let step = 0;
    let rafId = 0;

    function tick() {
      step = Math.min(step + stepsPerFrame, commands.length);
      drawUpTo(ctx, commands, step);
      drawSprites(ctx, sprites);
      drawTurtle(ctx, getTurtleState(commands, step));
      const line = (commands[step - 1] as { line?: number } | undefined)?.line;
      if (line !== undefined && line !== lastLine.current) {
        lastLine.current = line;
        onActiveLine?.(line);
      }
      if (step < commands.length) {
        rafId = requestAnimationFrame(tick);
      } else {
        lastLine.current = null;
        onActiveLine?.(null);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      lastLine.current = null;
      onActiveLine?.(null);
    };
  }, [commands, animated, stepsPerFrame, drawLimit, sprites, onActiveLine]);

  const hudEntries = hud ? Object.entries(hud) : [];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={STAGE_W}
        height={STAGE_H}
        onClick={onClick}
        onMouseMove={onMouseMove ? (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onMouseMove(e.clientX - rect.left - STAGE_W / 2, e.clientY - rect.top - STAGE_H / 2);
        } : undefined}
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          background: '#fff',
          display: 'block',
          cursor: onClick ? 'crosshair' : 'default',
        }}
      />
      {hudEntries.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'rgba(0,0,0,0.55)',
          borderRadius: 4,
          padding: '4px 8px',
          color: '#20c997',
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: '1.6',
          pointerEvents: 'none',
        }}>
          {hudEntries.map(([label, value]) => (
            <div key={label}>{label}: {value}</div>
          ))}
        </div>
      )}
    </div>
  );
}
