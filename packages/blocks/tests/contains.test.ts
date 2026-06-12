import { describe, it, expect, beforeAll } from 'vitest';
import * as Blockly from 'blockly/node';
import { serialize } from '@sprout/lang';
import { parse } from '@sprout/parser';
import type { ExprStmt } from '@sprout/lang';
import { registerAllBlocks } from '../src/definitions/index.js';
import { compileWorkspace } from '../src/compiler.js';
import { decompileProgram } from '../src/decompiler.js';

beforeAll(() => {
  registerAllBlocks();
});

function makeWorkspace(): Blockly.Workspace {
  return new Blockly.Workspace();
}

// Build `puts(<contains block>)` so the value block is reachable as a statement.
function putsContains(
  ws: Blockly.Workspace,
  left: Blockly.Block,
  right: Blockly.Block,
): void {
  const puts = ws.newBlock('sprout_puts');
  const contains = ws.newBlock('sprout_contains');
  contains.getInput('LIST')!.connection!.connect(left.outputConnection!);
  contains.getInput('ITEM')!.connection!.connect(right.outputConnection!);
  puts.getInput('VALUE')!.connection!.connect(contains.outputConnection!);
}

describe('sprout_contains block', () => {
  it('compiles to contains(list, item) for list membership', () => {
    const ws = makeWorkspace();
    const nums = ws.newBlock('sprout_ident');
    nums.setFieldValue('nums', 'NAME');
    const five = ws.newBlock('sprout_number');
    five.setFieldValue('5', 'NUM');
    putsContains(ws, nums, five);

    const prog = compileWorkspace(ws);
    expect(prog.stmts).toHaveLength(1);
    expect((prog.stmts[0] as ExprStmt).expr).toMatchObject({
      kind: 'CallExpr',
      callee: 'puts',
      args: [{
        kind: 'CallExpr',
        callee: 'contains',
        args: [
          { kind: 'Ident', name: 'nums' },
          { kind: 'NumberLit', value: 5 },
        ],
      }],
    });
  });

  it('the same block also handles string substring (polymorphic builtin)', () => {
    const ws = makeWorkspace();
    const hello = ws.newBlock('sprout_string');
    hello.setFieldValue('hello', 'VALUE');
    const ell = ws.newBlock('sprout_string');
    ell.setFieldValue('ell', 'VALUE');
    putsContains(ws, hello, ell);

    const prog = compileWorkspace(ws);
    expect((prog.stmts[0] as ExprStmt).expr).toMatchObject({
      kind: 'CallExpr',
      callee: 'puts',
      args: [{
        kind: 'CallExpr',
        callee: 'contains',
        args: [
          { kind: 'StringLit', value: 'hello' },
          { kind: 'StringLit', value: 'ell' },
        ],
      }],
    });
  });

  it('round-trips text → blocks → text via the dedicated contains block', () => {
    const src = 'puts(contains(nums, 5))';
    const ws = makeWorkspace();
    decompileProgram(ws, parse(src));
    // The dedicated list block is used, not the generic call fallback.
    expect(ws.getAllBlocks(false).map(b => b.type)).toContain('sprout_contains');
    expect(serialize(compileWorkspace(ws))).toBe(src);
  });
});
