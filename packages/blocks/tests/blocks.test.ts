// Phase 2 integration tests: Blockly workspace → AST (compiler) and
// Blockly workspace → display text (generator).
//
// For each of the 5 example fixtures:
//   compiler: compileWorkspace(ws) deep-equals the hand-built AST fixture.
//   generator: generate(ws) string-equals the fixture's expectedText.

import { describe, it, expect } from 'vitest';
import { compileWorkspace, generate } from '../src/compiler.js';

import { program as squareProg, expectedText as squareText } from '../../../examples/square.fixture.js';
import { program as polygonProg, expectedText as polygonText } from '../../../examples/polygon.fixture.js';
import { program as besideProg, expectedText as besideText } from '../../../examples/beside.fixture.js';
import { program as repeatProg, expectedText as repeatText } from '../../../examples/repeat-loop.fixture.js';
import { program as clickProg, expectedText as clickText } from '../../../examples/click-event.fixture.js';

import {
  buildSquareWorkspace,
  buildPolygonWorkspace,
  buildBesideWorkspace,
  buildRepeatLoopWorkspace,
  buildClickEventWorkspace,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Fixture 1: Square
// ---------------------------------------------------------------------------

describe('Fixture 1: Square', () => {
  it('compiler: output matches hand-built AST', () => {
    const program = compileWorkspace(buildSquareWorkspace());
    expect(program).toEqual(squareProg);
  });

  it('generator: output matches expectedText', () => {
    expect(generate(buildSquareWorkspace())).toBe(squareText);
  });
});

// ---------------------------------------------------------------------------
// Fixture 2: Polygon
// ---------------------------------------------------------------------------

describe('Fixture 2: Polygon', () => {
  it('compiler: output matches hand-built AST', () => {
    const program = compileWorkspace(buildPolygonWorkspace());
    expect(program).toEqual(polygonProg);
  });

  it('generator: output matches expectedText', () => {
    expect(generate(buildPolygonWorkspace())).toBe(polygonText);
  });
});

// ---------------------------------------------------------------------------
// Fixture 3: Beside
// ---------------------------------------------------------------------------

describe('Fixture 3: Beside', () => {
  it('compiler: output matches hand-built AST', () => {
    const program = compileWorkspace(buildBesideWorkspace());
    expect(program).toEqual(besideProg);
  });

  it('generator: output matches expectedText', () => {
    expect(generate(buildBesideWorkspace())).toBe(besideText);
  });
});

// ---------------------------------------------------------------------------
// Fixture 4: Repeat loop
// ---------------------------------------------------------------------------

describe('Fixture 4: Repeat loop', () => {
  it('compiler: output matches hand-built AST', () => {
    const program = compileWorkspace(buildRepeatLoopWorkspace());
    expect(program).toEqual(repeatProg);
  });

  it('generator: output matches expectedText', () => {
    expect(generate(buildRepeatLoopWorkspace())).toBe(repeatText);
  });
});

// ---------------------------------------------------------------------------
// Fixture 5: Click event
// ---------------------------------------------------------------------------

describe('Fixture 5: Click event', () => {
  it('compiler: output matches hand-built AST', () => {
    const program = compileWorkspace(buildClickEventWorkspace());
    expect(program).toEqual(clickProg);
  });

  it('generator: output matches expectedText', () => {
    expect(generate(buildClickEventWorkspace())).toBe(clickText);
  });
});
