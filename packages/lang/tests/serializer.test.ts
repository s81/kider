import { describe, it, expect } from 'vitest';
import { serialize, serializeExpr, serializeStmt } from '../src/serializer.js';
import type { Program, Expr, Stmt, InfixExpr, LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const symLit = (name: string): Expr => ({ kind: 'SymbolLit', name });
const boolLit = (value: boolean): Expr => ({ kind: 'BoolLit', value });
const ident = (name: string): Expr => ({ kind: 'Ident', name });
const infix = (op: InfixExpr['op'], left: Expr, right: Expr): Expr =>
  ({ kind: 'InfixExpr', op, left, right });
const call = (callee: string, args: Expr[], block: { kind: 'BlockExpr'; body: Stmt[] } | null = null): Expr =>
  ({ kind: 'CallExpr', callee, args, block });
const blockExpr = (body: Stmt[]): { kind: 'BlockExpr'; body: Stmt[] } =>
  ({ kind: 'BlockExpr', body });
const repeatExpr = (count: Expr, bodyStmts: Stmt[]): Expr =>
  ({ kind: 'RepeatExpr', count, body: { kind: 'BlockExpr', body: bodyStmts } });
const onExpr = (event: string, bodyStmts: Stmt[]): Expr =>
  ({ kind: 'OnExpr', event: { kind: 'SymbolLit', name: event }, body: { kind: 'BlockExpr', body: bodyStmts } });

const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const defStmt = (name: string, params: string[], body: Expr): Stmt =>
  ({ kind: 'DefStmt', name, params, body });
const letStmt = (name: string, init: Expr): LetStmt =>
  ({ kind: 'LetStmt', name, init });
const assignStmt = (name: string, value: Expr): AssignStmt =>
  ({ kind: 'AssignStmt', name, value });
const whileExpr = (cond: Expr, body: Stmt[]): WhileExpr => ({
  kind: 'WhileExpr',
  cond,
  body: { kind: 'BlockExpr', body },
});

const forEachE = (item: string, list: Expr, body: Stmt[]): Expr => ({
  kind: 'ForEachExpr' as const,
  item,
  list,
  body: { kind: 'BlockExpr', body },
});

const program = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

// ---------------------------------------------------------------------------
// 1. Literal kinds
// ---------------------------------------------------------------------------

describe('NumberLit', () => {
  it('serializes integer', () => {
    expect(serializeExpr(numLit(42))).toBe('42');
  });
  it('serializes float', () => {
    expect(serializeExpr(numLit(3.14))).toBe('3.14');
  });
  it('serializes zero', () => {
    expect(serializeExpr(numLit(0))).toBe('0');
  });
});

describe('StringLit', () => {
  it('serializes with double quotes', () => {
    expect(serializeExpr(strLit('hello'))).toBe('"hello"');
  });
  it('serializes empty string', () => {
    expect(serializeExpr(strLit(''))).toBe('""');
  });
});

describe('SymbolLit', () => {
  it('serializes with colon prefix', () => {
    expect(serializeExpr(symLit('click'))).toBe(':click');
  });
  it('serializes multi-word symbol', () => {
    expect(serializeExpr(symLit('key_down'))).toBe(':key_down');
  });
});

describe('BoolLit', () => {
  it('serializes true', () => {
    expect(serializeExpr(boolLit(true))).toBe('true');
  });
  it('serializes false', () => {
    expect(serializeExpr(boolLit(false))).toBe('false');
  });
});

describe('Ident', () => {
  it('serializes identifier name', () => {
    expect(serializeExpr(ident('square'))).toBe('square');
  });
  it('serializes multi-char identifier', () => {
    expect(serializeExpr(ident('myVar'))).toBe('myVar');
  });
});

// ---------------------------------------------------------------------------
// 2. InfixExpr
// ---------------------------------------------------------------------------

describe('InfixExpr', () => {
  it('serializes addition', () => {
    expect(serializeExpr(infix('+', numLit(100), numLit(50)))).toBe('100 + 50');
  });
  it('serializes subtraction', () => {
    expect(serializeExpr(infix('-', numLit(10), numLit(3)))).toBe('10 - 3');
  });
  it('serializes multiplication', () => {
    expect(serializeExpr(infix('*', numLit(6), numLit(7)))).toBe('6 * 7');
  });
  it('serializes division', () => {
    expect(serializeExpr(infix('/', numLit(360), ident('sides')))).toBe('360 / sides');
  });
  it('serializes nested infix', () => {
    expect(serializeExpr(infix('+', infix('*', numLit(2), numLit(3)), numLit(1)))).toBe('2 * 3 + 1');
  });
});

// ---------------------------------------------------------------------------
// 3. CallExpr
// ---------------------------------------------------------------------------

describe('CallExpr — no block', () => {
  it('no args produces callee()', () => {
    expect(serializeExpr(call('penUp', []))).toBe('penUp()');
  });
  it('one arg', () => {
    expect(serializeExpr(call('forward', [numLit(100)]))).toBe('forward(100)');
  });
  it('multiple args', () => {
    expect(serializeExpr(call('polygon', [numLit(6), numLit(80)]))).toBe('polygon(6, 80)');
  });
});

describe('CallExpr — with block', () => {
  it('no args with block uses callee do...end', () => {
    const result = serializeExpr(
      call('draw', [], blockExpr([exprStmt(call('forward', [numLit(10)]))])),
    );
    expect(result).toBe('draw do\n  forward(10)\nend');
  });
  it('args with block uses callee(args) do...end', () => {
    const result = serializeExpr(
      call('times', [numLit(3)], blockExpr([exprStmt(call('forward', [numLit(10)]))])),
    );
    expect(result).toBe('times(3) do\n  forward(10)\nend');
  });
  it('block body is indented by 2 spaces', () => {
    const result = serializeExpr(
      call('draw', [], blockExpr([
        exprStmt(call('forward', [numLit(10)])),
        exprStmt(call('turn', [numLit(90)])),
      ])),
    );
    expect(result).toBe('draw do\n  forward(10)\n  turn(90)\nend');
  });
});

// ---------------------------------------------------------------------------
// 4. RepeatExpr
// ---------------------------------------------------------------------------

describe('RepeatExpr', () => {
  it('serializes basic repeat', () => {
    const result = serializeExpr(
      repeatExpr(numLit(4), [
        exprStmt(call('forward', [numLit(100)])),
        exprStmt(call('turn', [numLit(90)])),
      ]),
    );
    expect(result).toBe('repeat 4 do\n  forward(100)\n  turn(90)\nend');
  });

  it('count can be an expression', () => {
    const result = serializeExpr(
      repeatExpr(ident('n'), [exprStmt(call('forward', [numLit(10)]))]),
    );
    expect(result).toBe('repeat n do\n  forward(10)\nend');
  });

  it('nested repeat is indented correctly', () => {
    const inner = repeatExpr(numLit(2), [exprStmt(call('forward', [numLit(5)]))]);
    const result = serializeExpr(
      repeatExpr(numLit(3), [exprStmt(inner)]),
    );
    expect(result).toBe(
      'repeat 3 do\n  repeat 2 do\n    forward(5)\n  end\nend',
    );
  });
});

// ---------------------------------------------------------------------------
// 5. OnExpr
// ---------------------------------------------------------------------------

describe('OnExpr', () => {
  it('serializes on :event do...end', () => {
    const result = serializeExpr(
      onExpr('click', [
        exprStmt(call('forward', [numLit(20)])),
        exprStmt(call('turn', [numLit(15)])),
      ]),
    );
    expect(result).toBe('on :click do\n  forward(20)\n  turn(15)\nend');
  });

  it('serializes with a single body statement', () => {
    const result = serializeExpr(
      onExpr('keydown', [exprStmt(call('penUp', []))]),
    );
    expect(result).toBe('on :keydown do\n  penUp()\nend');
  });
});

// ---------------------------------------------------------------------------
// 6. DefStmt
// ---------------------------------------------------------------------------

describe('DefStmt — no params', () => {
  it('serializes def with no params and an expr body', () => {
    const result = serializeStmt(
      defStmt('square', [], repeatExpr(numLit(4), [
        exprStmt(call('forward', [numLit(100)])),
        exprStmt(call('turn', [numLit(90)])),
      ])),
    );
    expect(result).toBe(
      'def square\n  repeat 4 do\n    forward(100)\n    turn(90)\n  end\nend',
    );
  });
});

describe('DefStmt — with params', () => {
  it('serializes def with one param', () => {
    const result = serializeStmt(
      defStmt('step', ['n'], call('forward', [ident('n')])),
    );
    expect(result).toBe('def step(n)\n  forward(n)\nend');
  });

  it('serializes def with multiple params', () => {
    const result = serializeStmt(
      defStmt('polygon', ['sides', 'size'], repeatExpr(ident('sides'), [
        exprStmt(call('forward', [ident('size')])),
        exprStmt(call('turn', [infix('/', numLit(360), ident('sides'))])),
      ])),
    );
    expect(result).toBe(
      'def polygon(sides, size)\n  repeat sides do\n    forward(size)\n    turn(360 / sides)\n  end\nend',
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Full Program serialization — 5 canonical examples
// ---------------------------------------------------------------------------

describe('Program serialization — 5 examples', () => {
  it('Example 1: Square', () => {
    const prog = program(
      exprStmt(repeatExpr(numLit(4), [
        exprStmt(call('forward', [numLit(100)])),
        exprStmt(call('turn', [numLit(90)])),
      ])),
    );
    expect(serialize(prog)).toBe(
      'repeat 4 do\n  forward(100)\n  turn(90)\nend',
    );
  });

  it('Example 2: Polygon (parameterized function)', () => {
    const prog = program(
      defStmt('polygon', ['sides', 'size'],
        repeatExpr(ident('sides'), [
          exprStmt(call('forward', [ident('size')])),
          exprStmt(call('turn', [infix('/', numLit(360), ident('sides'))])),
        ]),
      ),
      exprStmt(call('polygon', [numLit(6), numLit(80)])),
    );
    expect(serialize(prog)).toBe(
      'def polygon(sides, size)\n  repeat sides do\n    forward(size)\n    turn(360 / sides)\n  end\nend\n\npolygon(6, 80)',
    );
  });

  it('Example 3: Beside (composing two pictures)', () => {
    const prog = program(
      defStmt('square', [],
        repeatExpr(numLit(4), [
          exprStmt(call('forward', [numLit(100)])),
          exprStmt(call('turn', [numLit(90)])),
        ]),
      ),
      exprStmt(call('beside', [
        { kind: 'CallExpr' as const, callee: 'square', args: [], block: null },
        { kind: 'CallExpr' as const, callee: 'square', args: [], block: null },
      ])),
    );
    expect(serialize(prog)).toBe(
      'def square\n  repeat 4 do\n    forward(100)\n    turn(90)\n  end\nend\n\nbeside(square(), square())',
    );
  });

  it('Example 4: Repeat loop (8 sides, 45 degrees)', () => {
    const prog = program(
      exprStmt(repeatExpr(numLit(8), [
        exprStmt(call('forward', [numLit(60)])),
        exprStmt(call('turn', [numLit(45)])),
      ])),
    );
    expect(serialize(prog)).toBe(
      'repeat 8 do\n  forward(60)\n  turn(45)\nend',
    );
  });

  it('Example 5: Event handler', () => {
    const prog = program(
      exprStmt(onExpr('click', [
        exprStmt(call('forward', [numLit(20)])),
        exprStmt(call('turn', [numLit(15)])),
      ])),
    );
    expect(serialize(prog)).toBe(
      'on :click do\n  forward(20)\n  turn(15)\nend',
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Program separator logic
// ---------------------------------------------------------------------------

describe('Program separator logic', () => {
  it('two ExprStmts are joined with a single newline', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(10)])),
      exprStmt(call('turn', [numLit(90)])),
    );
    expect(serialize(prog)).toBe('forward(10)\nturn(90)');
  });

  it('DefStmt followed by ExprStmt is separated by blank line', () => {
    const prog = program(
      defStmt('f', [], call('forward', [numLit(10)])),
      exprStmt(call('f', [])),
    );
    expect(serialize(prog)).toBe('def f\n  forward(10)\nend\n\nf()');
  });

  it('ExprStmt followed by DefStmt is separated by blank line', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(10)])),
      defStmt('f', [], call('forward', [numLit(10)])),
    );
    expect(serialize(prog)).toBe('forward(10)\n\ndef f\n  forward(10)\nend');
  });

  it('two DefStmts are separated by blank line', () => {
    const prog = program(
      defStmt('f', [], call('forward', [numLit(10)])),
      defStmt('g', [], call('turn', [numLit(90)])),
    );
    expect(serialize(prog)).toBe(
      'def f\n  forward(10)\nend\n\ndef g\n  turn(90)\nend',
    );
  });

  it('empty program returns empty string', () => {
    expect(serialize(program())).toBe('');
  });
});

// ---------------------------------------------------------------------------
// IfExpr serialization
// ---------------------------------------------------------------------------

const ifExpr = (
  cond: Expr,
  thenStmts: Stmt[],
  elseStmts: Stmt[] | null = null,
): Expr => ({
  kind: 'IfExpr' as const,
  cond,
  then: { kind: 'BlockExpr' as const, body: thenStmts },
  else: elseStmts !== null ? { kind: 'BlockExpr' as const, body: elseStmts } : null,
});
const unary = (op: 'not', operand: Expr): Expr =>
  ({ kind: 'UnaryExpr' as const, op, operand });

describe('IfExpr serialization', () => {
  it('serializes if without else', () => {
    const expr = ifExpr(
      boolLit(true),
      [exprStmt(call('forward', [numLit(50)]))],
    );
    expect(serializeExpr(expr)).toBe('if true do\n  forward(50)\nend');
  });

  it('serializes if with else', () => {
    const expr = ifExpr(
      boolLit(false),
      [exprStmt(call('forward', [numLit(50)]))],
      [exprStmt(call('turn', [numLit(90)]))],
    );
    expect(serializeExpr(expr)).toBe('if false do\n  forward(50)\nelse\n  turn(90)\nend');
  });

  it('serializes nested if with comparison condition', () => {
    const expr = ifExpr(
      infix('<', numLit(3), numLit(10)),
      [exprStmt(call('forward', [numLit(1)]))],
    );
    expect(serializeExpr(expr)).toBe('if 3 < 10 do\n  forward(1)\nend');
  });
});

describe('UnaryExpr serialization', () => {
  it('serializes not true', () => {
    expect(serializeExpr(unary('not', boolLit(true)))).toBe('not true');
  });

  it('serializes not with nested comparison', () => {
    expect(serializeExpr(unary('not', infix('==', numLit(1), numLit(2))))).toBe('not 1 == 2');
  });
});

// ---------------------------------------------------------------------------
// LetStmt / AssignStmt / WhileExpr serialization
// ---------------------------------------------------------------------------
describe('LetStmt / AssignStmt / WhileExpr serialization', () => {
  it('serializes let statement', () => {
    expect(serializeStmt(letStmt('x', numLit(5)))).toBe('let x = 5');
  });

  it('serializes set statement', () => {
    expect(serializeStmt(assignStmt('x', infix('+', ident('x'), numLit(1))))).toBe('set x = x + 1');
  });

  it('serializes while expression', () => {
    const expr = whileExpr(
      infix('<', ident('x'), numLit(10)),
      [exprStmt(call('forward', [ident('x')]))],
    );
    expect(serializeExpr(expr)).toBe('while x < 10 do\n  forward(x)\nend');
  });

  it('serializes canonical counting pattern', () => {
    const prog = program(
      letStmt('x', numLit(0)),
      exprStmt(whileExpr(
        infix('<', ident('x'), numLit(3)),
        [
          exprStmt(call('forward', [ident('x')])),
          assignStmt('x', infix('+', ident('x'), numLit(1))),
        ],
      )),
    );
    expect(serialize(prog)).toBe(
      'let x = 0\n' +
      'while x < 3 do\n' +
      '  forward(x)\n' +
      '  set x = x + 1\n' +
      'end'
    );
  });
});

describe('ForEachExpr', () => {
  it('serializes for each loop', () => {
    const expr = forEachE('x', call('list', [numLit(1), numLit(2)]), [
      exprStmt(call('forward', [ident('x')])),
    ]);
    expect(serializeExpr(expr)).toBe(
      'for each x in list(1, 2) do\n  forward(x)\nend'
    );
  });
});
