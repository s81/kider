import { describe, it, expect, beforeAll } from 'vitest';
import * as Blockly from 'blockly/node';
import { serialize } from '@sprout/lang';
import { parse } from '@sprout/parser';
import { registerAllBlocks } from '../src/definitions/index.js';
import { compileWorkspace } from '../src/compiler.js';
import { decompileProgram } from '../src/decompiler.js';

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
    ['sprout_hide_sprite',    'hideSprite'],
    ['sprout_show_sprite',    'showSprite'],
    ['sprout_remove_sprite',  'removeSprite'],
    ['sprout_bounce_sprite',  'bounceSprite'],
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

function roundTrip(source: string): void {
  const program = parse(source);
  const ws1 = makeWorkspace();
  decompileProgram(ws1, program);
  const once = compileWorkspace(ws1);

  const ws2 = makeWorkspace();
  decompileProgram(ws2, once);
  const twice = compileWorkspace(ws2);

  expect(serialize(twice)).toBe(serialize(once));
}

describe('sprite decompile round-trips', () => {
  it('every sprite statement maps to its dedicated block', () => {
    const src = [
      'sprite("cat", circle(15))',
      'moveSprite("cat", 10)',
      'turnSprite("cat", 90)',
      'gotoSprite("cat", 10, 20)',
      'changeSpriteX("cat", -5)',
      'changeSpriteY("cat", 5)',
      'hideSprite("cat")',
      'showSprite("cat")',
      'removeSprite("cat")',
    ].join('\n');
    roundTrip(src);
    const ws = makeWorkspace();
    decompileProgram(ws, parse(src));
    for (const type of [
      'sprout_sprite', 'sprout_move_sprite', 'sprout_turn_sprite', 'sprout_goto_sprite',
      'sprout_change_sprite_x', 'sprout_change_sprite_y',
      'sprout_hide_sprite', 'sprout_show_sprite', 'sprout_remove_sprite',
    ]) {
      expect(ws.getBlocksByType(type, false), type).toHaveLength(1);
    }
  });

  it('sprite value calls map to their blocks', () => {
    const src = 'let hit = spritesTouching("cat", "dog")\nlet px = spriteX("cat")\nlet py = spriteY("cat")';
    roundTrip(src);
    const ws = makeWorkspace();
    decompileProgram(ws, parse(src));
    expect(ws.getBlocksByType('sprout_sprites_touching', false)).toHaveLength(1);
    expect(ws.getBlocksByType('sprout_sprite_x', false)).toHaveLength(1);
    expect(ws.getBlocksByType('sprout_sprite_y', false)).toHaveLength(1);
  });

  it('computed sprite names fall back to generic call blocks', () => {
    const src = 'let n = "cat"\nmoveSprite(n, 5)';
    roundTrip(src);
    const ws = makeWorkspace();
    decompileProgram(ws, parse(src));
    expect(ws.getBlocksByType('sprout_move_sprite', false)).toHaveLength(0);
    expect(ws.getBlocksByType('sprout_call_stmt', false)).toHaveLength(1);
  });

  it('bounceSprite round-trips through decompile→compile', () => {
    const src = 'bounceSprite("ball")';
    const prog = parse(src);
    const ws = makeWorkspace();
    decompileProgram(ws, prog);
    const result = compileWorkspace(ws);
    expect(serialize(result)).toBe(src);
  });
});

describe('sprout_clone_sprite round-trips', () => {
  it('compiles sprout_clone_sprite inside sprout_let → LetStmt { init: cloneSprite("cat") }', () => {
    const ws = makeWorkspace();
    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('c', 'NAME');
    const cloneBlock = ws.newBlock('sprout_clone_sprite');
    cloneBlock.setFieldValue('cat', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(cloneBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'c',
      init: {
        kind: 'CallExpr',
        callee: 'cloneSprite',
        args: [{ kind: 'StringLit', value: 'cat' }],
        block: null,
      },
    });
  });

  it('decompiles cloneSprite("cat") → sprout_clone_sprite', () => {
    const ast = parse('let c = cloneSprite("cat")');
    const ws = makeWorkspace();
    decompileProgram(ws, ast);
    const top = ws.getTopBlocks(true)[0];
    expect(top.type).toBe('sprout_let');
    const initBlock = top.getInputTargetBlock('INIT');
    expect(initBlock?.type).toBe('sprout_clone_sprite');
    expect(initBlock?.getFieldValue('NAME')).toBe('cat');
  });
});
