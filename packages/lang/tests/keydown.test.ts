import { describe, it, expect, beforeEach } from 'vitest';
import { interpretValue, setKeyState, SproutRuntimeError } from '../src/interpreter.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const symLit = (name: string): Expr => ({ kind: 'SymbolLit', name });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

const keyDownOf = (key: Expr) => interpretValue(prog(exprStmt(call('keyDown', [key]))));

describe('keyDown builtin', () => {
  beforeEach(() => {
    for (const k of ['left', 'right', 'up', 'down', 'space']) setKeyState(k, false);
  });

  it('returns false when the key is not held', () => {
    expect(keyDownOf(symLit('left'))).toEqual({ kind: 'bool', value: false });
  });

  it('returns true after setKeyState(key, true)', () => {
    setKeyState('left', true);
    expect(keyDownOf(symLit('left'))).toEqual({ kind: 'bool', value: true });
    expect(keyDownOf(symLit('right'))).toEqual({ kind: 'bool', value: false });
  });

  it('returns false again after the key is released', () => {
    setKeyState('space', true);
    setKeyState('space', false);
    expect(keyDownOf(symLit('space'))).toEqual({ kind: 'bool', value: false });
  });

  it('accepts a string key name', () => {
    setKeyState('up', true);
    expect(keyDownOf(strLit('up'))).toEqual({ kind: 'bool', value: true });
  });

  it('throws on an unknown key name', () => {
    expect(() => keyDownOf(symLit('banana'))).toThrow(SproutRuntimeError);
    expect(() => keyDownOf(symLit('banana'))).toThrow("keyDown: unknown key 'banana'");
  });

  it('tracks letter keys (WASD)', () => {
    setKeyState('w', true);
    expect(keyDownOf(symLit('w'))).toEqual({ kind: 'bool', value: true });
    expect(keyDownOf(symLit('s'))).toEqual({ kind: 'bool', value: false });
    setKeyState('w', false);
    expect(keyDownOf(symLit('w'))).toEqual({ kind: 'bool', value: false });
  });

  it('accepts any single letter a-z', () => {
    setKeyState('z', true);
    expect(keyDownOf(symLit('z'))).toEqual({ kind: 'bool', value: true });
    setKeyState('z', false);
  });

  it('rejects digits and multi-letter names', () => {
    expect(() => keyDownOf(symLit('ww'))).toThrow(SproutRuntimeError);
    expect(() => keyDownOf(strLit('1'))).toThrow(SproutRuntimeError);
  });

  it('mentions letters in the unknown-key error', () => {
    expect(() => keyDownOf(symLit('banana'))).toThrow(/letter a-z/);
  });

  it('throws with 0 args', () => {
    expect(() => interpretValue(prog(exprStmt(call('keyDown', []))))).toThrow('keyDown expects 1 argument');
  });

  it('throws on a number argument', () => {
    expect(() => keyDownOf(numLit(1))).toThrow(SproutRuntimeError);
  });
});
