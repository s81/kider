import { describe, it, expect, beforeEach } from 'vitest';
import { interpretValue, setTextInputs, collectTextInputNames, SproutRuntimeError } from '../src/interpreter.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const ident = (name: string): Expr => ({ kind: 'Ident', name });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

describe('textInput builtin', () => {
  beforeEach(() => {
    setTextInputs(new Map());
  });

  it('returns the value set by the host', () => {
    setTextInputs(new Map([['name', 'Sami']]));
    expect(interpretValue(prog(exprStmt(call('textInput', [strLit('name')])))))
      .toEqual({ kind: 'string', value: 'Sami' });
  });

  it('returns "" when the field is unset', () => {
    expect(interpretValue(prog(exprStmt(call('textInput', [strLit('name')])))))
      .toEqual({ kind: 'string', value: '' });
  });

  it('throws with 0 args', () => {
    expect(() => interpretValue(prog(exprStmt(call('textInput', [])))))
      .toThrow('textInput expects 1 argument');
  });

  it('throws on a number arg', () => {
    expect(() => interpretValue(prog(exprStmt(call('textInput', [numLit(1)])))))
      .toThrow(SproutRuntimeError);
  });
});

describe('collectTextInputNames', () => {
  it('finds names in document order, deduplicated', () => {
    const p = prog(
      exprStmt(call('textInput', [strLit('name')])),
      exprStmt(call('textInput', [strLit('color')])),
      exprStmt(call('textInput', [strLit('name')])),
    );
    expect(collectTextInputNames(p)).toEqual(['name', 'color']);
  });

  it('ignores non-literal arguments and other callees', () => {
    const p = prog(
      exprStmt(call('textInput', [ident('x')])),
      exprStmt(call('input', [strLit('speed')])),
    );
    expect(collectTextInputNames(p)).toEqual([]);
  });
});
