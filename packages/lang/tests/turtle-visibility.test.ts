import { describe, it, expect } from 'vitest';
import { interpret } from '../src/interpreter.js';
import { render } from '../src/renderer.js';
import { HIDE_TURTLE, SHOW_TURTLE, mkSequence } from '../src/values.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

describe('hideTurtle / showTurtle — interpreter', () => {
  it('hideTurtle() produces the hideTurtle drawing', () => {
    expect(interpret(prog(exprStmt(call('hideTurtle', [])))))
      .toEqual(mkSequence([HIDE_TURTLE]));
  });

  it('showTurtle() produces the showTurtle drawing', () => {
    expect(interpret(prog(exprStmt(call('showTurtle', [])))))
      .toEqual(mkSequence([SHOW_TURTLE]));
  });

  it('hideTurtle throws with 1 arg', () => {
    expect(() => interpret(prog(exprStmt(call('hideTurtle', [numLit(1)])))))
      .toThrow('hideTurtle expects 0 arguments');
  });

  it('showTurtle throws with 1 arg', () => {
    expect(() => interpret(prog(exprStmt(call('showTurtle', [numLit(1)])))))
      .toThrow('showTurtle expects 0 arguments');
  });
});

describe('hideTurtle / showTurtle — renderer', () => {
  it('emits visibility commands in sequence order', () => {
    const drawing = interpret(prog(
      exprStmt(call('forward', [numLit(50)])),
      exprStmt(call('hideTurtle', [])),
      exprStmt(call('showTurtle', [])),
    ));
    const cmds = render(drawing);
    const kinds = cmds.map(c => c.kind);
    const hideIdx = kinds.indexOf('hideTurtle');
    const showIdx = kinds.indexOf('showTurtle');
    expect(hideIdx).toBeGreaterThan(kinds.indexOf('lineTo'));
    expect(showIdx).toBe(hideIdx + 1);
  });
});
