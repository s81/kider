import { describe, it, expect, beforeAll } from 'vitest';
// 'blockly/node.js' (not 'blockly/node') — the tsconfig paths entry maps the
// bare subpath to a .d.ts for typechecking, and bun test honors that mapping.
// @ts-expect-error untyped explicit-file import
import * as Blockly from 'blockly/node.js';
import { serialize } from '@sprout/lang';
import { parse } from '@sprout/parser';
import { registerAllBlocks, compileWorkspace } from '@sprout/blocks';
import { tryLoadAsBlocks } from '../src/loadProgram.js';

beforeAll(() => {
  registerAllBlocks();
});

describe('tryLoadAsBlocks', () => {
  it('loads a valid program and the workspace compiles back to it', () => {
    const ws = new Blockly.Workspace();
    const src = 'repeat 4 do\n  forward(100)\n  turn(90)\nend';
    expect(tryLoadAsBlocks(ws, src)).toBe(true);
    expect(serialize(compileWorkspace(ws))).toBe(serialize(parse(src)));
  });

  it('replaces previous workspace contents', () => {
    const ws = new Blockly.Workspace();
    tryLoadAsBlocks(ws, 'forward(10)');
    tryLoadAsBlocks(ws, 'turn(90)');
    expect(serialize(compileWorkspace(ws))).toBe('turn(90)');
  });

  it('returns false for unparseable text and leaves the workspace empty', () => {
    const ws = new Blockly.Workspace();
    expect(tryLoadAsBlocks(ws, 'this is not a program (((')).toBe(false);
    expect(ws.getAllBlocks(false)).toHaveLength(0);
  });

  it('returns false for a non-block-representable program', () => {
    const ws = new Blockly.Workspace();
    expect(tryLoadAsBlocks(ws, 'mystery(1, 2, 3)')).toBe(false);
    expect(ws.getAllBlocks(false)).toHaveLength(0);
  });
});
