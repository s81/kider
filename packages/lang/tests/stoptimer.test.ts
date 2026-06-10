import { describe, it, expect } from 'vitest';
import { interpretFull, callHandler } from '../src/interpreter.js';
import { mkSequence, mkForward } from '../src/values.js';
import type { Program, Stmt, Expr, BlockExpr, SymbolLit } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const sym = (name: string): SymbolLit => ({ kind: 'SymbolLit', name });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });
const blockE = (...body: Stmt[]): BlockExpr => ({ kind: 'BlockExpr', body });
const onE = (event: string, ...body: Stmt[]): Expr =>
  ({ kind: 'OnExpr', event: sym(event), body: blockE(...body), interval: null });

function clickHandlerOf(program: Program) {
  const { handlers } = interpretFull(program);
  const fn = handlers.get(':click');
  if (!fn) throw new Error('no :click handler registered');
  return fn;
}

describe('stopTimer builtin', () => {
  it('handler calling stopTimer() reports stopTimer: true and keeps its drawing', () => {
    const fn = clickHandlerOf(prog(exprStmt(onE('click',
      exprStmt(call('forward', [numLit(50)])),
      exprStmt(call('stopTimer', [])),
    ))));
    const result = callHandler(fn);
    expect(result.stopTimer).toBe(true);
    expect(result.drawing).toEqual(mkSequence([mkForward(50), { kind: 'empty' }]));
  });

  it('handler not calling stopTimer() reports stopTimer: false', () => {
    const fn = clickHandlerOf(prog(exprStmt(onE('click',
      exprStmt(call('forward', [numLit(10)])),
    ))));
    expect(callHandler(fn).stopTimer).toBe(false);
  });

  it('the flag resets between handler invocations', () => {
    const stopper = clickHandlerOf(prog(exprStmt(onE('click', exprStmt(call('stopTimer', []))))));
    expect(callHandler(stopper).stopTimer).toBe(true);
    const benign = clickHandlerOf(prog(exprStmt(onE('click', exprStmt(call('forward', [numLit(1)]))))));
    expect(callHandler(benign).stopTimer).toBe(false);
  });

  it('interpretFull reports stopTimer: true for a top-level call', () => {
    const { stopTimer } = interpretFull(prog(exprStmt(call('stopTimer', []))));
    expect(stopTimer).toBe(true);
  });

  it('interpretFull reports stopTimer: false otherwise', () => {
    const { stopTimer } = interpretFull(prog(exprStmt(call('forward', [numLit(5)]))));
    expect(stopTimer).toBe(false);
  });

  it('throws with 1 arg', () => {
    expect(() => interpretFull(prog(exprStmt(call('stopTimer', [numLit(1)])))))
      .toThrow('stopTimer expects 0 arguments');
  });
});
