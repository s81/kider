import { describe, it, expect } from 'vitest';
import { interpretValue } from '../src/interpreter.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

/** sprite("name", circle(15)) statement */
const mkSprite = (name: string, radius = 15): Stmt =>
  exprStmt(call('sprite', [strLit(name), call('circle', [numLit(radius)])]));

const num = (v: unknown): number => (v as { kind: 'number'; value: number }).value;

describe('sprite creation and position', () => {
  it('sprite() creates at (0,0); spriteX/spriteY read position', () => {
    expect(num(interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('spriteX', [strLit('cat')])),
    )))).toBe(0);
    expect(num(interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('spriteY', [strLit('cat')])),
    )))).toBe(0);
  });

  it('gotoSprite teleports', () => {
    expect(num(interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('gotoSprite', [strLit('cat'), numLit(30), numLit(-40)])),
      exprStmt(call('spriteY', [strLit('cat')])),
    )))).toBe(-40);
  });

  it('changeSpriteX / changeSpriteY are relative', () => {
    expect(num(interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('gotoSprite', [strLit('cat'), numLit(10), numLit(10)])),
      exprStmt(call('changeSpriteX', [strLit('cat'), numLit(-5)])),
      exprStmt(call('spriteX', [strLit('cat')])),
    )))).toBe(5);
    expect(num(interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('changeSpriteY', [strLit('cat'), numLit(7)])),
      exprStmt(call('spriteY', [strLit('cat')])),
    )))).toBe(7);
  });

  it('errors: unknown sprite, bad types, arity', () => {
    expect(() => interpretValue(prog(exprStmt(call('spriteX', [strLit('ghost-a')])))))
      .toThrow("spriteX: no sprite named 'ghost-a'");
    expect(() => interpretValue(prog(exprStmt(call('sprite', [numLit(1), call('circle', [numLit(5)])])))))
      .toThrow('sprite: expected string, got number');
    expect(() => interpretValue(prog(exprStmt(call('sprite', [strLit('cat'), numLit(7)])))))
      .toThrow('sprite: expected drawing, got number');
    expect(() => interpretValue(prog(exprStmt(call('gotoSprite', [strLit('cat'), numLit(1)])))))
      .toThrow('gotoSprite expects 3 arguments, got 2');
  });
});
