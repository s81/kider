import { describe, it, expect } from 'vitest';
import { serialize } from '@sprout/lang';
import { parse } from '../src/index.js';

describe('loop forever parsing', () => {
  it('parses loop forever do...end', () => {
    const prog = parse('loop forever do\n  forward(10)\nend');
    expect(prog.stmts).toHaveLength(1);
    const stmt = prog.stmts[0];
    expect(stmt.kind).toBe('ExprStmt');
    if (stmt.kind !== 'ExprStmt') return;
    expect(stmt.expr.kind).toBe('LoopForeverExpr');
    if (stmt.expr.kind !== 'LoopForeverExpr') return;
    expect(stmt.expr.body.body).toHaveLength(1);
  });

  it('rejects loop 5 do (wrong keyword after loop)', () => {
    expect(() => parse('loop 5 do\n  forward(10)\nend')).toThrow();
  });

  it('round-trips through parse → serialize', () => {
    const src = 'loop forever do\n  forward(10)\nend';
    expect(serialize(parse(src))).toBe(src);
  });
});
