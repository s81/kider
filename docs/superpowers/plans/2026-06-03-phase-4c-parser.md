# Phase 4c — Text Editor + Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `@sprout/parser` package provides a recursive-descent parser (text → AST). `TextPanel.tsx` becomes an editable textarea in "text mode." `App.tsx` supports `'blocks' | 'editor'` source modes: blocks mode works as before; editor mode parses the textarea content on Run.

**Architecture:** The lexer tokenizes Sprout source into a flat `Token[]` (newlines treated as whitespace — `end` keyword delimits blocks, not indentation). The parser is a recursive-descent LL(1) with Pratt precedence climbing for infix expressions. It produces the existing `Program` AST from `@sprout/lang`. `TextPanel.tsx` gains `editable` and `onChange` props; when editable it renders a `<textarea>`. `App.tsx` adds a "Text" tab that copies the current serialized program into the editor and enables text-mode parsing on Run.

**Tech Stack:** TypeScript, React, `@sprout/lang` types, Vitest

**Grammar implemented (from DESIGN.md Section C, with clarifications):**

```
program    ::= stmt*
stmt       ::= def_stmt | expr_stmt
def_stmt   ::= 'def' IDENT params? '=' expr
             | 'def' IDENT params? stmt* 'end'
params     ::= '(' IDENT (',' IDENT)* ')'
expr       ::= atom (OP atom)*             -- Pratt: * / before + -
atom       ::= NUMBER | STRING | SYMBOL
             | '(' expr ')'
             | 'true' | 'false'
             | 'repeat' expr 'do' stmt* 'end'
             | 'on' SYMBOL 'do' stmt* 'end'
             | IDENT '(' args? ')' ('do' stmt* 'end')?
             | IDENT                       -- bare identifier
args       ::= expr (',' expr)*
```

**Limitation (MVP):** `callee do...end` (call with trailing block, no parens) is not parsed; use `callee() do...end`. The block compiler never generates this form, so round-trips are not affected.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/parser/package.json` | Package config, dep on `@sprout/lang` |
| Create | `packages/parser/tsconfig.json` | TypeScript config, extends root |
| Create | `packages/parser/src/lexer.ts` | Tokenizer: source text → `Token[]` |
| Create | `packages/parser/src/parser.ts` | Recursive-descent parser: `Token[]` → `Program` |
| Create | `packages/parser/src/index.ts` | Public API: re-exports `parse`, `ParseError` |
| Create | `packages/parser/tests/parser.test.ts` | Comprehensive unit tests |
| Modify | `vitest.config.ts` | Add `@sprout/parser` alias |
| Modify | `apps/ide/vite.config.ts` | Add `@sprout/parser` alias |
| Modify | `apps/ide/tsconfig.json` | Add `@sprout/parser` path for TS |
| Modify | `apps/ide/src/TextPanel.tsx` | Add `editable` / `onChange` props |
| Modify | `apps/ide/src/App.tsx` | Source mode toggle, parse on Run in editor mode |

---

### Task 1: Package scaffolding

**Files:**
- Create: `packages/parser/package.json`
- Create: `packages/parser/tsconfig.json`
- Create: `packages/parser/src/index.ts` (stub)
- Modify: `vitest.config.ts`

- [ ] **Step 1: Create `packages/parser/package.json`**

```json
{
  "name": "@sprout/parser",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --project tsconfig.json --noEmit"
  },
  "dependencies": {
    "@sprout/lang": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `packages/parser/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create stub `packages/parser/src/index.ts`**

```typescript
export { parse } from './parser.js';
export { ParseError } from './lexer.js';
```

- [ ] **Step 4: Add `@sprout/parser` alias to `vitest.config.ts`**

Find:
```typescript
      '@sprout/blocks': path.resolve('./packages/blocks/src/index.ts'),
```

Replace with:
```typescript
      '@sprout/blocks': path.resolve('./packages/blocks/src/index.ts'),
      '@sprout/parser': path.resolve('./packages/parser/src/index.ts'),
```

- [ ] **Step 5: Verify vitest can resolve the alias (smoke test)**

```
bun run vitest run --reporter=verbose 2>&1 | head -20
```

Expected: runs without module resolution errors (existing tests still pass)

- [ ] **Step 6: Commit**

```
git add packages/parser/ vitest.config.ts
git commit -m "chore(parser): scaffold @sprout/parser package"
```

---

### Task 2: Lexer

**Files:**
- Create: `packages/parser/src/lexer.ts`
- Create: `packages/parser/tests/parser.test.ts` (lexer portion)

- [ ] **Step 1: Write failing lexer tests**

Create `packages/parser/tests/parser.test.ts` (lexer section only — parser section added in Task 3):

```typescript
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
```

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run packages/parser/tests/parser.test.ts
```

Expected: FAIL with `Cannot find module '../src/lexer.js'`

- [ ] **Step 3: Implement `packages/parser/src/lexer.ts`**

```typescript
export type Token =
  | { kind: 'NUMBER'; value: number }
  | { kind: 'STRING'; value: string }
  | { kind: 'SYMBOL'; name: string }
  | { kind: 'IDENT'; name: string }
  | { kind: 'PLUS' }
  | { kind: 'MINUS' }
  | { kind: 'STAR' }
  | { kind: 'SLASH' }
  | { kind: 'LPAREN' }
  | { kind: 'RPAREN' }
  | { kind: 'COMMA' }
  | { kind: 'EQ' }
  | { kind: 'EOF' };

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    // Whitespace (including newlines) — ignored
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    // Line comments: # to end of line
    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // Number: [0-9]+ ('.' [0-9]+)?
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < source.length && source[j] >= '0' && source[j] <= '9') j++;
      if (j < source.length && source[j] === '.') {
        j++;
        while (j < source.length && source[j] >= '0' && source[j] <= '9') j++;
      }
      tokens.push({ kind: 'NUMBER', value: Number(source.slice(i, j)) });
      i = j;
      continue;
    }

    // String: '"' [^"]* '"'
    if (ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') j++;
      if (j >= source.length) throw new ParseError('Unterminated string literal');
      tokens.push({ kind: 'STRING', value: source.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    // Symbol: ':' [a-z][a-z0-9_]*
    if (ch === ':' && i + 1 < source.length && isLower(source[i + 1])) {
      let j = i + 1;
      while (j < source.length && isIdentChar(source[j])) j++;
      tokens.push({ kind: 'SYMBOL', name: source.slice(i + 1, j) });
      i = j;
      continue;
    }

    // Identifier or keyword: [a-zA-Z_][a-zA-Z0-9_]*
    if (isAlpha(ch)) {
      let j = i;
      while (j < source.length && isIdentChar(source[j])) j++;
      tokens.push({ kind: 'IDENT', name: source.slice(i, j) });
      i = j;
      continue;
    }

    // Single-character tokens
    switch (ch) {
      case '+': tokens.push({ kind: 'PLUS' });   i++; break;
      case '-': tokens.push({ kind: 'MINUS' });  i++; break;
      case '*': tokens.push({ kind: 'STAR' });   i++; break;
      case '/': tokens.push({ kind: 'SLASH' });  i++; break;
      case '(': tokens.push({ kind: 'LPAREN' }); i++; break;
      case ')': tokens.push({ kind: 'RPAREN' }); i++; break;
      case ',': tokens.push({ kind: 'COMMA' });  i++; break;
      case '=': tokens.push({ kind: 'EQ' });     i++; break;
      default:
        throw new ParseError(`Unexpected character: '${ch}' at position ${i}`);
    }
  }

  tokens.push({ kind: 'EOF' });
  return tokens;
}

function isLower(ch: string): boolean {
  return ch >= 'a' && ch <= 'z';
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentChar(ch: string): boolean {
  return isAlpha(ch) || (ch >= '0' && ch <= '9');
}
```

- [ ] **Step 4: Run lexer tests**

```
bun run vitest run packages/parser/tests/parser.test.ts
```

Expected: All lexer tests pass

- [ ] **Step 5: Commit**

```
git add packages/parser/src/lexer.ts packages/parser/tests/parser.test.ts
git commit -m "feat(parser): implement Sprout lexer with unit tests"
```

---

### Task 3: Parser

**Files:**
- Create: `packages/parser/src/parser.ts`
- Modify: `packages/parser/tests/parser.test.ts` (add parser tests)

- [ ] **Step 1: Write failing parser tests**

Append these tests to `packages/parser/tests/parser.test.ts`:

```typescript
import { parse } from '../src/parser.js';
import type { Program } from '@sprout/lang';

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
  ({ kind: 'OnExpr' as const, event: sym(name), body: blockE(body) });
const exprS = (expr: object) => ({ kind: 'ExprStmt' as const, expr });
const defS = (name: string, params: string[], body: object) =>
  ({ kind: 'DefStmt' as const, name, params, body });
const prog = (...stmts: object[]): Program =>
  ({ kind: 'Program', stmts: stmts as Program['stmts'] });

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
    // 2 + 3 * 4 should parse as 2 + (3 * 4)
    expect(parse('2 + 3 * 4')).toEqual(
      prog(exprS(infix('+', num(2), infix('*', num(3), num(4)))))
    );
  });

  it('gives / higher precedence than -', () => {
    // 10 - 6 / 2 should parse as 10 - (6 / 2)
    expect(parse('10 - 6 / 2')).toEqual(
      prog(exprS(infix('-', num(10), infix('/', num(6), num(2)))))
    );
  });

  it('left-associates same-precedence operators', () => {
    // 1 + 2 + 3 = (1 + 2) + 3
    expect(parse('1 + 2 + 3')).toEqual(
      prog(exprS(infix('+', infix('+', num(1), num(2)), num(3))))
    );
  });

  it('parses parenthesized expression overriding precedence', () => {
    // (1 + 2) * 3
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
    // repeat 2 * 4 do ... end — count = 2*4
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

  it('throws ParseError on missing end for repeat', () => {
    expect(() => parse('repeat 4 do\n  forward(10)\n')).toThrow(ParseError);
  });
});

describe('parse — round-trip with serializer', () => {
  it('serialize → parse → serialize is identity for a simple program', async () => {
    const { serialize } = await import('@sprout/lang');
    const src = 'forward(100)';
    const ast = parse(src);
    expect(serialize(ast)).toBe(src);
  });

  it('serialize → parse → serialize is identity for a def+call program', async () => {
    const { serialize } = await import('@sprout/lang');
    // Use the exact serializer output format as input
    const src = 'def square\n  repeat 4 do\n    forward(100)\n    turn(90)\n  end\nend\n\nsquare()';
    const ast = parse(src);
    expect(serialize(ast)).toBe(src);
  });
});
```

- [ ] **Step 2: Run to confirm failing**

```
bun run vitest run packages/parser/tests/parser.test.ts
```

Expected: FAIL with `Cannot find module '../src/parser.js'`

- [ ] **Step 3: Implement `packages/parser/src/parser.ts`**

```typescript
import { tokenize, type Token, ParseError } from './lexer.js';
import type {
  Program, Stmt, Expr, DefStmt, ExprStmt,
  BlockExpr, RepeatExpr, OnExpr, CallExpr,
} from '@sprout/lang';

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(source: string) {
    this.tokens = tokenize(source);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (t.kind !== 'EOF') this.pos++;
    return t;
  }

  private check(kind: Token['kind']): boolean {
    return this.peek().kind === kind;
  }

  private checkIdent(name: string): boolean {
    const t = this.peek();
    return t.kind === 'IDENT' && t.name === name;
  }

  private eat(kind: Token['kind']): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      const got = t.kind === 'IDENT'
        ? `'${(t as { kind: 'IDENT'; name: string }).name}'`
        : t.kind;
      throw new ParseError(`Expected ${kind}, got ${got}`);
    }
    return this.advance();
  }

  private eatIdent(name: string): void {
    const t = this.peek();
    if (t.kind !== 'IDENT' || t.name !== name) {
      const got = t.kind === 'IDENT'
        ? `'${(t as { kind: 'IDENT'; name: string }).name}'`
        : t.kind;
      throw new ParseError(`Expected '${name}', got ${got}`);
    }
    this.advance();
  }

  // -------------------------------------------------------------------------
  // Program and statements
  // -------------------------------------------------------------------------

  parseProgram(): Program {
    const stmts: Stmt[] = [];
    while (!this.check('EOF')) {
      stmts.push(this.parseStmt());
    }
    return { kind: 'Program', stmts };
  }

  private parseStmt(): Stmt {
    if (this.checkIdent('def')) return this.parseDef();
    return { kind: 'ExprStmt', expr: this.parseExpr() };
  }

  private parseDef(): DefStmt {
    this.eatIdent('def');
    const nameTok = this.eat('IDENT') as { kind: 'IDENT'; name: string };
    const name = nameTok.name;

    // Optional params: (p1, p2, ...)
    const params: string[] = [];
    if (this.check('LPAREN')) {
      this.advance();
      while (!this.check('RPAREN') && !this.check('EOF')) {
        const p = this.eat('IDENT') as { kind: 'IDENT'; name: string };
        params.push(p.name);
        if (this.check('COMMA')) this.advance();
      }
      this.eat('RPAREN');
    }

    // Single-line form: def name [params] = expr
    if (this.check('EQ')) {
      this.advance();
      const body = this.parseExpr();
      return { kind: 'DefStmt', name, params, body };
    }

    // Block form: def name [params] <stmts> end
    const bodyStmts = this.parseBodyUntilEnd();
    const body: BlockExpr = { kind: 'BlockExpr', body: bodyStmts };
    return { kind: 'DefStmt', name, params, body };
  }

  // Parses statements until the next token is 'end', then consumes 'end'.
  private parseBodyUntilEnd(): Stmt[] {
    const stmts: Stmt[] = [];
    while (!this.checkIdent('end') && !this.check('EOF')) {
      stmts.push(this.parseStmt());
    }
    this.eatIdent('end');
    return stmts;
  }

  // Parses 'do' then statements until 'end' (consumes both).
  private parseDoBlock(): BlockExpr {
    this.eatIdent('do');
    const stmts = this.parseBodyUntilEnd();
    return { kind: 'BlockExpr', body: stmts };
  }

  // -------------------------------------------------------------------------
  // Expressions — Pratt precedence climbing
  // -------------------------------------------------------------------------

  parseExpr(): Expr {
    return this.parseInfix(0);
  }

  private parseInfix(minPrec: number): Expr {
    let left = this.parseAtom();

    while (true) {
      const [op, prec] = this.peekOp();
      if (op === null || prec <= minPrec) break;
      this.advance(); // consume the operator token
      // Right side uses prec (not prec-1) to achieve left-associativity:
      // parseInfix(prec) means the right side must bind *strictly* tighter.
      const right = this.parseInfix(prec);
      left = {
        kind: 'InfixExpr',
        op: op as '+' | '-' | '*' | '/',
        left,
        right,
      };
    }

    return left;
  }

  private peekOp(): [string | null, number] {
    switch (this.peek().kind) {
      case 'PLUS':  return ['+', 1];
      case 'MINUS': return ['-', 1];
      case 'STAR':  return ['*', 2];
      case 'SLASH': return ['/', 2];
      default:      return [null, 0];
    }
  }

  private parseAtom(): Expr {
    const t = this.peek();

    if (t.kind === 'NUMBER') {
      this.advance();
      return { kind: 'NumberLit', value: t.value };
    }

    if (t.kind === 'STRING') {
      this.advance();
      return { kind: 'StringLit', value: t.value };
    }

    if (t.kind === 'SYMBOL') {
      this.advance();
      return { kind: 'SymbolLit', name: t.name };
    }

    if (t.kind === 'LPAREN') {
      this.advance();
      const expr = this.parseExpr();
      this.eat('RPAREN');
      return expr;
    }

    if (t.kind === 'IDENT') {
      const name = t.name;

      if (name === 'true')  { this.advance(); return { kind: 'BoolLit', value: true }; }
      if (name === 'false') { this.advance(); return { kind: 'BoolLit', value: false }; }

      // repeat <expr> do <stmts> end
      if (name === 'repeat') {
        this.advance();
        // parseInfix(0) stops at 'do' (IDENT is not an operator token)
        const count = this.parseExpr();
        const body = this.parseDoBlock();
        return { kind: 'RepeatExpr', count, body } satisfies RepeatExpr;
      }

      // on :symbol do <stmts> end
      if (name === 'on') {
        this.advance();
        const symTok = this.eat('SYMBOL') as { kind: 'SYMBOL'; name: string };
        const event = { kind: 'SymbolLit' as const, name: symTok.name };
        const body = this.parseDoBlock();
        return { kind: 'OnExpr', event, body } satisfies OnExpr;
      }

      // Regular identifier: ident | ident(args?) | ident(args?) do...end
      this.advance();

      if (this.check('LPAREN')) {
        this.advance(); // consume (
        const args: Expr[] = [];
        while (!this.check('RPAREN') && !this.check('EOF')) {
          args.push(this.parseExpr());
          if (this.check('COMMA')) this.advance();
        }
        this.eat('RPAREN');

        // Optional trailing block: ident(args) do...end
        if (this.checkIdent('do')) {
          const block = this.parseDoBlock();
          return { kind: 'CallExpr', callee: name, args, block } satisfies CallExpr;
        }
        return { kind: 'CallExpr', callee: name, args, block: null } satisfies CallExpr;
      }

      // Bare identifier (no call parens)
      return { kind: 'Ident', name };
    }

    throw new ParseError(
      `Unexpected token: ${t.kind}${t.kind === 'IDENT' ? ` ('${(t as { kind: 'IDENT'; name: string }).name}')` : ''}`,
    );
  }
}

export function parse(source: string): Program {
  return new Parser(source).parseProgram();
}
```

- [ ] **Step 4: Run the parser tests**

```
bun run vitest run packages/parser/tests/parser.test.ts
```

Expected: All tests pass. If round-trip tests fail, check the exact serializer output format against the test inputs and adjust the test string literals.

- [ ] **Step 5: Run the full test suite to check for regressions**

```
bun run vitest run
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```
git add packages/parser/src/parser.ts
git commit -m "feat(parser): implement recursive-descent Sprout parser with full test suite"
```

---

### Task 4: Wire parser into the IDE

**Files:**
- Modify: `apps/ide/vite.config.ts`
- Modify: `apps/ide/tsconfig.json`
- Modify: `apps/ide/src/TextPanel.tsx`
- Modify: `apps/ide/src/App.tsx`

- [ ] **Step 1: Add `@sprout/parser` alias to `apps/ide/vite.config.ts`**

Find:
```typescript
        '@sprout/lang': fileURLToPath(new URL('../../packages/lang/src/index.ts', import.meta.url)),
```

Add after it:
```typescript
        '@sprout/parser': fileURLToPath(new URL('../../packages/parser/src/index.ts', import.meta.url)),
```

- [ ] **Step 2: Add `@sprout/parser` path to `apps/ide/tsconfig.json`**

Find:
```json
      "paths": {
        "blockly": ["../../packages/blocks/node_modules/blockly/index.d.ts"],
        "blockly/node": ["../../packages/blocks/node_modules/blockly/index.d.ts"]
      }
```

Replace with:
```json
      "paths": {
        "blockly": ["../../packages/blocks/node_modules/blockly/index.d.ts"],
        "blockly/node": ["../../packages/blocks/node_modules/blockly/index.d.ts"],
        "@sprout/parser": ["../../packages/parser/src/index.ts"]
      }
```

- [ ] **Step 3: Update TextPanel.tsx to support editable mode**

Replace the entire contents of `apps/ide/src/TextPanel.tsx`:

```typescript
const SHARED_STYLE: React.CSSProperties = {
  flex: '1 1 0',
  background: '#1e1e1e',
  color: '#d4d4d4',
  padding: 12,
  margin: 0,
  fontFamily: '"Fira Code", "Consolas", monospace',
  fontSize: 13,
  lineHeight: 1.5,
  borderRadius: 4,
  minHeight: 120,
};

interface Props {
  text: string;
  editable?: boolean;
  onChange?: (text: string) => void;
}

export function TextPanel({ text, editable = false, onChange }: Props) {
  if (editable) {
    return (
      <textarea
        value={text}
        onChange={e => onChange?.(e.target.value)}
        spellCheck={false}
        style={{
          ...SHARED_STYLE,
          resize: 'none',
          border: 'none',
          outline: '2px solid #2563eb',
          cursor: 'text',
          userSelect: 'text',
        }}
      />
    );
  }

  return (
    <pre
      style={{
        ...SHARED_STYLE,
        overflow: 'auto',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {text || '// drag blocks to start'}
    </pre>
  );
}
```

- [ ] **Step 4: Update App.tsx to support source mode switching**

Replace the entire contents of `apps/ide/src/App.tsx`:

```typescript
import { useRef, useState } from 'react';
import type * as Blockly from 'blockly';
import { compileWorkspace } from '@sprout/blocks';
import {
  interpretFull,
  callHandler,
  render,
  mkSequence,
  SproutRuntimeError,
} from '@sprout/lang';
import { parse, ParseError } from '@sprout/parser';
import type { CanvasCommand, Drawing, SproutFunction } from '@sprout/lang';
import { BlockWorkspace } from './BlockWorkspace.js';
import { TextPanel } from './TextPanel.js';
import { Stage } from './Stage.js';

type SourceMode = 'blocks' | 'editor';

export function App() {
  const wsRef = useRef<Blockly.Workspace | null>(null);
  const [programText, setProgramText] = useState('');
  const [editorText, setEditorText] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('blocks');
  const [commands, setCommands] = useState<CanvasCommand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [stepsPerFrame, setStepsPerFrame] = useState(3);

  const accDrawingRef = useRef<Drawing | null>(null);
  const [handlers, setHandlers] = useState<Map<string, SproutFunction>>(new Map());

  function handleRun() {
    try {
      setError(null);
      let program;
      if (sourceMode === 'blocks') {
        const ws = wsRef.current;
        if (!ws) return;
        program = compileWorkspace(ws);
      } else {
        program = parse(editorText);
      }
      const { drawing, handlers: h } = interpretFull(program);
      accDrawingRef.current = drawing;
      setHandlers(h);
      setCommands(render(drawing));
    } catch (e) {
      if (e instanceof SproutRuntimeError || e instanceof ParseError) {
        setError(e.message);
      } else {
        setError(String(e));
      }
      setCommands([]);
      setHandlers(new Map());
      accDrawingRef.current = null;
    }
  }

  function handleCanvasClick() {
    const clickFn = handlers.get(':click');
    if (!clickFn || accDrawingRef.current === null) return;
    try {
      const delta = callHandler(clickFn);
      const next = mkSequence([accDrawingRef.current, delta]);
      accDrawingRef.current = next;
      setCommands(render(next));
    } catch (e) {
      setError(e instanceof SproutRuntimeError ? e.message : String(e));
    }
  }

  function handleSwitchToEditor() {
    setEditorText(programText);
    setSourceMode('editor');
  }

  const hasClickHandler = handlers.has(':click');

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'sans-serif' }}>
      {/* Left: Blockly workspace */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <BlockWorkspace
          onTextChange={setProgramText}
          onWorkspaceReady={ws => { wsRef.current = ws; }}
        />
      </div>

      {/* Right panel */}
      <div
        style={{
          width: 524,
          display: 'flex',
          flexDirection: 'column',
          padding: 8,
          gap: 8,
          background: '#f8fafc',
          borderLeft: '1px solid #e2e8f0',
        }}
      >
        <button
          onClick={handleRun}
          style={{
            padding: '8px 0',
            fontSize: 15,
            fontWeight: 600,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ▶ Run
        </button>

        {/* Source mode tabs */}
        <div style={{ display: 'flex', gap: 4, fontSize: 13 }}>
          <button
            onClick={() => setSourceMode('blocks')}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: sourceMode === 'blocks' ? '#2563eb' : '#fff',
              color: sourceMode === 'blocks' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: sourceMode === 'blocks' ? 600 : 400,
            }}
          >
            Blocks
          </button>
          <button
            onClick={handleSwitchToEditor}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: sourceMode === 'editor' ? '#2563eb' : '#fff',
              color: sourceMode === 'editor' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: sourceMode === 'editor' ? 600 : 400,
            }}
          >
            Text
          </button>
        </div>

        {/* Animation controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={animated}
              onChange={e => setAnimated(e.target.checked)}
            />
            Animate
          </label>
          {animated && (
            <>
              <span>Speed:</span>
              <input
                type="range"
                min={1}
                max={20}
                value={stepsPerFrame}
                onChange={e => setStepsPerFrame(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ minWidth: 20, textAlign: 'right' }}>{stepsPerFrame}</span>
            </>
          )}
        </div>

        {hasClickHandler && (
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            Click the canvas to fire the :click handler
          </div>
        )}

        <TextPanel
          text={sourceMode === 'blocks' ? programText : editorText}
          editable={sourceMode === 'editor'}
          onChange={setEditorText}
        />

        <Stage
          commands={commands}
          animated={animated}
          stepsPerFrame={stepsPerFrame}
          onClick={hasClickHandler ? handleCanvasClick : undefined}
        />

        {error && (
          <pre
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 8,
              borderRadius: 4,
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </pre>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the full test suite**

```
bun run vitest run
```

Expected: All tests pass

- [ ] **Step 6: Manual visual verification**

Start dev server: `bun run --cwd apps/ide dev`

Checklist:
- [ ] "Blocks" tab is selected by default. Blocks mode works as before (drag blocks, Run, see drawing).
- [ ] Click "Text" tab — TextPanel becomes an editable textarea with a blue outline and the current block program pre-loaded.
- [ ] Clear the textarea and type `forward(100)`. Press Run — turtle draws a line.
- [ ] Type `repeat 4 do\n  forward(100)\n  turn(90)\nend`. Press Run — draws a square.
- [ ] Type invalid syntax (e.g. `forward(`). Press Run — red error message appears.
- [ ] Switch back to "Blocks" — textarea returns to read-only, showing the current block program.
- [ ] No console errors during any of the above.

- [ ] **Step 7: Commit**

```
git add apps/ide/vite.config.ts apps/ide/tsconfig.json apps/ide/src/TextPanel.tsx apps/ide/src/App.tsx
git commit -m "feat(ide): add text editor mode with parser integration and source mode toggle"
```

---

## Self-Review Checklist

- Spec coverage: parser ✓, text editor ✓, blocks/editor toggle ✓, error display ✓
- Round-trip: `serialize(parse(serialize(program))) === serialize(program)` verified by tests ✓
- Lexer handles: numbers, floats, strings, symbols, identifiers, operators, punctuation, comments ✓
- Parser handles: all literal types, infix with correct precedence, function calls, repeat, on, def (both forms) ✓
- `repeat sides do...end` correctly parses 'sides' as count (not as a call-with-block) ✓
- Switching tabs copies current block text into editor (no blank editor on switch) ✓
- `ParseError` and `SproutRuntimeError` both shown in the error panel ✓
- Limitation documented: `callee do...end` (no parens) not supported; use `callee() do...end` ✓
