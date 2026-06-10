import { describe, it, expect } from 'vitest';
import { interpret } from '../src/interpreter.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const identAt = (name: string, line: number): Expr => ({ kind: 'Ident', name, line });
const callAt = (callee: string, args: Expr[], line: number): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null, line });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

describe('runtime error line numbers', () => {
  it('builtin type errors carry the call line', () => {
    expect(() => interpret(prog(exprStmt(callAt('forward', [strLit('x')], 12)))))
      .toThrow('Line 12: forward: expected number');
  });

  it('arity errors carry the call line', () => {
    expect(() => interpret(prog(exprStmt(callAt('forward', [], 3)))))
      .toThrow('Line 3: forward expects 1 argument');
  });

  it('unbound identifiers carry their own line', () => {
    expect(() => interpret(prog(exprStmt(callAt('forward', [identAt('speed', 7)], 7)))))
      .toThrow("Line 7: Unbound identifier: 'speed'");
  });

  it('the innermost call wins', () => {
    const inner = callAt('sqrt', [strLit('x')], 5);
    const outer = callAt('forward', [inner], 9);
    expect(() => interpret(prog(exprStmt(outer))))
      .toThrow('Line 5: sqrt: expected number');
  });

  it('line-less ASTs (blocks path) keep unprefixed messages', () => {
    expect(() => interpret(prog(exprStmt(call('forward', [strLit('x')])))))
      .toThrow(/^forward: expected number/);
  });
});
