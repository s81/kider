import { describe, it, expect } from 'vitest';
import { parse } from '@sprout/parser';
import { interpret } from '../src/interpreter.js';
import { render } from '../src/renderer.js';

describe('source line attribution end-to-end', () => {
  it('attributes top-level drawing statements to their source lines', () => {
    const prog = parse('circle(20)\nforward(50)');
    const cmds = render(interpret(prog));
    const circle = cmds.find(c => c.kind === 'drawCircle');
    const lineTo = cmds.find(c => c.kind === 'lineTo');
    expect((circle as { line?: number }).line).toBe(1);
    expect((lineTo as { line?: number }).line).toBe(2);
  });

  it('attributes commands inside a repeat body to the body statement line', () => {
    const prog = parse('repeat 3 do\n  forward(10)\nend');
    const cmds = render(interpret(prog));
    const lineTos = cmds.filter(c => c.kind === 'lineTo');
    expect(lineTos).toHaveLength(3);
    for (const c of lineTos) {
      expect((c as { line?: number }).line).toBe(2);
    }
  });

  it('leaves commands untagged for block-built ASTs (no source lines)', () => {
    const prog = parse('circle(20)');
    const stmt = prog.stmts[0];
    if (stmt.kind !== 'ExprStmt' || stmt.expr.kind !== 'CallExpr') throw new Error('bad fixture');
    const stripped = {
      ...prog,
      stmts: [{ ...stmt, expr: { ...stmt.expr, line: undefined } }],
    };
    const cmds = render(interpret(stripped as typeof prog));
    const circle = cmds.find(c => c.kind === 'drawCircle')!;
    expect((circle as { line?: number }).line).toBeUndefined();
  });
});
