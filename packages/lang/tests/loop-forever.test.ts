import { describe, it, expect } from 'vitest';
import { interpretFull, collectInputNames, SproutRuntimeError } from '../src/interpreter.js';
import { serialize } from '../src/serializer.js';
import type { Program, Stmt, Expr, LoopForeverExpr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

const loopForeverExpr = (...stmts: Stmt[]): LoopForeverExpr => ({
  kind: 'LoopForeverExpr',
  body: { kind: 'BlockExpr', body: stmts },
});

describe('loop forever interpreter', () => {
  it('registers a :timer handler', () => {
    const { handlers } = interpretFull(prog(
      exprStmt(loopForeverExpr(exprStmt(call('forward', [numLit(10)])))),
    ));
    expect(handlers.has(':timer')).toBe(true);
    expect(handlers.get(':timer')!.kind).toBe('function');
    expect(handlers.get(':timer')!.params).toHaveLength(0);
  });

  it('sets timerInterval to 16', () => {
    const { timerInterval } = interpretFull(prog(
      exprStmt(loopForeverExpr(exprStmt(call('forward', [numLit(10)])))),
    ));
    expect(timerInterval).toBe(16);
  });

  it('produces no immediate drawing output', () => {
    const { drawing } = interpretFull(prog(
      exprStmt(loopForeverExpr(exprStmt(call('forward', [numLit(10)])))),
    ));
    expect(drawing).toEqual({ kind: 'empty' });
  });

  it('throws when used in expression position', () => {
    const letStmt: Stmt = { kind: 'LetStmt', name: 'x', init: loopForeverExpr() };
    expect(() => interpretFull(prog(letStmt))).toThrow(SproutRuntimeError);
  });

  it('collectInputNames finds input() inside the body', () => {
    const names = collectInputNames(prog(
      exprStmt(loopForeverExpr(exprStmt(call('input', [strLit('speed')])))),
    ));
    expect(names).toContain('speed');
  });
});

describe('loop forever serializer', () => {
  it('serializes to loop forever do...end', () => {
    const text = serialize(prog(
      exprStmt(loopForeverExpr(exprStmt(call('forward', [numLit(10)])))),
    ));
    expect(text).toBe('loop forever do\n  forward(10)\nend');
  });
});
