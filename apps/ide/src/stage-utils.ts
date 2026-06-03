import type { CanvasCommand } from '@sprout/lang';

export const STAGE_W = 500;
export const STAGE_H = 500;

export interface TurtleState {
  x: number;
  y: number;
  /** Degrees clockwise from north: 0=up, 90=right, 180=down, 270=left */
  heading: number;
}

export function getTurtleState(commands: CanvasCommand[], limit: number): TurtleState {
  let x = 0;
  let y = 0;
  let heading = 0;

  const end = Math.min(limit, commands.length);
  for (let i = 0; i < end; i++) {
    const cmd = commands[i];
    if (cmd.kind === 'moveTo' || cmd.kind === 'lineTo') {
      if (cmd.x !== x || cmd.y !== y) {
        const dx = cmd.x - x;
        const dy = cmd.y - y;
        heading = ((Math.atan2(dx, -dy) * 180 / Math.PI) % 360 + 360) % 360;
        x = cmd.x;
        y = cmd.y;
      }
    }
  }

  return { x, y, heading };
}

export function drawUpTo(
  ctx: CanvasRenderingContext2D,
  commands: CanvasCommand[],
  limit: number,
): void {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  if (limit === 0) return;

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(STAGE_W / 2, STAGE_H / 2);

  for (let i = 0; i < limit; i++) {
    const cmd = commands[i];
    switch (cmd.kind) {
      case 'moveTo':
        ctx.moveTo(STAGE_W / 2 + cmd.x, STAGE_H / 2 + cmd.y);
        break;
      case 'lineTo':
        ctx.lineTo(STAGE_W / 2 + cmd.x, STAGE_H / 2 + cmd.y);
        break;
      case 'setColor':
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = cmd.color;
        break;
      case 'setLineWidth':
        ctx.stroke();
        ctx.beginPath();
        ctx.lineWidth = cmd.width;
        break;
      case 'penDown':
      case 'penUp':
        break;
    }
  }
  ctx.stroke();
}
