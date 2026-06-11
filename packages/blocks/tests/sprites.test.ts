import { describe, it, expect, beforeAll } from 'vitest';
import * as Blockly from 'blockly/node';
import { registerAllBlocks } from '../src/definitions/index.js';
import { compileWorkspace } from '../src/compiler.js';

beforeAll(() => {
  registerAllBlocks();
});

function makeWorkspace(): Blockly.Workspace {
  return new Blockly.Workspace();
}

function setNumberInput(ws: Blockly.Workspace, block: Blockly.Block, input: string, value: number): void {
  const num = ws.newBlock('sprout_number');
  num.setFieldValue(String(value), 'NUM');
  block.getInput(input)!.connection!.connect(num.outputConnection!);
}

describe('sprite statement blocks compile', () => {
  it('sprout_sprite → sprite("cat", circle(15))', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_sprite');
    block.setFieldValue('cat', 'NAME');
    // Drawing expressions are value blocks — use sprout_call_expr (has outputConnection)
    const costume = ws.newBlock('sprout_call_expr');
    costume.setFieldValue('circle', 'CALLEE');
    setNumberInput(ws, costume, 'ARG0', 15);
    block.getInput('COSTUME')!.connection!.connect(costume.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'ExprStmt',
      expr: {
        kind: 'CallExpr', callee: 'sprite',
        args: [
          { kind: 'StringLit', value: 'cat' },
          { kind: 'CallExpr', callee: 'circle', args: [{ kind: 'NumberLit', value: 15 }], block: null },
        ],
        block: null,
      },
    });
  });

  it.each([
    ['sprout_move_sprite',     'moveSprite',    'DIST'],
    ['sprout_turn_sprite',     'turnSprite',    'DEG'],
    ['sprout_change_sprite_x', 'changeSpriteX', 'AMOUNT'],
    ['sprout_change_sprite_y', 'changeSpriteY', 'AMOUNT'],
  ])('%s → %s("cat", 5)', (blockType, callee, inputName) => {
    const ws = makeWorkspace();
    const block = ws.newBlock(blockType);
    block.setFieldValue('cat', 'NAME');
    setNumberInput(ws, block, inputName, 5);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'ExprStmt',
      expr: {
        kind: 'CallExpr', callee,
        args: [{ kind: 'StringLit', value: 'cat' }, { kind: 'NumberLit', value: 5 }],
        block: null,
      },
    });
  });

  it('sprout_goto_sprite → gotoSprite("cat", 10, 20)', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_goto_sprite');
    block.setFieldValue('cat', 'NAME');
    setNumberInput(ws, block, 'X', 10);
    setNumberInput(ws, block, 'Y', 20);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'ExprStmt',
      expr: {
        kind: 'CallExpr', callee: 'gotoSprite',
        args: [
          { kind: 'StringLit', value: 'cat' },
          { kind: 'NumberLit', value: 10 },
          { kind: 'NumberLit', value: 20 },
        ],
        block: null,
      },
    });
  });

  it.each([
    ['sprout_hide_sprite',   'hideSprite'],
    ['sprout_show_sprite',   'showSprite'],
    ['sprout_remove_sprite', 'removeSprite'],
  ])('%s → %s("cat")', (blockType, callee) => {
    const ws = makeWorkspace();
    const block = ws.newBlock(blockType);
    block.setFieldValue('cat', 'NAME');

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'ExprStmt',
      expr: { kind: 'CallExpr', callee, args: [{ kind: 'StringLit', value: 'cat' }], block: null },
    });
  });
});

describe('sprite value blocks compile', () => {
  it.each([
    ['sprout_sprite_x', 'spriteX'],
    ['sprout_sprite_y', 'spriteY'],
  ])('%s → %s("cat")', (blockType, callee) => {
    const ws = makeWorkspace();
    const valueBlock = ws.newBlock(blockType);
    valueBlock.setFieldValue('cat', 'NAME');
    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('p', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(valueBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt', name: 'p',
      init: { kind: 'CallExpr', callee, args: [{ kind: 'StringLit', value: 'cat' }], block: null },
    });
  });

  it('sprout_sprites_touching → spritesTouching("cat", "dog")', () => {
    const ws = makeWorkspace();
    const valueBlock = ws.newBlock('sprout_sprites_touching');
    valueBlock.setFieldValue('cat', 'NAME_A');
    valueBlock.setFieldValue('dog', 'NAME_B');
    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('hit', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(valueBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt', name: 'hit',
      init: {
        kind: 'CallExpr', callee: 'spritesTouching',
        args: [{ kind: 'StringLit', value: 'cat' }, { kind: 'StringLit', value: 'dog' }],
        block: null,
      },
    });
  });
});
