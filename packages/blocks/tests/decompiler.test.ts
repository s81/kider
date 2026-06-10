import { describe, it, expect, beforeAll } from 'vitest';
import * as Blockly from 'blockly/node';
import { serialize } from '@sprout/lang';
import { parse } from '@sprout/parser';
import { registerAllBlocks } from '../src/definitions/index.js';
import { compileWorkspace } from '../src/compiler.js';
import { decompileProgram, DecompileError } from '../src/decompiler.js';

beforeAll(() => {
  registerAllBlocks();
});

function makeWorkspace(): Blockly.Workspace {
  return new Blockly.Workspace();
}

/**
 * Round-trip: text → AST → blocks → AST → text must be stable.
 * Compared after one normalizing decompile/compile round so harmless
 * normalizations (e.g. `on timer do` gaining the default interval) settle.
 */
function roundTrip(source: string): void {
  const program = parse(source);
  const ws1 = makeWorkspace();
  decompileProgram(ws1, program);
  const once = compileWorkspace(ws1);

  const ws2 = makeWorkspace();
  decompileProgram(ws2, once);
  const twice = compileWorkspace(ws2);

  expect(serialize(twice)).toBe(serialize(once));
  // Sanity: parse∘serialize reaches a fixed point after one normalizing
  // round (defs may flip between expr-body and block-body form once).
  const reparsed = serialize(parse(serialize(once)));
  expect(serialize(parse(reparsed))).toBe(reparsed);
}

describe('decompiler round-trips', () => {
  it('square: repeat + forward + turn', () => {
    roundTrip('repeat 4 do\n  forward(100)\n  turn(90)\nend');
  });

  it('star: color + fill + hideTurtle', () => {
    roundTrip('color(:orange)\nfill do\n  repeat 5 do\n    forward(150)\n    turn(144)\n  end\nend\nhideTurtle()');
  });

  it('random art: negative numbers, randomColor, goto, circle, home', () => {
    roundTrip('repeat 30 do\n  randomColor()\n  goto(random(-200, 200), random(-200, 200))\n  circle(random(5, 30))\nend\nhome()');
  });

  it('melody: playNote with dropdown notes', () => {
    roundTrip('playNote("C4", 0.4)\nplayNote("G4", 0.8)');
  });

  it('catch game: let/set, on timer, if, keyDown, touching, show, stopTimer', () => {
    roundTrip([
      'let x = 0',
      'let score = 0',
      'on timer every 50 do',
      '  if keyDown(:left) do',
      '    set x = x - 5',
      '  end',
      '  if touching(x, 0, 100, 0, 25) do',
      '    beep()',
      '    set score = score + 1',
      '  end',
      '  clearCanvas()',
      '  goto(x, 0)',
      '  show("score", score)',
      '  if score == 5 do',
      '    text("YOU WIN!", 40)',
      '    stopTimer()',
      '  end',
      'end',
    ].join('\n'));
  });

  it('def with params and a call', () => {
    roundTrip('def star(size) do\n  repeat 5 do\n    forward(size)\n    turn(144)\n  end\nend\nstar(80)');
  });

  it('if/else, while, for each, bool and logic ops', () => {
    roundTrip([
      'let n = 3',
      'if n > 2 and not (n == 5) do',
      '  forward(10)',
      'else',
      '  turn(90)',
      'end',
      'while n > 0 do',
      '  set n = n - 1',
      'end',
      'for each item in list(1, 2, 3) do',
      '  forward(item)',
      'end',
    ].join('\n'));
  });

  it('unknown callee falls back to a generic call block', () => {
    roundTrip('def f(a, b) do\n  forward(a + b)\nend\nf(1, 2)');
  });

  it('playNote with a non-dropdown note falls back generically', () => {
    roundTrip('playNote("F#3", 0.5)');
  });
});

describe('decompiler errors', () => {
  it('throws DecompileError for a 3-arg unknown call', () => {
    const program = parse('mystery(1, 2, 3)');
    expect(() => decompileProgram(makeWorkspace(), program)).toThrow(DecompileError);
  });

  it('throws DecompileError for list(...) with more than 3 items', () => {
    const program = parse('puts(list(1, 2, 3, 4))');
    expect(() => decompileProgram(makeWorkspace(), program)).toThrow(DecompileError);
  });
});
