import { describe, it, expect, beforeAll } from 'vitest';
// 'blockly/node.js' (not 'blockly/node') — the tsconfig paths entry maps the
// bare subpath to a .d.ts for typechecking, and bun test honors that mapping.
// @ts-expect-error untyped explicit-file import
import * as Blockly from 'blockly/node.js';
import { parse } from '@sprout/parser';
import { interpretFull, callHandler, serialize } from '@sprout/lang';
import { registerAllBlocks, compileWorkspace, decompileProgram } from '@sprout/blocks';
import { EXAMPLES } from '../src/examples.js';

beforeAll(() => {
  registerAllBlocks();
});

describe('examples gallery', () => {
  it('has at least five examples with unique names', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(5);
    const names = EXAMPLES.map(e => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const example of EXAMPLES) {
    describe(example.name, () => {
      it('parses', () => {
        expect(() => parse(example.code)).not.toThrow();
      });

      it('interprets without error', () => {
        expect(() => interpretFull(parse(example.code))).not.toThrow();
      });

      it('decompiles to blocks and compiles back to the same program', () => {
        const program = parse(example.code);
        const ws1 = new Blockly.Workspace();
        decompileProgram(ws1, program);
        const once = compileWorkspace(ws1);
        const ws2 = new Blockly.Workspace();
        decompileProgram(ws2, once);
        expect(serialize(compileWorkspace(ws2))).toBe(serialize(once));
      });
    });
  }

  it('Catch Game registers a timer handler that runs clean', () => {
    const game = EXAMPLES.find(e => e.name === 'Catch Game');
    expect(game).toBeDefined();
    const { handlers } = interpretFull(parse(game!.code));
    const timerFn = handlers.get(':timer');
    expect(timerFn).toBeDefined();
    expect(() => callHandler(timerFn!)).not.toThrow();
  });
});
