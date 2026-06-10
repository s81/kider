import { describe, it, expect } from 'vitest';
import { interpret, SproutRuntimeError } from '../src/interpreter.js';
import { render } from '../src/renderer.js';
import { mkSound, mkForward } from '../src/values.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

// Helper to unwrap a single-element sequence from interpret's result
function unwrapSingle(drawing: ReturnType<typeof interpret>) {
  if (drawing.kind === 'sequence' && drawing.steps.length === 1) return drawing.steps[0];
  return drawing;
}

// ---------------------------------------------------------------------------
// Interpreter tests
// ---------------------------------------------------------------------------

describe('playNote builtin — interpreter', () => {
  it('playNote("A4", 0.5) returns sound with frequency 440', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('playNote', [strLit('A4'), numLit(0.5)])))));
    expect(result).toEqual({ kind: 'sound', frequency: 440, seconds: 0.5 });
  });

  it('playNote("C4", 1) is middle C ≈ 261.63 Hz', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('playNote', [strLit('C4'), numLit(1)])))));
    expect(result.kind).toBe('sound');
    expect((result as { frequency: number }).frequency).toBeCloseTo(261.63, 1);
  });

  it('playNote("F#3", 1) handles sharps', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('playNote', [strLit('F#3'), numLit(1)])))));
    expect((result as { frequency: number }).frequency).toBeCloseTo(185.0, 1);
  });

  it('playNote("Bb2", 1) handles flats', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('playNote', [strLit('Bb2'), numLit(1)])))));
    expect((result as { frequency: number }).frequency).toBeCloseTo(116.54, 1);
  });

  it('playNote(330, 1) passes a numeric frequency through', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('playNote', [numLit(330), numLit(1)])))));
    expect(result).toEqual({ kind: 'sound', frequency: 330, seconds: 1 });
  });

  it('playNote("X9", 1) throws on unknown note', () => {
    expect(() =>
      interpret(prog(exprStmt(call('playNote', [strLit('X9'), numLit(1)]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(prog(exprStmt(call('playNote', [strLit('X9'), numLit(1)]))))
    ).toThrow("playNote: unknown note 'X9'");
  });

  it('playNote(0, 1) throws on non-positive frequency', () => {
    expect(() =>
      interpret(prog(exprStmt(call('playNote', [numLit(0), numLit(1)]))))
    ).toThrow(SproutRuntimeError);
  });

  it('playNote("A4", -1) throws on negative duration', () => {
    expect(() =>
      interpret(prog(exprStmt(call('playNote', [strLit('A4'), numLit(-1)]))))
    ).toThrow('playNote: seconds must be non-negative');
  });

  it('playNote() with 1 arg throws', () => {
    expect(() =>
      interpret(prog(exprStmt(call('playNote', [strLit('A4')]))))
    ).toThrow('playNote expects 2 arguments');
  });
});

describe('beep builtin — interpreter', () => {
  it('beep() returns an 880 Hz, 0.2 s sound', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('beep', [])))));
    expect(result).toEqual({ kind: 'sound', frequency: 880, seconds: 0.2 });
  });

  it('beep(1) throws with 1 arg', () => {
    expect(() =>
      interpret(prog(exprStmt(call('beep', [numLit(1)]))))
    ).toThrow('beep expects 0 arguments');
  });
});

// ---------------------------------------------------------------------------
// Renderer tests
// ---------------------------------------------------------------------------

describe('sound — renderer', () => {
  it('render of mkSound(440, 0.5) produces { kind: "sound", frequency: 440, durationMs: 500 }', () => {
    const cmds = render(mkSound(440, 0.5));
    expect(cmds).toEqual([{ kind: 'sound', frequency: 440, durationMs: 500 }]);
  });

  it('render of sequence [forward(50), beep, forward(50)] has sound in the middle', () => {
    const drawing = interpret(prog(
      exprStmt(call('forward', [numLit(50)])),
      exprStmt(call('beep', [])),
      exprStmt(call('forward', [numLit(50)])),
    ));
    const cmds = render(drawing);
    const soundCmds = cmds.filter(c => c.kind === 'sound');
    expect(soundCmds).toHaveLength(1);
    expect(soundCmds[0]).toEqual({ kind: 'sound', frequency: 880, durationMs: 200 });
    const soundIdx = cmds.findIndex(c => c.kind === 'sound');
    expect(soundIdx).toBeGreaterThan(0);
    expect(soundIdx).toBeLessThan(cmds.length - 1);
  });

  it('scale leaves sound untouched', () => {
    const scaled = { kind: 'scale' as const, factor: 2, drawing: { kind: 'sequence' as const, steps: [mkForward(10), mkSound(440, 1)] } };
    const cmds = render(scaled);
    const soundCmds = cmds.filter(c => c.kind === 'sound');
    expect(soundCmds).toEqual([{ kind: 'sound', frequency: 440, durationMs: 1000 }]);
  });
});
