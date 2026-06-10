import { describe, it, expect } from 'vitest';
import { interpretValue, SproutRuntimeError } from '../src/interpreter.js';
import { serialize } from '../src/serializer.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const neg = (operand: Expr): Expr => ({ kind: 'UnaryExpr', op: '-', operand });
const infix = (op: '+' | '-' | '*' | '/', left: Expr, right: Expr): Expr =>
  ({ kind: 'InfixExpr', op, left, right });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

describe('unary minus — interpreter', () => {
  it('negates a number literal', () => {
    expect(interpretValue(prog(exprStmt(neg(numLit(200))))))
      .toEqual({ kind: 'number', value: -200 });
  });

  it('negates an expression result', () => {
    expect(interpretValue(prog(exprStmt(neg(infix('+', numLit(2), numLit(3)))))))
      .toEqual({ kind: 'number', value: -5 });
  });

  it('double negation round-trips', () => {
    expect(interpretValue(prog(exprStmt(neg(neg(numLit(7)))))))
      .toEqual({ kind: 'number', value: 7 });
  });

  it('throws on a non-number operand', () => {
    expect(() => interpretValue(prog(exprStmt(neg(strLit('hi'))))))
      .toThrow(SproutRuntimeError);
  });
});

describe('unary minus — serializer', () => {
  it('serializes -200', () => {
    expect(serialize(prog(exprStmt(neg(numLit(200)))))).toBe('-200');
  });
});
