import { useRef, useCallback } from 'react';
import { interpret, render, SproutRuntimeError } from '@sprout/lang';
import type { Program } from '@sprout/lang';

interface Props {
  program: Program | null;
}

const W = 400;
const H = 400;

export default function Stage({ program }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const runProgram = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    if (!program) {
      ctx.fillStyle = '#999';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No program', W / 2, H / 2);
      return;
    }

    try {
      const drawing = interpret(program);
      const commands = render(drawing);

      if (errorRef.current) errorRef.current.textContent = '';

      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Renderer coords: x right, y down, origin = turtle start (0,0).
      // Canvas offset: turtle starts at canvas centre (W/2, H/2).
      const cx = (rx: number) => W / 2 + rx;
      const cy = (ry: number) => H / 2 + ry;

      ctx.beginPath();
      ctx.moveTo(cx(0), cy(0));

      for (const cmd of commands) {
        switch (cmd.kind) {
          case 'moveTo':
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx(cmd.x), cy(cmd.y));
            break;
          case 'lineTo':
            ctx.lineTo(cx(cmd.x), cy(cmd.y));
            break;
          case 'penUp':
          case 'penDown':
            break;
        }
      }
      ctx.stroke();
    } catch (err: unknown) {
      if (errorRef.current) {
        errorRef.current.textContent =
          err instanceof SproutRuntimeError ? `Error: ${err.message}` : 'Runtime error';
      }
    }
  }, [program]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fafafa' }}>
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid #ddd',
        flexShrink: 0,
        background: '#fff',
      }}>
        <button
          onClick={runProgram}
          style={{
            padding: '4px 16px',
            background: program ? '#22c55e' : '#d1d5db',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontWeight: 600,
            fontSize: 13,
            cursor: program ? 'pointer' : 'default',
          }}
        >
          ▶ Run
        </button>
        <span ref={errorRef} style={{ fontSize: 12, color: '#ef4444' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            background: '#fff',
            maxWidth: '100%',
          }}
        />
      </div>
    </div>
  );
}
