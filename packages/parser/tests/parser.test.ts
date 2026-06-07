import { describe, it, expect } from 'vitest';
import { tokenize, ParseError } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import type { Program, LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '@sprout/lang';

// Shorthand builders for expected AST values
const num = (n: number) => ({ kind: 'NumberLit' as const, value: n });
const str = (s: string) => ({ kind: 'StringLit' as const, value: s });
const sym = (n: string) => ({ kind: 'SymbolLit' as const, name: n });
const bool_ = (v: boolean) => ({ kind: 'BoolLit' as const, value: v });
const id = (n: string) => ({ kind: 'Ident' as const, name: n });
const infix = (op: string, l: object, r: object) =>
  ({ kind: 'InfixExpr' as const, op, left: l, right: r });
const callE = (callee: string, args: object[], block = null) =>
  ({ kind: 'CallExpr' as const, callee, args, block });
const blockE = (body: object[]) => ({ kind: 'BlockExpr' as const, body });
const repeatE = (count: object, body: object[]) =>
  ({ kind: 'RepeatExpr' as const, count, body: blockE(body) });
const onE = (name: string, body: object[]) =>
  ({ kind: 'OnExpr' as const, event: sym(name), body: blockE(body), interval: null });
const exprS = (expr: object) => ({ kind: 'ExprStmt' as const, expr });
const defS = (name: string, params: string[], body: object) =>
  ({ kind: 'DefStmt' as const, name, params, body });
const prog = (...stmts: object[]): Program =>
  ({ kind: 'Program', stmts: stmts as Program['stmts'] });
const ifE = (cond: object, thenBody: object[], elseBody: object[] | null = null) => ({
  kind: 'IfExpr' as const,
  cond,
  then: blockE(thenBody),
  else: elseBody !== null ? blockE(elseBody) : null,
});
const unaryE = (op: 'not', operand: object) =>
  ({ kind: 'UnaryExpr' as const, op, operand });
const letS = (name: string, init: object): LetStmt =>
  ({ kind: 'LetStmt' as const, name, init: init as never });
const assignS = (name: string, value: object): AssignStmt =>
  ({ kind: 'AssignStmt' as const, name, value: value as never });
const whileE = (cond: object, body: object[]): WhileExpr => ({
  kind: 'WhileExpr' as const,
  cond: cond as never,
  body: blockE(body) as never,
});
const forEachE = (item: string, list: object, body: object[]): ForEachExpr => ({
  kind: 'ForEachExpr' as const,
  item,
  list: list as never,
  body: blockE(body) as never,
});

describe('tokenize', () => {
  it('tokenizes an integer number', () => {
    expect(tokenize('42')).toEqual([
      { kind: 'NUMBER', value: 42 },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes a float number', () => {
    expect(tokenize('3.14')).toEqual([
      { kind: 'NUMBER', value: 3.14 },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes a string literal', () => {
    expect(tokenize('"hello"')).toEqual([
      { kind: 'STRING', value: 'hello' },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes a symbol literal', () => {
    expect(tokenize(':click')).toEqual([
      { kind: 'SYMBOL', name: 'click' },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes an identifier', () => {
    expect(tokenize('forward')).toEqual([
      { kind: 'IDENT', name: 'forward' },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes operators', () => {
    expect(tokenize('+ - * /')).toEqual([
      { kind: 'PLUS' },
      { kind: 'MINUS' },
      { kind: 'STAR' },
      { kind: 'SLASH' },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes punctuation', () => {
    expect(tokenize('(,)=')).toEqual([
      { kind: 'LPAREN' },
      { kind: 'COMMA' },
      { kind: 'RPAREN' },
      { kind: 'EQ' },
      { kind: 'EOF' },
    ]);
  });

  it('skips whitespace and newlines', () => {
    expect(tokenize('  forward\n  100\n')).toEqual([
      { kind: 'IDENT', name: 'forward' },
      { kind: 'NUMBER', value: 100 },
      { kind: 'EOF' },
    ]);
  });

  it('throws ParseError for unterminated string', () => {
    expect(() => tokenize('"unterminated')).toThrow(ParseError);
  });

  it('throws ParseError for unexpected character', () => {
    expect(() => tokenize('@')).toThrow(ParseError);
  });

  it('tokenizes a realistic snippet', () => {
    const src = 'forward(100)';
    expect(tokenize(src)).toEqual([
      { kind: 'IDENT', name: 'forward' },
      { kind: 'LPAREN' },
      { kind: 'NUMBER', value: 100 },
      { kind: 'RPAREN' },
      { kind: 'EOF' },
    ]);
  });

  it('tokenizes < and >', () => {
    expect(tokenize('< >')).toEqual([{ kind: 'LT' }, { kind: 'GT' }, { kind: 'EOF' }]);
  });

  it('tokenizes <= and >=', () => {
    expect(tokenize('<= >=')).toEqual([{ kind: 'LTE' }, { kind: 'GTE' }, { kind: 'EOF' }]);
  });

  it('tokenizes == and !=', () => {
    expect(tokenize('== !=')).toEqual([{ kind: 'EQEQ' }, { kind: 'NEQ' }, { kind: 'EOF' }]);
  });

  it('does not confuse = with ==', () => {
    expect(tokenize('=')).toEqual([{ kind: 'EQ' }, { kind: 'EOF' }]);
    expect(tokenize('==')).toEqual([{ kind: 'EQEQ' }, { kind: 'EOF' }]);
  });

  it('does not confuse < with <=', () => {
    expect(tokenize('<')).toEqual([{ kind: 'LT' }, { kind: 'EOF' }]);
    expect(tokenize('<=')).toEqual([{ kind: 'LTE' }, { kind: 'EOF' }]);
  });
});

describe('parse — literals', () => {
  it('parses integer', () => {
    expect(parse('42')).toEqual(prog(exprS(num(42))));
  });

  it('parses float', () => {
    expect(parse('3.14')).toEqual(prog(exprS(num(3.14))));
  });

  it('parses string', () => {
    expect(parse('"hello"')).toEqual(prog(exprS(str('hello'))));
  });

  it('parses symbol', () => {
    expect(parse(':click')).toEqual(prog(exprS(sym('click'))));
  });

  it('parses true', () => {
    expect(parse('true')).toEqual(prog(exprS(bool_(true))));
  });

  it('parses false', () => {
    expect(parse('false')).toEqual(prog(exprS(bool_(false))));
  });

  it('parses bare identifier', () => {
    expect(parse('n')).toEqual(prog(exprS(id('n'))));
  });
});

describe('parse — function calls', () => {
  it('parses zero-arg call', () => {
    expect(parse('square()')).toEqual(prog(exprS(callE('square', []))));
  });

  it('parses single-arg call', () => {
    expect(parse('forward(100)')).toEqual(
      prog(exprS(callE('forward', [num(100)])))
    );
  });

  it('parses multi-arg call', () => {
    expect(parse('polygon(6, 80)')).toEqual(
      prog(exprS(callE('polygon', [num(6), num(80)])))
    );
  });
});

describe('parse — infix expressions', () => {
  it('parses addition', () => {
    expect(parse('1 + 2')).toEqual(
      prog(exprS(infix('+', num(1), num(2))))
    );
  });

  it('parses subtraction', () => {
    expect(parse('10 - 3')).toEqual(
      prog(exprS(infix('-', num(10), num(3))))
    );
  });

  it('gives * higher precedence than +', () => {
    expect(parse('2 + 3 * 4')).toEqual(
      prog(exprS(infix('+', num(2), infix('*', num(3), num(4)))))
    );
  });

  it('gives / higher precedence than -', () => {
    expect(parse('10 - 6 / 2')).toEqual(
      prog(exprS(infix('-', num(10), infix('/', num(6), num(2)))))
    );
  });

  it('left-associates same-precedence operators', () => {
    expect(parse('1 + 2 + 3')).toEqual(
      prog(exprS(infix('+', infix('+', num(1), num(2)), num(3))))
    );
  });

  it('parses parenthesized expression overriding precedence', () => {
    expect(parse('(1 + 2) * 3')).toEqual(
      prog(exprS(infix('*', infix('+', num(1), num(2)), num(3))))
    );
  });

  it('parses infix inside call arg', () => {
    expect(parse('turn(360 / 4)')).toEqual(
      prog(exprS(callE('turn', [infix('/', num(360), num(4))])))
    );
  });
});

describe('parse — repeat', () => {
  it('parses repeat with number count', () => {
    expect(parse('repeat 4 do\n  forward(100)\nend')).toEqual(
      prog(exprS(repeatE(num(4), [exprS(callE('forward', [num(100)]))])))
    );
  });

  it('parses repeat with identifier count', () => {
    expect(parse('repeat sides do\n  forward(size)\nend')).toEqual(
      prog(exprS(repeatE(id('sides'), [exprS(callE('forward', [id('size')]))])))
    );
  });

  it('parses repeat with infix count', () => {
    expect(parse('repeat 2 * 4 do\n  forward(10)\nend')).toEqual(
      prog(exprS(repeatE(
        infix('*', num(2), num(4)),
        [exprS(callE('forward', [num(10)]))]
      )))
    );
  });

  it('parses nested repeat', () => {
    const src = 'repeat 4 do\n  repeat 4 do\n    forward(10)\n  end\nend';
    const inner = repeatE(num(4), [exprS(callE('forward', [num(10)]))]);
    const outer = repeatE(num(4), [exprS(inner)]);
    expect(parse(src)).toEqual(prog(exprS(outer)));
  });
});

describe('parse — on event', () => {
  it('parses on :click do...end', () => {
    expect(parse('on :click do\n  forward(20)\nend')).toEqual(
      prog(exprS(onE('click', [exprS(callE('forward', [num(20)]))])))
    );
  });
});

const onTimerE = (interval: object | null, body: object[]) =>
  ({ kind: 'OnExpr' as const, event: sym('timer'), body: blockE(body), interval });

describe('parse — on timer (ident form)', () => {
  it('parses on timer do...end with null interval', () => {
    expect(parse('on timer do\n  forward(10)\nend')).toEqual(
      prog(exprS(onTimerE(null, [exprS(callE('forward', [num(10)]))])))
    );
  });

  it('parses on timer every 500 do...end', () => {
    expect(parse('on timer every 500 do\n  forward(10)\nend')).toEqual(
      prog(exprS(onTimerE(num(500), [exprS(callE('forward', [num(10)]))])))
    );
  });

  it('on :timer do...end (old symbol form) still parses with null interval', () => {
    expect(parse('on :timer do\n  forward(10)\nend')).toEqual(
      prog(exprS(onE('timer', [exprS(callE('forward', [num(10)]))])))
    );
  });

  it('on timer every expr do...end parses interval as expression', () => {
    const result = parse('on timer every 100 do\n  forward(1)\nend');
    const expr = (result.stmts[0] as { expr: { interval: { value: number } } }).expr;
    expect(expr.interval).toEqual(num(100));
  });
});

describe('parse — def statement', () => {
  it('parses single-line def with = expr', () => {
    expect(parse('def side = 100')).toEqual(
      prog(defS('side', [], num(100)))
    );
  });

  it('parses def with block body (no params)', () => {
    const src = 'def square\n  repeat 4 do\n    forward(100)\n    turn(90)\n  end\nend';
    const body = blockE([
      exprS(repeatE(num(4), [
        exprS(callE('forward', [num(100)])),
        exprS(callE('turn', [num(90)])),
      ]))
    ]);
    expect(parse(src)).toEqual(prog(defS('square', [], body)));
  });

  it('parses def with params and block body', () => {
    const src = 'def polygon(sides, size)\n  repeat sides do\n    forward(size)\n    turn(360 / sides)\n  end\nend';
    const body = blockE([
      exprS(repeatE(id('sides'), [
        exprS(callE('forward', [id('size')])),
        exprS(callE('turn', [infix('/', num(360), id('sides'))])),
      ]))
    ]);
    expect(parse(src)).toEqual(prog(defS('polygon', ['sides', 'size'], body)));
  });

  it('parses single-line def with params', () => {
    expect(parse('def double(x) = x + x')).toEqual(
      prog(defS('double', ['x'], infix('+', id('x'), id('x'))))
    );
  });
});

describe('parse — multi-statement program', () => {
  it('parses two statements in sequence', () => {
    expect(parse('forward(100)\nturn(90)')).toEqual(
      prog(
        exprS(callE('forward', [num(100)])),
        exprS(callE('turn', [num(90)])),
      )
    );
  });

  it('parses def followed by call', () => {
    const src = 'def sq\n  forward(50)\nend\nsq()';
    const body = blockE([exprS(callE('forward', [num(50)]))]);
    expect(parse(src)).toEqual(
      prog(
        defS('sq', [], body),
        exprS(callE('sq', [])),
      )
    );
  });
});

describe('parse — error cases', () => {
  it('throws ParseError on unterminated string', () => {
    expect(() => parse('"oops')).toThrow(ParseError);
  });

  it('throws ParseError on unexpected EOF in call args', () => {
    expect(() => parse('forward(')).toThrow(ParseError);
  });
});

describe('parse — comparison operators', () => {
  it('parses x < y', () => {
    expect(parse('3 < 10')).toEqual(prog(exprS(infix('<', num(3), num(10)))));
  });

  it('parses x > y', () => {
    expect(parse('10 > 3')).toEqual(prog(exprS(infix('>', num(10), num(3)))));
  });

  it('parses x <= y', () => {
    expect(parse('4 <= 4')).toEqual(prog(exprS(infix('<=', num(4), num(4)))));
  });

  it('parses x >= y', () => {
    expect(parse('5 >= 3')).toEqual(prog(exprS(infix('>=', num(5), num(3)))));
  });

  it('parses x == y', () => {
    expect(parse('7 == 7')).toEqual(prog(exprS(infix('==', num(7), num(7)))));
  });

  it('parses x != y', () => {
    expect(parse('7 != 8')).toEqual(prog(exprS(infix('!=', num(7), num(8)))));
  });
});

describe('parse — boolean operators', () => {
  it('parses not expr', () => {
    expect(parse('not true')).toEqual(prog(exprS(unaryE('not', bool_(true)))));
  });

  it('parses a and b', () => {
    expect(parse('true and false')).toEqual(
      prog(exprS(infix('and', bool_(true), bool_(false))))
    );
  });

  it('parses a or b', () => {
    expect(parse('false or true')).toEqual(
      prog(exprS(infix('or', bool_(false), bool_(true))))
    );
  });

  it('and has higher precedence than or', () => {
    // false or true and false  →  false or (true and false)
    expect(parse('false or true and false')).toEqual(
      prog(exprS(infix('or', bool_(false), infix('and', bool_(true), bool_(false)))))
    );
  });

  it('comparison has higher precedence than and', () => {
    // 3 < 10 and 5 > 0  →  (3 < 10) and (5 > 0)
    expect(parse('3 < 10 and 5 > 0')).toEqual(
      prog(exprS(infix('and', infix('<', num(3), num(10)), infix('>', num(5), num(0)))))
    );
  });
});

describe('parse — if expression', () => {
  it('parses if without else', () => {
    expect(parse('if true do\n  forward(50)\nend')).toEqual(
      prog(exprS(ifE(bool_(true), [exprS(callE('forward', [num(50)]))])))
    );
  });

  it('parses if with else', () => {
    expect(parse('if false do\n  forward(50)\nelse\n  turn(90)\nend')).toEqual(
      prog(exprS(ifE(
        bool_(false),
        [exprS(callE('forward', [num(50)]))],
        [exprS(callE('turn', [num(90)]))],
      )))
    );
  });

  it('parses if with comparison condition', () => {
    expect(parse('if 3 < 10 do\n  forward(1)\nend')).toEqual(
      prog(exprS(ifE(infix('<', num(3), num(10)), [exprS(callE('forward', [num(1)]))])))
    );
  });

  it('parses nested if inside if body', () => {
    expect(parse('if true do\n  if false do\n    forward(1)\n  end\nend')).toEqual(
      prog(exprS(ifE(
        bool_(true),
        [exprS(ifE(bool_(false), [exprS(callE('forward', [num(1)]))]))]
      )))
    );
  });
});

describe('parse — let / set / while', () => {
  it('parses let statement', () => {
    expect(parse('let x = 5')).toEqual(prog(letS('x', num(5))));
  });

  it('parses set statement', () => {
    expect(parse('set x = x + 1')).toEqual(
      prog(assignS('x', infix('+', id('x'), num(1))))
    );
  });

  it('parses while with comparison condition', () => {
    expect(parse('while x < 10 do\n  forward(x)\nend')).toEqual(
      prog(exprS(whileE(
        infix('<', id('x'), num(10)),
        [exprS(callE('forward', [id('x')]))],
      )))
    );
  });

  it('parses canonical counting pattern', () => {
    const src = 'let x = 0\nwhile x < 3 do\n  forward(x)\n  set x = x + 1\nend';
    expect(parse(src)).toEqual(
      prog(
        letS('x', num(0)),
        exprS(whileE(
          infix('<', id('x'), num(3)),
          [
            exprS(callE('forward', [id('x')])),
            assignS('x', infix('+', id('x'), num(1))),
          ],
        )),
      )
    );
  });

  it('parses while with boolean condition', () => {
    expect(parse('while true do\n  forward(1)\nend')).toEqual(
      prog(exprS(whileE(bool_(true), [exprS(callE('forward', [num(1)]))])))
    );
  });
});

describe('for each loop', () => {
  it('parses for each with ident list', () => {
    expect(parse('for each x in myList do\n  forward(x)\nend')).toEqual(
      prog(exprS(forEachE('x', id('myList'), [exprS(callE('forward', [id('x')]))])))
    );
  });

  it('parses for each with list() call', () => {
    expect(parse('for each item in list(1, 2, 3) do\n  stamp()\nend')).toEqual(
      prog(exprS(forEachE('item', callE('list', [num(1), num(2), num(3)]), [exprS(callE('stamp', []))])))
    );
  });
});
