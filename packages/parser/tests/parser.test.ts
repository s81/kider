import { describe, it, expect } from 'vitest';
import { tokenize, ParseError } from '../src/lexer.js';

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
});
