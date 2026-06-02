import { useEffect, useRef } from 'react';
import type { CanvasCommand } from '@sprout/lang';

const W = 500;
const H = 500;

interface Props {
  commands: CanvasCommand[];
}

export function Stage({ commands }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    if (commands.length === 0) return;

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    // Turtle origin is (0,0); map to canvas center.
    ctx.moveTo(W / 2, H / 2);

    for (const cmd of commands) {
      switch (cmd.kind) {
        case 'moveTo':
          ctx.moveTo(W / 2 + cmd.x, H / 2 + cmd.y);
          break;
        case 'lineTo':
          ctx.lineTo(W / 2 + cmd.x, H / 2 + cmd.y);
          break;
        case 'penDown':
        case 'penUp':
          // moveTo/lineTo already encode pen state; these commands are no-ops for canvas.
          break;
      }
    }
    ctx.stroke();
  }, [commands]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 4,
        background: '#fff',
        display: 'block',
      }}
    />
  );
}
