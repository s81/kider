type TokenBase =
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
  | { kind: 'EQEQ' }
  | { kind: 'LT' }
  | { kind: 'GT' }
  | { kind: 'LTE' }
  | { kind: 'GTE' }
  | { kind: 'NEQ' }
  | { kind: 'EOF' };

/** 1-based source line where the token starts. */
export type Token = TokenBase & { line: number };

export class ParseError extends Error {
  /** 1-based source line the error refers to, when known. */
  readonly line: number | undefined;

  constructor(message: string, line?: number) {
    super(line !== undefined ? `Line ${line}: ${message}` : message);
    this.name = 'ParseError';
    this.line = line;
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;

  const push = (tok: TokenBase): void => {
    tokens.push({ ...tok, line });
  };

  while (i < source.length) {
    const ch = source[i];

    // Whitespace (including newlines) — ignored
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      if (ch === '\n') line++;
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
      push({ kind: 'NUMBER', value: Number(source.slice(i, j)) });
      i = j;
      continue;
    }

    // String: '"' [^"]* '"' — attributed to its opening line
    if (ch === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') j++;
      if (j >= source.length) throw new ParseError('Unterminated string literal', line);
      const value = source.slice(i + 1, j);
      push({ kind: 'STRING', value });
      for (const c of value) if (c === '\n') line++;
      i = j + 1;
      continue;
    }

    // Symbol: ':' [a-z][a-z0-9_]*
    if (ch === ':' && i + 1 < source.length && isLower(source[i + 1])) {
      let j = i + 1;
      while (j < source.length && isIdentChar(source[j])) j++;
      push({ kind: 'SYMBOL', name: source.slice(i + 1, j) });
      i = j;
      continue;
    }

    // Identifier or keyword: [a-zA-Z_][a-zA-Z0-9_]*
    if (isAlpha(ch)) {
      let j = i;
      while (j < source.length && isIdentChar(source[j])) j++;
      push({ kind: 'IDENT', name: source.slice(i, j) });
      i = j;
      continue;
    }

    // Two-character tokens — must be checked before single-character
    if (ch === '<' && source[i + 1] === '=') { push({ kind: 'LTE' });  i += 2; continue; }
    if (ch === '>' && source[i + 1] === '=') { push({ kind: 'GTE' });  i += 2; continue; }
    if (ch === '=' && source[i + 1] === '=') { push({ kind: 'EQEQ' }); i += 2; continue; }
    if (ch === '!' && source[i + 1] === '=') { push({ kind: 'NEQ' });  i += 2; continue; }

    // Single-character tokens
    switch (ch) {
      case '+': push({ kind: 'PLUS' });   i++; break;
      case '-': push({ kind: 'MINUS' });  i++; break;
      case '*': push({ kind: 'STAR' });   i++; break;
      case '/': push({ kind: 'SLASH' });  i++; break;
      case '(': push({ kind: 'LPAREN' }); i++; break;
      case ')': push({ kind: 'RPAREN' }); i++; break;
      case ',': push({ kind: 'COMMA' });  i++; break;
      case '=': push({ kind: 'EQ' });     i++; break;
      case '<': push({ kind: 'LT' });     i++; break;
      case '>': push({ kind: 'GT' });     i++; break;
      default:
        throw new ParseError(`Unexpected character: '${ch}'`, line);
    }
  }

  push({ kind: 'EOF' });
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
