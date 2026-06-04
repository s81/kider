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

const TURTLE_SIZE = 10;

export function drawTurtle(ctx: CanvasRenderingContext2D, state: TurtleState): void {
  const cx = STAGE_W / 2 + state.x;
  const cy = STAGE_H / 2 + state.y;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.heading * Math.PI / 180);

  ctx.beginPath();
  ctx.moveTo(0, -TURTLE_SIZE);                          // tip (up)
  ctx.lineTo(TURTLE_SIZE * 0.6, TURTLE_SIZE * 0.7);    // bottom-right
  ctx.lineTo(-TURTLE_SIZE * 0.6, TURTLE_SIZE * 0.7);   // bottom-left
  ctx.closePath();

  ctx.fillStyle = '#20c997';
  ctx.fill();

  ctx.restore();
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
      case 'drawCircle': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.arc(cx, cy, cmd.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, cmd.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
      case 'drawRect': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.rect(cx - cmd.width / 2, cy - cmd.height / 2, cmd.width, cmd.height);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.rect(cx - cmd.width / 2, cy - cmd.height / 2, cmd.width, cmd.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
      case 'drawEllipse': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cmd.rx, cmd.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(cx, cy, cmd.rx, cmd.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
      case 'drawTriangle': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        const tipY  = cmd.size * Math.sqrt(3) / 3;
        const baseY = cmd.size * Math.sqrt(3) / 6;
        const halfW = cmd.size / 2;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.beginPath();
        ctx.moveTo(cx, cy - tipY);
        ctx.lineTo(cx + halfW, cy + baseY);
        ctx.lineTo(cx - halfW, cy + baseY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(cx, cy - tipY);
        ctx.lineTo(cx + halfW, cy + baseY);
        ctx.lineTo(cx - halfW, cy + baseY);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
      case 'drawPolygon': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        const R = cmd.size / (2 * Math.sin(Math.PI / cmd.n));
        const vertices = Array.from({ length: cmd.n }, (_, k) => ({
          x: cx + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * k) / cmd.n),
          y: cy + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * k) / cmd.n),
        }));
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
        ctx.closePath();
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.fill();
        ctx.restore();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
      case 'drawText': {
        ctx.stroke();
        const cx = STAGE_W / 2 + cmd.x;
        const cy = STAGE_H / 2 + cmd.y;
        ctx.font = `${cmd.size}px sans-serif`;
        // fillStyle set directly — no globalAlpha change, so no save/restore needed
        ctx.fillStyle = ctx.strokeStyle as string;
        ctx.fillText(cmd.str, cx, cy);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        break;
      }
    }
  }
  ctx.stroke();
}
