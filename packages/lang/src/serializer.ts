// AST-to-text serializer for the Sprout language.
// This is a one-way transformation: AST → Ruby-like display text.
// There is NO parser; the text panel in the IDE is read-only.

import type { Program, Expr, Stmt, BlockExpr } from './ast.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function indent(level: number): string {
  return '  '.repeat(level);
}

function serializeBlock(block: BlockExpr, indentLevel: number): string {
  return block.body
    .map(stmt => indent(indentLevel) + serializeStmt(stmt, indentLevel))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function serializeExpr(expr: Expr, indentLevel = 0): string {
  switch (expr.kind) {
    case 'NumberLit':
      return String(expr.value);

    case 'StringLit':
      return `"${expr.value}"`;

    case 'SymbolLit':
      return `:${expr.name}`;

    case 'BoolLit':
      return expr.value ? 'true' : 'false';

    case 'Ident':
      return expr.name;

    case 'InfixExpr':
      return `${serializeExpr(expr.left, indentLevel)} ${expr.op} ${serializeExpr(expr.right, indentLevel)}`;

    case 'CallExpr': {
      const { callee, args, block } = expr;
      if (block === null) {
        // No trailing block
        if (args.length === 0) {
          return `${callee}()`;
        }
        return `${callee}(${args.map(a => serializeExpr(a, indentLevel)).join(', ')})`;
      }
      // Trailing do...end block
      const body = serializeBlock(block, indentLevel + 1);
      const closer = `${indent(indentLevel)}end`;
      if (args.length === 0) {
        return `${callee} do\n${body}\n${closer}`;
      }
      return `${callee}(${args.map(a => serializeExpr(a, indentLevel)).join(', ')}) do\n${body}\n${closer}`;
    }

    case 'BlockExpr': {
      // A bare BlockExpr (not attached to a CallExpr) — render its body
      const body = serializeBlock(expr, indentLevel + 1);
      return `do\n${body}\n${indent(indentLevel)}end`;
    }

    case 'RepeatExpr': {
      const countStr = serializeExpr(expr.count, indentLevel);
      const body = serializeBlock(expr.body, indentLevel + 1);
      return `repeat ${countStr} do\n${body}\n${indent(indentLevel)}end`;
    }

    case 'OnExpr': {
      const eventStr = serializeExpr(expr.event, indentLevel);
      const body = serializeBlock(expr.body, indentLevel + 1);
      return `on ${eventStr} do\n${body}\n${indent(indentLevel)}end`;
    }

    case 'IfExpr': {
      const condStr = serializeExpr(expr.cond, indentLevel);
      const thenStr = serializeBlock(expr.then, indentLevel + 1);
      if (expr.else === null) {
        return `if ${condStr} do\n${thenStr}\n${indent(indentLevel)}end`;
      }
      const elseStr = serializeBlock(expr.else, indentLevel + 1);
      return `if ${condStr} do\n${thenStr}\n${indent(indentLevel)}else\n${elseStr}\n${indent(indentLevel)}end`;
    }

    case 'UnaryExpr':
      return `not ${serializeExpr(expr.operand, indentLevel)}`;

    default: {
      // Exhaustiveness check
      const _never: never = expr;
      throw new Error(`Unknown expr kind: ${(_never as Expr).kind}`);
    }
  }
}

export function serializeStmt(stmt: Stmt, indentLevel = 0): string {
  switch (stmt.kind) {
    case 'ExprStmt':
      return serializeExpr(stmt.expr, indentLevel);

    case 'DefStmt': {
      const { name, params, body } = stmt;
      const header =
        params.length === 0
          ? `def ${name}`
          : `def ${name}(${params.join(', ')})`;
      const bodyStr = indent(indentLevel + 1) + serializeExpr(body, indentLevel + 1);
      return `${header}\n${bodyStr}\n${indent(indentLevel)}end`;
    }

    default: {
      const _never: never = stmt;
      throw new Error(`Unknown stmt kind: ${(_never as Stmt).kind}`);
    }
  }
}

export function serialize(program: Program): string {
  const { stmts } = program;
  if (stmts.length === 0) return '';

  const parts: string[] = [];
  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i];
    const text = serializeStmt(stmt, 0);
    if (i === 0) {
      parts.push(text);
      continue;
    }
    const prev = stmts[i - 1];
    // Use a blank line between neighbors when either is a DefStmt
    const separator =
      stmt.kind === 'DefStmt' || prev.kind === 'DefStmt' ? '\n\n' : '\n';
    parts.push(separator + text);
  }

  return parts.join('');
}
