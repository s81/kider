import type { CanvasCommand } from '@sprout/lang';

export const STAGE_W = 500;
export const STAGE_H = 500;

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
      case 'penDown':
      case 'penUp':
        break;
    }
  }
  ctx.stroke();
}
