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
