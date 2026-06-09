import { describe, it, expect } from 'vitest';
import { interpretFull, SproutRuntimeError } from '../src/interpreter.js';
import type { Program, Stmt, Expr, LetStmt } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const letStmt = (name: string, init: Expr): LetStmt =>
  ({ kind: 'LetStmt', name, init });

const program = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

// ---------------------------------------------------------------------------
// Helper: run a program and return the value of a variable named 'result'
// ---------------------------------------------------------------------------

function runAndGetVar(prog: Program): number {
  const { variables } = interpretFull(prog);
  const val = variables['result'];
  if (val === undefined) throw new Error('variable "result" not found');
  return Number(val);
}

// ---------------------------------------------------------------------------
// 1. getX / getY after forward(100)
// ---------------------------------------------------------------------------

describe('getX / getY after forward(100)', () => {
  it('getX is approximately 0 (turtle moves straight down)', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      letStmt('result', call('getX', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(0, 1);
  });

  it('getY is approximately -100 (turtle moves downward in canvas coords)', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      letStmt('result', call('getY', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(-100, 1);
  });
});

// ---------------------------------------------------------------------------
// 2. getHeading after turn(90)
// ---------------------------------------------------------------------------

describe('getHeading after turn(90)', () => {
  it('returns 90', () => {
    const prog = program(
      exprStmt(call('turn', [numLit(90)])),
      letStmt('result', call('getHeading', [])),
    );
    expect(runAndGetVar(prog)).toBe(90);
  });

  it('wraps around at 360', () => {
    const prog = program(
      exprStmt(call('turn', [numLit(350)])),
      exprStmt(call('turn', [numLit(20)])),
      letStmt('result', call('getHeading', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(10, 5);
  });
});

// ---------------------------------------------------------------------------
// 3. turn(90) then forward(50): x ≈ 50, y ≈ 0
// ---------------------------------------------------------------------------

describe('turn(90) then forward(50)', () => {
  it('getX is approximately 50', () => {
    const prog = program(
      exprStmt(call('turn', [numLit(90)])),
      exprStmt(call('forward', [numLit(50)])),
      letStmt('result', call('getX', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(50, 1);
  });

  it('getY is approximately 0', () => {
    const prog = program(
      exprStmt(call('turn', [numLit(90)])),
      exprStmt(call('forward', [numLit(50)])),
      letStmt('result', call('getY', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(0, 1);
  });
});

// ---------------------------------------------------------------------------
// 4. Shadow state resets between runs
// ---------------------------------------------------------------------------

describe('shadow state resets between runs', () => {
  it('second call to interpretFull starts at origin', () => {
    const prog1 = program(
      exprStmt(call('forward', [numLit(200)])),
    );
    interpretFull(prog1);

    const prog2 = program(
      letStmt('result', call('getX', [])),
    );
    expect(runAndGetVar(prog2)).toBe(0);
  });

  it('second run getY starts at 0', () => {
    const prog1 = program(
      exprStmt(call('forward', [numLit(200)])),
    );
    interpretFull(prog1);

    const prog2 = program(
      letStmt('result', call('getY', [])),
    );
    expect(runAndGetVar(prog2)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. goto(30, 40) sets getX = 30, getY = 40
// ---------------------------------------------------------------------------

describe('goto sets turtle position', () => {
  it('getX returns 30 after goto(30, 40)', () => {
    const prog = program(
      exprStmt(call('goto', [numLit(30), numLit(40)])),
      letStmt('result', call('getX', [])),
    );
    expect(runAndGetVar(prog)).toBe(30);
  });

  it('getY returns 40 after goto(30, 40)', () => {
    const prog = program(
      exprStmt(call('goto', [numLit(30), numLit(40)])),
      letStmt('result', call('getY', [])),
    );
    expect(runAndGetVar(prog)).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// 6. home() resets position and heading
// ---------------------------------------------------------------------------

describe('home resets state', () => {
  it('getX = 0 after forward then home', () => {
    const prog = program(
      exprStmt(call('turn', [numLit(90)])),
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('home', [])),
      letStmt('result', call('getX', [])),
    );
    expect(runAndGetVar(prog)).toBe(0);
  });

  it('getY = 0 after forward then home', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('home', [])),
      letStmt('result', call('getY', [])),
    );
    expect(runAndGetVar(prog)).toBe(0);
  });

  it('getHeading = 0 after turn then home', () => {
    const prog = program(
      exprStmt(call('turn', [numLit(90)])),
      exprStmt(call('home', [])),
      letStmt('result', call('getHeading', [])),
    );
    expect(runAndGetVar(prog)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. arc(50, 90) advances heading by 90
// ---------------------------------------------------------------------------

describe('arc updates heading', () => {
  it('getHeading increases by 90 after arc(50, 90)', () => {
    const prog = program(
      exprStmt(call('arc', [numLit(50), numLit(90)])),
      letStmt('result', call('getHeading', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(90, 1);
  });
});

// ---------------------------------------------------------------------------
// 8. clearCanvas resets turtle shadow state
// ---------------------------------------------------------------------------

describe('clearCanvas resets turtle state', () => {
  it('getX returns 0 after clearCanvas even after forward', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('clearCanvas', [])),
      letStmt('result', call('getX', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(0, 1);
  });

  it('getY returns 0 after clearCanvas', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('clearCanvas', [])),
      letStmt('result', call('getY', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(0, 1);
  });

  it('getHeading returns 0 after clearCanvas', () => {
    const prog = program(
      exprStmt(call('turn', [numLit(90)])),
      exprStmt(call('clearCanvas', [])),
      letStmt('result', call('getHeading', [])),
    );
    expect(runAndGetVar(prog)).toBeCloseTo(0, 1);
  });
});

// ---------------------------------------------------------------------------
// 9. Wrong arity throws SproutRuntimeError
// ---------------------------------------------------------------------------

describe('wrong arity throws SproutRuntimeError', () => {
  it('getX(1) throws', () => {
    const prog = program(
      exprStmt(call('getX', [numLit(1)])),
    );
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('getY(1) throws', () => {
    const prog = program(
      exprStmt(call('getY', [numLit(1)])),
    );
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('getHeading(1) throws', () => {
    const prog = program(
      exprStmt(call('getHeading', [numLit(1)])),
    );
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });
});
