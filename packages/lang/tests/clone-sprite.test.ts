import { describe, it, expect } from 'vitest';
import { interpretFull, SproutRuntimeError } from '../src/interpreter.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const letStmt = (name: string, init: Expr): Stmt =>
  ({ kind: 'LetStmt', name, init });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

const mkSprite = (name: string): Stmt =>
  exprStmt(call('sprite', [strLit(name), call('circle', [numLit(15)])]));

describe('cloneSprite', () => {
  it('clone name is "<base>-1" for first clone', () => {
    const { variables } = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    expect(variables['c']).toBe('ball-1');
  });

  it('second clone is "<base>-2"', () => {
    const { variables } = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c1', call('cloneSprite', [strLit('ball')])),
      letStmt('c2', call('cloneSprite', [strLit('ball')])),
    ));
    expect(variables['c1']).toBe('ball-1');
    expect(variables['c2']).toBe('ball-2');
  });

  it('clone inherits position and heading from original', () => {
    const { sprites } = interpretFull(prog(
      mkSprite('ball'),
      exprStmt(call('gotoSprite', [strLit('ball'), numLit(30), numLit(-40)])),
      exprStmt(call('turnSprite', [strLit('ball'), numLit(90)])),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    const clone = sprites.find(s => s.name === 'ball-1');
    expect(clone).toBeDefined();
    expect(clone!.x).toBe(30);
    expect(clone!.y).toBe(-40);
    expect(clone!.heading).toBe(90);
    expect(clone!.visible).toBe(true);
  });

  it('clone is independent — moving it does not move the original', () => {
    const { sprites } = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
      exprStmt(call('gotoSprite', [strLit('ball-1'), numLit(100), numLit(100)])),
    ));
    const original = sprites.find(s => s.name === 'ball')!;
    const clone = sprites.find(s => s.name === 'ball-1')!;
    expect(original.x).toBe(0);
    expect(clone.x).toBe(100);
  });

  it('clone appears in interpretFull sprite snapshots', () => {
    const { sprites } = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    expect(sprites.map(s => s.name)).toEqual(['ball', 'ball-1']);
  });

  it('throws on unknown sprite', () => {
    expect(() => interpretFull(prog(
      letStmt('c', call('cloneSprite', [strLit('ghost')])),
    ))).toThrow(SproutRuntimeError);
  });

  it('throws on wrong arity', () => {
    expect(() => interpretFull(prog(
      letStmt('c', call('cloneSprite', [])),
    ))).toThrow(SproutRuntimeError);
  });

  it('counter resets between runs', () => {
    const first = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    expect(first.variables['c']).toBe('ball-1');
    const second = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    expect(second.variables['c']).toBe('ball-1');
  });
});
