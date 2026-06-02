import { tokenize, type Token, ParseError } from './lexer.js';
import type {
  Program, Stmt, Expr, DefStmt,
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

    if (this.check('EQ')) {
      this.advance();
      const body = this.parseExpr();
      return { kind: 'DefStmt', name, params, body };
    }

    const bodyStmts = this.parseBodyUntilEnd();
    const body: BlockExpr = { kind: 'BlockExpr', body: bodyStmts };
    return { kind: 'DefStmt', name, params, body };
  }

  private parseBodyUntilEnd(): Stmt[] {
    const stmts: Stmt[] = [];
    while (!this.checkIdent('end') && !this.check('EOF')) {
      stmts.push(this.parseStmt());
    }
    this.eatIdent('end');
    return stmts;
  }

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
      this.advance();
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

      if (name === 'repeat') {
        this.advance();
        const count = this.parseExpr();
        const body = this.parseDoBlock();
        return { kind: 'RepeatExpr', count, body } satisfies RepeatExpr;
      }

      if (name === 'on') {
        this.advance();
        const symTok = this.eat('SYMBOL') as { kind: 'SYMBOL'; name: string };
        const event = { kind: 'SymbolLit' as const, name: symTok.name };
        const body = this.parseDoBlock();
        return { kind: 'OnExpr', event, body } satisfies OnExpr;
      }

      this.advance();

      if (this.check('LPAREN')) {
        this.advance();
        const args: Expr[] = [];
        while (!this.check('RPAREN') && !this.check('EOF')) {
          args.push(this.parseExpr());
          if (this.check('COMMA')) this.advance();
        }
        this.eat('RPAREN');

        if (this.checkIdent('do')) {
          const block = this.parseDoBlock();
          return { kind: 'CallExpr', callee: name, args, block } satisfies CallExpr;
        }
        return { kind: 'CallExpr', callee: name, args, block: null } satisfies CallExpr;
      }

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
