// Integration tests: 5 canonical example programs through the full pipeline.
// Pipeline: AST fixture → Serializer → text
//           AST fixture → Interpreter → Drawing
//           Drawing     → Renderer   → CanvasCommand[]

import { describe, it, expect } from 'vitest';
import { serialize, interpret, render, EMPTY } from '@sprout/lang';

import { program as squareProg, expectedText as squareText } from '../../../examples/square.fixture.js';
import { program as polygonProg, expectedText as polygonText } from '../../../examples/polygon.fixture.js';
import { program as besideProg, expectedText as besideText } from '../../../examples/beside.fixture.js';
import { program as repeatProg, expectedText as repeatText } from '../../../examples/repeat-loop.fixture.js';
import { program as clickProg, expectedText as clickText } from '../../../examples/click-event.fixture.js';

// ---------------------------------------------------------------------------
// Fixture 1: Square
// ---------------------------------------------------------------------------

describe('Example 1: Square', () => {
  it('serializer produces expected text', () => {
    expect(serialize(squareProg)).toBe(squareText);
  });

  it('interpreter returns a sequence wrapping a 4-step repeat', () => {
    const drawing = interpret(squareProg);
    expect(drawing.kind).toBe('sequence');
    // interpret wraps the single top-level Drawing in a sequence
    const outer = drawing as Extract<typeof drawing, { kind: 'sequence' }>;
    expect(outer.steps).toHaveLength(1);
    // The repeat(4) result is itself a sequence of 4 iterations
    const repeatResult = outer.steps[0] as Extract<typeof drawing, { kind: 'sequence' }>;
    expect(repeatResult.kind).toBe('sequence');
    expect(repeatResult.steps).toHaveLength(4);
    // Each iteration is a sequence of 2 drawings (forward + turn)
    const firstIter = repeatResult.steps[0] as Extract<typeof drawing, { kind: 'sequence' }>;
    expect(firstIter.kind).toBe('sequence');
    expect(firstIter.steps).toHaveLength(2);
  });

  it('renderer produces exactly 4 lineTo commands (one per side)', () => {
    const commands = render(interpret(squareProg));
    expect(Array.isArray(commands)).toBe(true);
    const lineTos = commands.filter(c => c.kind === 'lineTo');
    expect(lineTos).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Fixture 2: Polygon (parameterized function)
// ---------------------------------------------------------------------------

describe('Example 2: Polygon', () => {
  it('serializer produces expected text', () => {
    expect(serialize(polygonProg)).toBe(polygonText);
  });

  it('interpreter returns a sequence wrapping a 6-step polygon', () => {
    const drawing = interpret(polygonProg);
    expect(drawing.kind).toBe('sequence');
    // interpret wraps the single polygon Drawing in a sequence
    const outer = drawing as Extract<typeof drawing, { kind: 'sequence' }>;
    expect(outer.steps).toHaveLength(1);
    // polygon(6, 80) → repeat(6) → sequence of 6 iterations
    const polygonResult = outer.steps[0] as Extract<typeof drawing, { kind: 'sequence' }>;
    expect(polygonResult.kind).toBe('sequence');
    expect(polygonResult.steps).toHaveLength(6);
  });

  it('renderer produces at least one CanvasCommand', () => {
    const commands = render(interpret(polygonProg));
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture 3: Beside (composing two pictures)
// ---------------------------------------------------------------------------

describe('Example 3: Beside', () => {
  it('serializer produces expected text', () => {
    expect(serialize(besideProg)).toBe(besideText);
  });

  it('interpreter returns a sequence containing a beside node', () => {
    const drawing = interpret(besideProg);
    expect(drawing.kind).toBe('sequence');
    // interpret wraps the beside Drawing in an outer sequence
    const outer = drawing as Extract<typeof drawing, { kind: 'sequence' }>;
    expect(outer.steps).toHaveLength(1);
    // beside(square(), square()) returns a beside node
    expect(outer.steps[0].kind).toBe('beside');
  });

  it('renderer produces at least one CanvasCommand', () => {
    const commands = render(interpret(besideProg));
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture 4: Repeat loop (8 sides, 45 degrees)
// ---------------------------------------------------------------------------

describe('Example 4: Repeat loop', () => {
  it('serializer produces expected text', () => {
    expect(serialize(repeatProg)).toBe(repeatText);
  });

  it('interpreter returns a sequence wrapping an 8-step repeat', () => {
    const drawing = interpret(repeatProg);
    expect(drawing.kind).toBe('sequence');
    // interpret wraps the single top-level Drawing in a sequence
    const outer = drawing as Extract<typeof drawing, { kind: 'sequence' }>;
    expect(outer.steps).toHaveLength(1);
    // repeat(8) result is a sequence of 8 iterations
    const repeatResult = outer.steps[0] as Extract<typeof drawing, { kind: 'sequence' }>;
    expect(repeatResult.kind).toBe('sequence');
    expect(repeatResult.steps).toHaveLength(8);
  });

  it('renderer produces exactly 8 lineTo commands (one per forward)', () => {
    const commands = render(interpret(repeatProg));
    expect(Array.isArray(commands)).toBe(true);
    const lineTos = commands.filter(c => c.kind === 'lineTo');
    expect(lineTos).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// Fixture 5: Click event handler
// ---------------------------------------------------------------------------

describe('Example 5: Click event handler', () => {
  it('serializer produces expected text', () => {
    expect(serialize(clickProg)).toBe(clickText);
  });

  it('interpreter returns EMPTY (handler registered, no visual output)', () => {
    const drawing = interpret(clickProg);
    expect(drawing).toBeDefined();
    expect(drawing).toEqual(EMPTY);
    expect(drawing.kind).toBe('empty');
  });

  it('renderer runs without throwing (returns empty array for EMPTY drawing)', () => {
    const commands = render(interpret(clickProg));
    expect(Array.isArray(commands)).toBe(true);
    // EMPTY produces no canvas commands — this is expected MVP behavior
    expect(commands.length).toBe(0);
  });
});
