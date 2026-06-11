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
    expect(() => interpretValue(prog(exprStmt(call('gotoSprite', [strLit('ghost-d'), numLit(1), numLit(2)])))))
      .toThrow("gotoSprite: no sprite named 'ghost-d'");
  });
});

describe('sprite motion', () => {
  it('moveSprite at heading 0 moves up (negative y)', () => {
    const v = interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('moveSprite', [strLit('cat'), numLit(50)])),
      exprStmt(call('spriteY', [strLit('cat')])),
    ));
    expect(num(v)).toBeCloseTo(-50);
  });

  it('turnSprite 90 then moveSprite moves right (+x)', () => {
    const v = interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('turnSprite', [strLit('cat'), numLit(90)])),
      exprStmt(call('moveSprite', [strLit('cat'), numLit(50)])),
      exprStmt(call('spriteX', [strLit('cat')])),
    ));
    expect(num(v)).toBeCloseTo(50);
  });

  it('heading normalizes into [0, 360)', () => {
    // -90 ≡ 270 → moveSprite goes left (-x)
    const v = interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('turnSprite', [strLit('cat'), numLit(-90)])),
      exprStmt(call('moveSprite', [strLit('cat'), numLit(50)])),
      exprStmt(call('spriteX', [strLit('cat')])),
    ));
    expect(num(v)).toBeCloseTo(-50);
  });
});

describe('spritesTouching', () => {
  const bool = (v: unknown): boolean => (v as { kind: 'bool'; value: boolean }).value;

  it('true when circles overlap (radius from costume bbox)', () => {
    // circle(15) → bbox 30×30 → radius 15; r1+r2 = 30 ≥ distance 20
    const v = interpretValue(prog(
      mkSprite('a', 15),
      mkSprite('b', 15),
      exprStmt(call('gotoSprite', [strLit('b'), numLit(20), numLit(0)])),
      exprStmt(call('spritesTouching', [strLit('a'), strLit('b')])),
    ));
    expect(bool(v)).toBe(true);
  });

  it('false when apart', () => {
    const v = interpretValue(prog(
      mkSprite('a', 15),
      mkSprite('b', 15),
      exprStmt(call('gotoSprite', [strLit('b'), numLit(100), numLit(0)])),
      exprStmt(call('spritesTouching', [strLit('a'), strLit('b')])),
    ));
    expect(bool(v)).toBe(false);
  });

  it('hidden sprites never touch', () => {
    const v = interpretValue(prog(
      mkSprite('a', 15),
      mkSprite('b', 15),
      exprStmt(call('hideSprite', [strLit('b')])),
      exprStmt(call('spritesTouching', [strLit('a'), strLit('b')])),
    ));
    expect(bool(v)).toBe(false);
  });

  it('showSprite restores collision', () => {
    const v = interpretValue(prog(
      mkSprite('a', 15),
      mkSprite('b', 15),
      exprStmt(call('hideSprite', [strLit('b')])),
      exprStmt(call('showSprite', [strLit('b')])),
      exprStmt(call('spritesTouching', [strLit('a'), strLit('b')])),
    ));
    expect(bool(v)).toBe(true);
  });

  it('errors name the failing argument', () => {
    expect(() => interpretValue(prog(
      mkSprite('a'),
      exprStmt(call('spritesTouching', [strLit('a'), strLit('ghost-b')])),
    ))).toThrow("spritesTouching: no sprite named 'ghost-b'");
  });
});

describe('removeSprite', () => {
  it('removed sprites are gone', () => {
    expect(() => interpretValue(prog(
      mkSprite('cat'),
      exprStmt(call('removeSprite', [strLit('cat')])),
      exprStmt(call('spriteX', [strLit('cat')])),
    ))).toThrow("spriteX: no sprite named 'cat'");
  });

  it('removing an unknown sprite throws', () => {
    expect(() => interpretValue(prog(exprStmt(call('removeSprite', [strLit('ghost-c')])))))
      .toThrow("removeSprite: no sprite named 'ghost-c'");
  });
});
