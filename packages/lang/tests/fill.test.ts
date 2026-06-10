import { describe, it, expect } from 'vitest';
import { interpret } from '../src/interpreter.js';
import { render } from '../src/renderer.js';
import { serialize } from '../src/serializer.js';
import { mkFillPath, mkForward, mkTurn, mkSequence, mkGoto, mkColor, mkCircle } from '../src/values.js';
import type { Program, Stmt, Expr, BlockExpr } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });
const blockE = (...body: Stmt[]): BlockExpr => ({ kind: 'BlockExpr', body });
const fillE = (...body: Stmt[]): Expr => ({ kind: 'FillExpr', body: blockE(...body) });

function unwrapSingle(drawing: ReturnType<typeof interpret>) {
  if (drawing.kind === 'sequence' && drawing.steps.length === 1) return drawing.steps[0];
  return drawing;
}

function expectPoints(
  actual: readonly { x: number; y: number }[],
  expected: readonly { x: number; y: number }[],
) {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i].x).toBeCloseTo(expected[i].x, 10);
    expect(actual[i].y).toBeCloseTo(expected[i].y, 10);
  }
}

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

describe('FillExpr — interpreter', () => {
  it('fill do forward(100) turn(120) end produces a fillPath drawing', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(fillE(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('turn', [numLit(120)])),
    )))));
    expect(result).toEqual(mkFillPath(mkSequence([mkForward(100), mkTurn(120)])));
  });

  it('empty fill body produces fillPath of EMPTY', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(fillE()))));
    expect(result).toEqual(mkFillPath({ kind: 'empty' }));
  });
});

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

describe('fillPath — renderer', () => {
  it('collects vertices from forward/turn movements', () => {
    const d = mkFillPath(mkSequence([mkForward(100), mkTurn(90), mkForward(50)]));
    const cmds = render(d);
    expect(cmds[0].kind).toBe('fillPath');
    const fp = cmds[0] as { kind: 'fillPath'; points: { x: number; y: number }[] };
    expectPoints(fp.points, [
      { x: 0, y: 0 },     // start
      { x: 0, y: -100 },  // forward 100 (north)
      { x: 50, y: -100 }, // turn 90, forward 50 (east)
    ]);
  });

  it('turtle continues from the path end position and heading', () => {
    const d = mkSequence([
      mkFillPath(mkSequence([mkForward(100), mkTurn(90)])),
      mkForward(50),
    ]);
    const cmds = render(d);
    const lineTo = cmds.find(c => c.kind === 'lineTo') as { x: number; y: number };
    expect(lineTo.x).toBeCloseTo(50, 10);
    expect(lineTo.y).toBeCloseTo(-100, 10);
  });

  it('goto inside fill adds a vertex without drawing', () => {
    const d = mkFillPath(mkSequence([mkForward(100), mkGoto(80, 20)]));
    const fp = render(d)[0] as { kind: 'fillPath'; points: { x: number; y: number }[] };
    expectPoints(fp.points, [
      { x: 0, y: 0 },
      { x: 0, y: -100 },
      { x: 80, y: 20 },
    ]);
  });

  it('non-movement nodes inside fill add no vertices', () => {
    const d = mkFillPath(mkSequence([mkColor('#dc2626'), mkCircle(30), mkForward(100)]));
    const fp = render(d)[0] as { kind: 'fillPath'; points: { x: number; y: number }[] };
    expectPoints(fp.points, [
      { x: 0, y: 0 },
      { x: 0, y: -100 },
    ]);
  });

  it('scale(2, fill) doubles the traced path', () => {
    const d = { kind: 'scale' as const, factor: 2, drawing: mkFillPath(mkForward(100)) };
    const fp = render(d)[0] as { kind: 'fillPath'; points: { x: number; y: number }[] };
    expectPoints(fp.points, [
      { x: 0, y: 0 },
      { x: 0, y: -200 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

describe('FillExpr — serializer', () => {
  it('serializes fill do ... end', () => {
    const p = prog(exprStmt(fillE(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('turn', [numLit(120)])),
    )));
    expect(serialize(p)).toBe('fill do\n  forward(100)\n  turn(120)\nend');
  });
});
