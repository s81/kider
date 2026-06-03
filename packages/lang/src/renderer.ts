// renderer.ts — walks a Drawing value and produces a flat list of CanvasCommands.
//
// The turtle's state (position, heading, pen) is local to this module and is
// never visible to the Sprout language.

import type { Drawing } from './values.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CanvasCommand =
  | { readonly kind: 'moveTo'; readonly x: number; readonly y: number }
  | { readonly kind: 'lineTo'; readonly x: number; readonly y: number }
  | { readonly kind: 'penDown' }
  | { readonly kind: 'penUp' }
  | { readonly kind: 'setColor'; readonly color: string };

// ---------------------------------------------------------------------------
// Turtle state (internal)
// ---------------------------------------------------------------------------

type TurtleState = {
  x: number;
  y: number;
  /** Degrees clockwise from north (0 = up). */
  heading: number;
  penDown: boolean;
};

const DEG_TO_RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// scaleDrawing — recursively rewrites all forward distances by `factor`
// ---------------------------------------------------------------------------

function scaleDrawing(factor: number, d: Drawing): Drawing {
  switch (d.kind) {
    case 'forward':
      return { kind: 'forward', distance: d.distance * factor };
    case 'turn':
    case 'penUp':
    case 'penDown':
    case 'color':
    case 'empty':
      return d;
    case 'sequence':
      return { kind: 'sequence', steps: d.steps.map(s => scaleDrawing(factor, s)) };
    case 'beside':
      return { kind: 'beside', left: scaleDrawing(factor, d.left), right: scaleDrawing(factor, d.right) };
    case 'above':
      return { kind: 'above', top: scaleDrawing(factor, d.top), bottom: scaleDrawing(factor, d.bottom) };
    case 'scale':
      return { kind: 'scale', factor: d.factor * factor, drawing: d.drawing };
  }
}

// ---------------------------------------------------------------------------
// renderInto — core recursive walker
//
// Mutates `state` in place and pushes commands into `out`.
// Returns nothing; callers inspect state after the call.
// ---------------------------------------------------------------------------

function renderInto(
  drawing: Drawing,
  state: TurtleState,
  out: CanvasCommand[],
): void {
  switch (drawing.kind) {
    case 'empty':
      return;

    case 'penUp':
      out.push({ kind: 'penUp' });
      state.penDown = false;
      return;

    case 'penDown':
      out.push({ kind: 'penDown' });
      state.penDown = true;
      return;

    case 'color':
      out.push({ kind: 'setColor', color: drawing.color });
      out.push({ kind: 'moveTo', x: state.x, y: state.y });
      return;

    case 'turn':
      state.heading = ((state.heading + drawing.degrees) % 360 + 360) % 360;
      return;

    case 'forward': {
      const rad = state.heading * DEG_TO_RAD;
      const newX = state.x + drawing.distance * Math.sin(rad);
      const newY = state.y - drawing.distance * Math.cos(rad);
      if (state.penDown) {
        out.push({ kind: 'lineTo', x: newX, y: newY });
      } else {
        out.push({ kind: 'moveTo', x: newX, y: newY });
      }
      state.x = newX;
      state.y = newY;
      return;
    }

    case 'sequence':
      for (const step of drawing.steps) {
        renderInto(step, state, out);
      }
      return;

    case 'beside': {
      // Snapshot origin for the right child.
      const originX = state.x;
      const originY = state.y;

      // Render left, threading state through.
      renderInto(drawing.left, state, out);

      // Offset right child by the rightward extent of left (maxX from origin),
      // not the total width — a drawing that goes left-of-origin has maxX=0 so right child starts at origin.
      // Heading and pen state carry over from end of left into right (intentional — see DESIGN.md).
      const { maxX: leftMaxX } = measureBbox(drawing.left);
      const rightOffset = Math.max(0, leftMaxX);

      state.x = originX + rightOffset;
      state.y = originY;
      renderInto(drawing.right, state, out);
      return;
    }

    case 'above': {
      const originX = state.x;
      const originY = state.y;

      renderInto(drawing.top, state, out);

      // Offset bottom child by the downward extent of top (maxY from origin), not total height.
      const { maxY: topMaxY } = measureBbox(drawing.top);
      const bottomOffset = Math.max(0, topMaxY);

      state.x = originX;
      state.y = originY + bottomOffset;
      renderInto(drawing.bottom, state, out);
      return;
    }

    case 'scale':
      renderInto(scaleDrawing(drawing.factor, drawing.drawing), state, out);
      return;
  }
}

// ---------------------------------------------------------------------------
// measureBbox / measure — bounding box without emitting commands
//
// TODO: renderInto and measureBbox share turtle-step math. Consider extracting
// a shared step function to prevent drift.
// ---------------------------------------------------------------------------

type BBox = { minX: number; maxX: number; minY: number; maxY: number };

function measureInto(drawing: Drawing, state: TurtleState, bbox: BBox): void {
  switch (drawing.kind) {
    case 'empty':
    case 'penUp':
    case 'penDown':
    case 'color':
      return;

    case 'turn':
      state.heading = ((state.heading + drawing.degrees) % 360 + 360) % 360;
      return;

    case 'forward': {
      const rad = state.heading * DEG_TO_RAD;
      const newX = state.x + drawing.distance * Math.sin(rad);
      const newY = state.y - drawing.distance * Math.cos(rad);
      state.x = newX;
      state.y = newY;
      if (newX < bbox.minX) bbox.minX = newX;
      if (newX > bbox.maxX) bbox.maxX = newX;
      if (newY < bbox.minY) bbox.minY = newY;
      if (newY > bbox.maxY) bbox.maxY = newY;
      return;
    }

    case 'sequence':
      for (const step of drawing.steps) {
        measureInto(step, state, bbox);
      }
      return;

    case 'beside': {
      const originX = state.x;
      const originY = state.y;

      measureInto(drawing.left, state, bbox);

      const { maxX: leftMaxX } = measureBbox(drawing.left);
      const rightOffset = Math.max(0, leftMaxX);

      state.x = originX + rightOffset;
      state.y = originY;
      measureInto(drawing.right, state, bbox);
      return;
    }

    case 'above': {
      const originX = state.x;
      const originY = state.y;

      measureInto(drawing.top, state, bbox);

      const { maxY: topMaxY } = measureBbox(drawing.top);
      const bottomOffset = Math.max(0, topMaxY);

      state.x = originX;
      state.y = originY + bottomOffset;
      measureInto(drawing.bottom, state, bbox);
      return;
    }

    case 'scale':
      measureInto(scaleDrawing(drawing.factor, drawing.drawing), state, bbox);
      return;
  }
}

/** Returns the raw bounding box of a drawing measured from origin (0, 0). */
function measureBbox(drawing: Drawing): BBox {
  const state: TurtleState = { x: 0, y: 0, heading: 0, penDown: true };
  const bbox: BBox = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  measureInto(drawing, state, bbox);
  return bbox;
}

export function measure(drawing: Drawing): { width: number; height: number } {
  const { minX, maxX, minY, maxY } = measureBbox(drawing);
  return {
    width:  Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

// ---------------------------------------------------------------------------
// render — public entry point
// ---------------------------------------------------------------------------

export function render(drawing: Drawing): CanvasCommand[] {
  const state: TurtleState = { x: 0, y: 0, heading: 0, penDown: true };
  const out: CanvasCommand[] = [];
  renderInto(drawing, state, out);
  return out;
}
