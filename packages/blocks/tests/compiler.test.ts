import * as Blockly from 'blockly/node';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllBlocks } from '../src/definitions/index.js';
import { compileWorkspace } from '../src/compiler.js';
import type { LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '@sprout/lang';
import { program as squareProgram } from '../../../examples/square.fixture.js';
import { program as polygonProgram } from '../../../examples/polygon.fixture.js';
import { program as besideProgram } from '../../../examples/beside.fixture.js';
import { program as repeatProgram } from '../../../examples/repeat-loop.fixture.js';
import { program as clickProgram } from '../../../examples/click-event.fixture.js';

beforeAll(() => {
  registerAllBlocks();
});

function makeWorkspace(): Blockly.Workspace {
  return new Blockly.Workspace();
}

// ---------------------------------------------------------------------------
// Fixture 1: square — repeat 4 do forward(100); turn(90) end
// ---------------------------------------------------------------------------
function buildSquareWorkspace(ws: Blockly.Workspace): void {
  const repeatBlock = ws.newBlock('sprout_repeat');
  const count4 = ws.newBlock('sprout_number');
  count4.setFieldValue('4', 'NUM');
  repeatBlock.getInput('COUNT')!.connection!.connect(count4.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const fwd100 = ws.newBlock('sprout_number');
  fwd100.setFieldValue('100', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd100.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const turn90 = ws.newBlock('sprout_number');
  turn90.setFieldValue('90', 'NUM');
  turnBlock.getInput('DEGREES')!.connection!.connect(turn90.outputConnection!);

  repeatBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 2: polygon — def polygon(sides, size) + polygon(6, 80)
// ---------------------------------------------------------------------------
function buildPolygonWorkspace(ws: Blockly.Workspace): void {
  const defBlock = ws.newBlock('sprout_def');
  defBlock.setFieldValue('polygon', 'NAME');
  defBlock.setFieldValue('sides', 'PARAM0');
  defBlock.setFieldValue('size', 'PARAM1');

  const repeatBlock = ws.newBlock('sprout_repeat');
  const sidesCount = ws.newBlock('sprout_ident');
  sidesCount.setFieldValue('sides', 'NAME');
  repeatBlock.getInput('COUNT')!.connection!.connect(sidesCount.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const sizeIdent = ws.newBlock('sprout_ident');
  sizeIdent.setFieldValue('size', 'NAME');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(sizeIdent.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const infixBlock = ws.newBlock('sprout_infix');
  const n360 = ws.newBlock('sprout_number');
  n360.setFieldValue('360', 'NUM');
  const sidesIdent2 = ws.newBlock('sprout_ident');
  sidesIdent2.setFieldValue('sides', 'NAME');
  infixBlock.setFieldValue('/', 'OP');
  infixBlock.getInput('LEFT')!.connection!.connect(n360.outputConnection!);
  infixBlock.getInput('RIGHT')!.connection!.connect(sidesIdent2.outputConnection!);
  turnBlock.getInput('DEGREES')!.connection!.connect(infixBlock.outputConnection!);

  repeatBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
  defBlock.getInput('BODY')!.connection!.connect(repeatBlock.previousConnection!);

  const callBlock = ws.newBlock('sprout_call_stmt');
  callBlock.setFieldValue('polygon', 'CALLEE');
  const arg6 = ws.newBlock('sprout_number');
  arg6.setFieldValue('6', 'NUM');
  const arg80 = ws.newBlock('sprout_number');
  arg80.setFieldValue('80', 'NUM');
  callBlock.getInput('ARG0')!.connection!.connect(arg6.outputConnection!);
  callBlock.getInput('ARG1')!.connection!.connect(arg80.outputConnection!);

  defBlock.nextConnection!.connect(callBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 3: beside — def square + beside(square(), square())
// ---------------------------------------------------------------------------
function buildBesideWorkspace(ws: Blockly.Workspace): void {
  const defBlock = ws.newBlock('sprout_def');
  defBlock.setFieldValue('square', 'NAME');
  // no params — PARAM0/PARAM1/PARAM2 stay empty string

  const repeatBlock = ws.newBlock('sprout_repeat');
  const count4 = ws.newBlock('sprout_number');
  count4.setFieldValue('4', 'NUM');
  repeatBlock.getInput('COUNT')!.connection!.connect(count4.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const fwd100 = ws.newBlock('sprout_number');
  fwd100.setFieldValue('100', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd100.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const turn90 = ws.newBlock('sprout_number');
  turn90.setFieldValue('90', 'NUM');
  turnBlock.getInput('DEGREES')!.connection!.connect(turn90.outputConnection!);

  repeatBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
  defBlock.getInput('BODY')!.connection!.connect(repeatBlock.previousConnection!);

  const besideBlock = ws.newBlock('sprout_beside');
  const sq1 = ws.newBlock('sprout_call_expr');
  sq1.setFieldValue('square', 'CALLEE');
  const sq2 = ws.newBlock('sprout_call_expr');
  sq2.setFieldValue('square', 'CALLEE');
  besideBlock.getInput('LEFT')!.connection!.connect(sq1.outputConnection!);
  besideBlock.getInput('RIGHT')!.connection!.connect(sq2.outputConnection!);

  defBlock.nextConnection!.connect(besideBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 4: repeat-loop — repeat 8 do forward(60); turn(45) end
// ---------------------------------------------------------------------------
function buildRepeatLoopWorkspace(ws: Blockly.Workspace): void {
  const repeatBlock = ws.newBlock('sprout_repeat');
  const count8 = ws.newBlock('sprout_number');
  count8.setFieldValue('8', 'NUM');
  repeatBlock.getInput('COUNT')!.connection!.connect(count8.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const fwd60 = ws.newBlock('sprout_number');
  fwd60.setFieldValue('60', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd60.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const turn45 = ws.newBlock('sprout_number');
  turn45.setFieldValue('45', 'NUM');
  turnBlock.getInput('DEGREES')!.connection!.connect(turn45.outputConnection!);

  repeatBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 5: click-event — on :click do forward(20); turn(15) end
// ---------------------------------------------------------------------------
function buildClickEventWorkspace(ws: Blockly.Workspace): void {
  const onBlock = ws.newBlock('sprout_on_event');
  onBlock.setFieldValue('click', 'EVENT');

  const fwdBlock = ws.newBlock('sprout_forward');
  const fwd20 = ws.newBlock('sprout_number');
  fwd20.setFieldValue('20', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd20.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const turn15 = ws.newBlock('sprout_number');
  turn15.setFieldValue('15', 'NUM');
  turnBlock.getInput('DEGREES')!.connection!.connect(turn15.outputConnection!);

  onBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('compileWorkspace', () => {
  it('compiles square fixture', () => {
    const ws = makeWorkspace();
    buildSquareWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(squareProgram);
    ws.dispose();
  });

  it('compiles polygon fixture', () => {
    const ws = makeWorkspace();
    buildPolygonWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(polygonProgram);
    ws.dispose();
  });

  it('compiles beside fixture', () => {
    const ws = makeWorkspace();
    buildBesideWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(besideProgram);
    ws.dispose();
  });

  it('compiles repeat-loop fixture', () => {
    const ws = makeWorkspace();
    buildRepeatLoopWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(repeatProgram);
    ws.dispose();
  });

  it('compiles click-event fixture', () => {
    const ws = makeWorkspace();
    buildClickEventWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(clickProgram);
    ws.dispose();
  });

  it('compiles sprout_color block to color(:red) CallExpr', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_color');
    block.setFieldValue('red', 'COLOR');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'color',
          args: [{ kind: 'SymbolLit', name: 'red' }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('compiles sprout_pen_width block to penWidth(3) CallExpr', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_pen_width');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('3', 'NUM');
    block.getInput('WIDTH')!.connection!.connect(numBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'penWidth',
          args: [{ kind: 'NumberLit', value: 3 }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('compiles sprout_if (no else) to IfExpr', () => {
    const ws = makeWorkspace();
    const ifBlock = ws.newBlock('sprout_if');

    const condBlock = ws.newBlock('sprout_bool');
    condBlock.setFieldValue('true', 'VALUE');
    ifBlock.getInput('COND')!.connection!.connect(condBlock.outputConnection!);

    const fwdBlock = ws.newBlock('sprout_forward');
    const fwd20 = ws.newBlock('sprout_number');
    fwd20.setFieldValue('20', 'NUM');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd20.outputConnection!);
    ifBlock.getInput('THEN')!.connection!.connect(fwdBlock.previousConnection!);

    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];
    const result = compileWorkspace(ws);

    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'IfExpr',
          cond: { kind: 'BoolLit', value: true },
          then: {
            kind: 'BlockExpr',
            body: [{
              kind: 'ExprStmt',
              expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 20 }], block: null },
            }],
          },
          else: null,
        },
      }],
    });
    ws.dispose();
  });

  it('compiles sprout_if with else to IfExpr with else branch', () => {
    const ws = makeWorkspace();
    const ifBlock = ws.newBlock('sprout_if');

    const condBlock = ws.newBlock('sprout_bool');
    condBlock.setFieldValue('false', 'VALUE');
    ifBlock.getInput('COND')!.connection!.connect(condBlock.outputConnection!);

    const thenFwd = ws.newBlock('sprout_forward');
    const thenNum = ws.newBlock('sprout_number');
    thenNum.setFieldValue('10', 'NUM');
    thenFwd.getInput('DISTANCE')!.connection!.connect(thenNum.outputConnection!);
    ifBlock.getInput('THEN')!.connection!.connect(thenFwd.previousConnection!);

    const elseTurn = ws.newBlock('sprout_turn');
    const elseNum = ws.newBlock('sprout_number');
    elseNum.setFieldValue('90', 'NUM');
    elseTurn.getInput('DEGREES')!.connection!.connect(elseNum.outputConnection!);
    ifBlock.getInput('ELSE')!.connection!.connect(elseTurn.previousConnection!);

    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];
    const result = compileWorkspace(ws);

    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'IfExpr',
          cond: { kind: 'BoolLit', value: false },
          then: {
            kind: 'BlockExpr',
            body: [{
              kind: 'ExprStmt',
              expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 10 }], block: null },
            }],
          },
          else: {
            kind: 'BlockExpr',
            body: [{
              kind: 'ExprStmt',
              expr: { kind: 'CallExpr', callee: 'turn', args: [{ kind: 'NumberLit', value: 90 }], block: null },
            }],
          },
        },
      }],
    });
    ws.dispose();
  });

  it('compiles sprout_compare to InfixExpr', () => {
    const ws = makeWorkspace();
    const cmpBlock = ws.newBlock('sprout_compare');
    cmpBlock.setFieldValue('<', 'OP');
    const left = ws.newBlock('sprout_number');
    left.setFieldValue('3', 'NUM');
    const right = ws.newBlock('sprout_number');
    right.setFieldValue('10', 'NUM');
    cmpBlock.getInput('LEFT')!.connection!.connect(left.outputConnection!);
    cmpBlock.getInput('RIGHT')!.connection!.connect(right.outputConnection!);

    const ifBlock = ws.newBlock('sprout_if');
    ifBlock.getInput('COND')!.connection!.connect(cmpBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];

    const result = compileWorkspace(ws);
    const ifExpr = (result.stmts[0] as { kind: 'ExprStmt'; expr: { kind: 'IfExpr'; cond: unknown } }).expr;
    expect(ifExpr.cond).toEqual({
      kind: 'InfixExpr',
      op: '<',
      left: { kind: 'NumberLit', value: 3 },
      right: { kind: 'NumberLit', value: 10 },
    });
    ws.dispose();
  });

  it('compiles sprout_not to UnaryExpr', () => {
    const ws = makeWorkspace();
    const notBlock = ws.newBlock('sprout_not');
    const boolBlock = ws.newBlock('sprout_bool');
    boolBlock.setFieldValue('true', 'VALUE');
    notBlock.getInput('OPERAND')!.connection!.connect(boolBlock.outputConnection!);

    const ifBlock = ws.newBlock('sprout_if');
    ifBlock.getInput('COND')!.connection!.connect(notBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];

    const result = compileWorkspace(ws);
    const ifExpr = (result.stmts[0] as { kind: 'ExprStmt'; expr: { kind: 'IfExpr'; cond: unknown } }).expr;
    expect(ifExpr.cond).toEqual({
      kind: 'UnaryExpr',
      op: 'not',
      operand: { kind: 'BoolLit', value: true },
    });
    ws.dispose();
  });

  it('compiles sprout_and to InfixExpr', () => {
    const ws = makeWorkspace();
    const andBlock = ws.newBlock('sprout_and');
    const left = ws.newBlock('sprout_bool');
    left.setFieldValue('true', 'VALUE');
    const right = ws.newBlock('sprout_bool');
    right.setFieldValue('false', 'VALUE');
    andBlock.getInput('LEFT')!.connection!.connect(left.outputConnection!);
    andBlock.getInput('RIGHT')!.connection!.connect(right.outputConnection!);

    const ifBlock = ws.newBlock('sprout_if');
    ifBlock.getInput('COND')!.connection!.connect(andBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];

    const result = compileWorkspace(ws);
    const ifExpr = (result.stmts[0] as { kind: 'ExprStmt'; expr: { kind: 'IfExpr'; cond: unknown } }).expr;
    expect(ifExpr.cond).toEqual({
      kind: 'InfixExpr',
      op: 'and',
      left: { kind: 'BoolLit', value: true },
      right: { kind: 'BoolLit', value: false },
    });
    ws.dispose();
  });

  it('compiles sprout_bool block to BoolLit', () => {
    const ws = makeWorkspace();
    const boolBlock = ws.newBlock('sprout_bool');
    boolBlock.setFieldValue('false', 'VALUE');

    const ifBlock = ws.newBlock('sprout_if');
    ifBlock.getInput('COND')!.connection!.connect(boolBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [ifBlock];

    const result = compileWorkspace(ws);
    const ifExpr = (result.stmts[0] as { kind: 'ExprStmt'; expr: { kind: 'IfExpr'; cond: unknown } }).expr;
    expect(ifExpr.cond).toEqual({ kind: 'BoolLit', value: false });
    ws.dispose();
  });

  it('sprout_let compiles to LetStmt', () => {
    const ws = makeWorkspace();
    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('x', 'NAME');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('5', 'NUM');
    letBlock.getInput('INIT')!.connection!.connect(numBlock.outputConnection!);

    const result = compileWorkspace(ws);
    const expected: LetStmt = { kind: 'LetStmt', name: 'x', init: { kind: 'NumberLit', value: 5 } };
    expect(result).toEqual({ kind: 'Program', stmts: [expected] });
    ws.dispose();
  });

  it('sprout_set compiles to AssignStmt', () => {
    const ws = makeWorkspace();
    const setBlock = ws.newBlock('sprout_set');
    setBlock.setFieldValue('x', 'NAME');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('99', 'NUM');
    setBlock.getInput('VALUE')!.connection!.connect(numBlock.outputConnection!);

    const result = compileWorkspace(ws);
    const expected: AssignStmt = { kind: 'AssignStmt', name: 'x', value: { kind: 'NumberLit', value: 99 } };
    expect(result).toEqual({ kind: 'Program', stmts: [expected] });
    ws.dispose();
  });

  it('sprout_while compiles to ExprStmt wrapping WhileExpr', () => {
    const ws = makeWorkspace();
    const whileBlock = ws.newBlock('sprout_while');

    const boolBlock = ws.newBlock('sprout_bool');
    boolBlock.setFieldValue('true', 'VALUE');
    whileBlock.getInput('COND')!.connection!.connect(boolBlock.outputConnection!);

    const fwdBlock = ws.newBlock('sprout_forward');
    const distBlock = ws.newBlock('sprout_number');
    distBlock.setFieldValue('10', 'NUM');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(distBlock.outputConnection!);
    whileBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);

    const result = compileWorkspace(ws);
    const expected: WhileExpr = {
      kind: 'WhileExpr',
      cond: { kind: 'BoolLit', value: true },
      body: {
        kind: 'BlockExpr',
        body: [{
          kind: 'ExprStmt',
          expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 10 }], block: null },
        }],
      },
    };
    expect(result).toEqual({ kind: 'Program', stmts: [{ kind: 'ExprStmt', expr: expected }] });
    ws.dispose();
  });
});

// ---------------------------------------------------------------------------
// Math blocks
// ---------------------------------------------------------------------------

describe('math blocks', () => {
  it('sprout_sin compiles to sin CallExpr (1-arg pattern)', () => {
    const ws = makeWorkspace();
    const sinBlock = ws.newBlock('sprout_sin');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('90', 'NUM');
    sinBlock.getInput('X')!.connection!.connect(numBlock.outputConnection!);
    const fwdBlock = ws.newBlock('sprout_forward');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(sinBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'forward',
          args: [{ kind: 'CallExpr', callee: 'sin', args: [{ kind: 'NumberLit', value: 90 }], block: null }],
          block: null,
        },
      }],
    });
  });

  it('sprout_pow compiles to pow CallExpr (2-arg pattern)', () => {
    const ws = makeWorkspace();
    const powBlock = ws.newBlock('sprout_pow');
    const base = ws.newBlock('sprout_number');
    base.setFieldValue('2', 'NUM');
    const exp = ws.newBlock('sprout_number');
    exp.setFieldValue('3', 'NUM');
    powBlock.getInput('A')!.connection!.connect(base.outputConnection!);
    powBlock.getInput('B')!.connection!.connect(exp.outputConnection!);
    const fwdBlock = ws.newBlock('sprout_forward');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(powBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'forward',
          args: [{
            kind: 'CallExpr', callee: 'pow',
            args: [{ kind: 'NumberLit', value: 2 }, { kind: 'NumberLit', value: 3 }],
            block: null,
          }],
          block: null,
        },
      }],
    });
  });

  it('sprout_pi compiles to pi CallExpr (0-arg pattern)', () => {
    const ws = makeWorkspace();
    const piBlock = ws.newBlock('sprout_pi');
    const fwdBlock = ws.newBlock('sprout_forward');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(piBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'forward',
          args: [{ kind: 'CallExpr', callee: 'pi', args: [], block: null }],
          block: null,
        },
      }],
    });
  });
});

// ---------------------------------------------------------------------------
// Shape blocks
// ---------------------------------------------------------------------------

describe('shape blocks', () => {
  it('sprout_circle compiles to circle CallExpr', () => {
    const ws = makeWorkspace();
    const circleBlock = ws.newBlock('sprout_circle');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('50', 'NUM');
    circleBlock.getInput('R')!.connection!.connect(numBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: { kind: 'CallExpr', callee: 'circle', args: [{ kind: 'NumberLit', value: 50 }], block: null },
      }],
    });
    ws.dispose();
  });

  it('sprout_rect compiles to rect CallExpr with width and height', () => {
    const ws = makeWorkspace();
    const rectBlock = ws.newBlock('sprout_rect');
    const wNum = ws.newBlock('sprout_number');
    wNum.setFieldValue('80', 'NUM');
    const hNum = ws.newBlock('sprout_number');
    hNum.setFieldValue('40', 'NUM');
    rectBlock.getInput('W')!.connection!.connect(wNum.outputConnection!);
    rectBlock.getInput('H')!.connection!.connect(hNum.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'rect',
          args: [{ kind: 'NumberLit', value: 80 }, { kind: 'NumberLit', value: 40 }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_ellipse compiles to ellipse CallExpr with rx and ry', () => {
    const ws = makeWorkspace();
    const ellipseBlock = ws.newBlock('sprout_ellipse');
    const rxNum = ws.newBlock('sprout_number');
    rxNum.setFieldValue('60', 'NUM');
    const ryNum = ws.newBlock('sprout_number');
    ryNum.setFieldValue('30', 'NUM');
    ellipseBlock.getInput('RX')!.connection!.connect(rxNum.outputConnection!);
    ellipseBlock.getInput('RY')!.connection!.connect(ryNum.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'ellipse',
          args: [{ kind: 'NumberLit', value: 60 }, { kind: 'NumberLit', value: 30 }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_triangle compiles to triangle CallExpr', () => {
    const ws = makeWorkspace();
    const triBlock = ws.newBlock('sprout_triangle');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('50', 'NUM');
    triBlock.getInput('SIZE')!.connection!.connect(numBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: { kind: 'CallExpr', callee: 'triangle', args: [{ kind: 'NumberLit', value: 50 }], block: null },
      }],
    });
    ws.dispose();
  });
});

describe('polygon block', () => {
  it('sprout_polygon compiles to CallExpr polygon(n, size)', () => {
    const ws = makeWorkspace();
    const polygonBlock = ws.newBlock('sprout_polygon');
    const nNum = ws.newBlock('sprout_number');
    nNum.setFieldValue('6', 'NUM');
    polygonBlock.getInput('N')!.connection!.connect(nNum.outputConnection!);
    const sizeNum = ws.newBlock('sprout_number');
    sizeNum.setFieldValue('60', 'NUM');
    polygonBlock.getInput('SIZE')!.connection!.connect(sizeNum.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: { kind: 'CallExpr', callee: 'polygon', args: [{ kind: 'NumberLit', value: 6 }, { kind: 'NumberLit', value: 60 }], block: null },
      }],
    });
    ws.dispose();
  });
});

describe('text block', () => {
  it('sprout_text compiles to CallExpr text(str, size)', () => {
    const ws = makeWorkspace();
    const textBlock = ws.newBlock('sprout_text');
    const strBlock = ws.newBlock('sprout_string');
    strBlock.setFieldValue('hello', 'VALUE');
    textBlock.getInput('STR')!.connection!.connect(strBlock.outputConnection!);
    const sizeNum = ws.newBlock('sprout_number');
    sizeNum.setFieldValue('20', 'NUM');
    textBlock.getInput('SIZE')!.connection!.connect(sizeNum.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: { kind: 'CallExpr', callee: 'text', args: [{ kind: 'StringLit', value: 'hello' }, { kind: 'NumberLit', value: 20 }], block: null },
      }],
    });
    ws.dispose();
  });
});

// ---------------------------------------------------------------------------
// randomColor block
// ---------------------------------------------------------------------------

describe('randomColor block', () => {
  it('sprout_random_color with MODE="palette" compiles to randomColor()', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_random_color');
    block.setFieldValue('palette', 'MODE');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'randomColor',
          args: [],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_random_color with MODE="any" compiles to randomColor(:any)', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_random_color');
    block.setFieldValue('any', 'MODE');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'randomColor',
          args: [{ kind: 'SymbolLit', name: 'any' }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });
});

describe('on event block — new events', () => {
  const NEW_EVENTS = ['left', 'right', 'up', 'down', 'space'] as const;

  for (const event of NEW_EVENTS) {
    it(`sprout_on_event with EVENT="${event}" compiles to OnExpr(:${event})`, () => {
      const ws = makeWorkspace();
      const block = ws.newBlock('sprout_on_event');
      block.setFieldValue(event, 'EVENT');
      (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

      const result = compileWorkspace(ws);
      expect(result).toEqual({
        kind: 'Program',
        stmts: [{
          kind: 'ExprStmt',
          expr: {
            kind: 'OnExpr',
            event: { kind: 'SymbolLit', name: event },
            body: { kind: 'BlockExpr', body: [] },
            interval: null,
          },
        }],
      });
      ws.dispose();
    });
  }
});

describe('on timer block', () => {
  it('sprout_on_timer compiles to OnExpr with interval', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_on_timer');
    block.setFieldValue('500', 'INTERVAL');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];
    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'ExprStmt',
      expr: {
        kind: 'OnExpr',
        event: { kind: 'SymbolLit', name: 'timer' },
        interval: { kind: 'NumberLit', value: 500 },
        body: { kind: 'BlockExpr', body: [] },
      },
    });
  });

  it('sprout_on_timer default interval is 200', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_on_timer');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];
    const result = compileWorkspace(ws);
    const expr = (result.stmts[0] as { expr: { interval: { value: number } } }).expr;
    expect(expr.interval).toEqual({ kind: 'NumberLit', value: 200 });
  });
});

describe('background block', () => {
  it('sprout_background with COLOR="red" compiles to background(:red)', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_background');
    block.setFieldValue('red', 'COLOR');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'background',
          args: [{ kind: 'SymbolLit', name: 'red' }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_background with COLOR="white" compiles to background(:white)', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_background');
    block.setFieldValue('white', 'COLOR');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'background',
          args: [{ kind: 'SymbolLit', name: 'white' }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });
});

describe('clearCanvas block', () => {
  it('sprout_clear_canvas compiles to clearCanvas()', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_clear_canvas');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'clearCanvas',
          args: [],
          block: null,
        },
      }],
    });
    ws.dispose();
  });
});

// ---------------------------------------------------------------------------
// String blocks
// ---------------------------------------------------------------------------
describe('string blocks', () => {
  it('sprout_string compiles to StringLit', () => {
    const ws = makeWorkspace();

    const textBlock = ws.newBlock('sprout_text');
    const strBlock = ws.newBlock('sprout_string');
    strBlock.setFieldValue('hi', 'VALUE');
    const sizeBlock = ws.newBlock('sprout_number');
    sizeBlock.setFieldValue('20', 'NUM');

    textBlock.getInput('STR')!.connection!.connect(strBlock.outputConnection!);
    textBlock.getInput('SIZE')!.connection!.connect(sizeBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [textBlock];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'text',
          args: [
            { kind: 'StringLit', value: 'hi' },
            { kind: 'NumberLit', value: 20 },
          ],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_join compiles to join(A, B) CallExpr', () => {
    const ws = makeWorkspace();

    const textBlock = ws.newBlock('sprout_text');
    const joinBlock = ws.newBlock('sprout_join');
    const aBlock = ws.newBlock('sprout_string');
    aBlock.setFieldValue('hello', 'VALUE');
    const bBlock = ws.newBlock('sprout_number');
    bBlock.setFieldValue('42', 'NUM');
    const sizeBlock = ws.newBlock('sprout_number');
    sizeBlock.setFieldValue('20', 'NUM');

    joinBlock.getInput('A')!.connection!.connect(aBlock.outputConnection!);
    joinBlock.getInput('B')!.connection!.connect(bBlock.outputConnection!);
    textBlock.getInput('STR')!.connection!.connect(joinBlock.outputConnection!);
    textBlock.getInput('SIZE')!.connection!.connect(sizeBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [textBlock];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'text',
          args: [
            {
              kind: 'CallExpr',
              callee: 'join',
              args: [
                { kind: 'StringLit', value: 'hello' },
                { kind: 'NumberLit', value: 42 },
              ],
              block: null,
            },
            { kind: 'NumberLit', value: 20 },
          ],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_length compiles to length(str) CallExpr', () => {
    const ws = makeWorkspace();

    const fwdBlock = ws.newBlock('sprout_forward');
    const lenBlock = ws.newBlock('sprout_length');
    const strBlock = ws.newBlock('sprout_string');
    strBlock.setFieldValue('hello', 'VALUE');

    lenBlock.getInput('STR')!.connection!.connect(strBlock.outputConnection!);
    fwdBlock.getInput('DISTANCE')!.connection!.connect(lenBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [fwdBlock];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'forward',
          args: [{
            kind: 'CallExpr',
            callee: 'length',
            args: [{ kind: 'StringLit', value: 'hello' }],
            block: null,
          }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });
});

// ---------------------------------------------------------------------------
// sprout_return block
// ---------------------------------------------------------------------------
describe('sprout_return', () => {
  it('compiles to ReturnStmt with NumberLit value', () => {
    const ws = makeWorkspace();
    const returnBlock = ws.newBlock('sprout_return');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('42', 'NUM');
    returnBlock.getInput('VALUE')!.connection!.connect(numBlock.outputConnection!);

    const defBlock = ws.newBlock('sprout_def');
    defBlock.setFieldValue('myFn', 'NAME');
    defBlock.getInput('BODY')!.connection!.connect(returnBlock.previousConnection!);

    const prog = compileWorkspace(ws);
    expect(prog.stmts).toHaveLength(1);
    const def = prog.stmts[0];
    expect(def.kind).toBe('DefStmt');
    if (def.kind === 'DefStmt') {
      expect(def.body.kind).toBe('BlockExpr');
      if (def.body.kind === 'BlockExpr') {
        expect(def.body.body).toHaveLength(1);
        const ret = def.body.body[0];
        expect(ret.kind).toBe('ReturnStmt');
        if (ret.kind === 'ReturnStmt') {
          expect(ret.value).toEqual({ kind: 'NumberLit', value: 42 });
        }
      }
    }
  });

  it('compiles to ReturnStmt with infix expression value', () => {
    const ws = makeWorkspace();
    const returnBlock = ws.newBlock('sprout_return');
    const infixBlock = ws.newBlock('sprout_infix');
    infixBlock.setFieldValue('+', 'OP');
    const left = ws.newBlock('sprout_number');
    left.setFieldValue('2', 'NUM');
    const right = ws.newBlock('sprout_number');
    right.setFieldValue('3', 'NUM');
    infixBlock.getInput('LEFT')!.connection!.connect(left.outputConnection!);
    infixBlock.getInput('RIGHT')!.connection!.connect(right.outputConnection!);
    returnBlock.getInput('VALUE')!.connection!.connect(infixBlock.outputConnection!);

    const defBlock = ws.newBlock('sprout_def');
    defBlock.setFieldValue('myFn', 'NAME');
    defBlock.getInput('BODY')!.connection!.connect(returnBlock.previousConnection!);

    const prog = compileWorkspace(ws);
    const def = prog.stmts[0];
    if (def.kind === 'DefStmt' && def.body.kind === 'BlockExpr') {
      const ret = def.body.body[0];
      expect(ret.kind).toBe('ReturnStmt');
      if (ret.kind === 'ReturnStmt') {
        expect(ret.value).toEqual({
          kind: 'InfixExpr',
          op: '+',
          left: { kind: 'NumberLit', value: 2 },
          right: { kind: 'NumberLit', value: 3 },
        });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// sprout_input — value block: input("name")
// ---------------------------------------------------------------------------
describe('sprout_input', () => {
  it('compiles to input("name") CallExpr with StringLit arg', () => {
    const ws = makeWorkspace();
    const fwdBlock = ws.newBlock('sprout_forward');
    const inputBlock = ws.newBlock('sprout_input');
    inputBlock.setFieldValue('speed', 'NAME');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(inputBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'forward',
          args: [{
            kind: 'CallExpr',
            callee: 'input',
            args: [{ kind: 'StringLit', value: 'speed' }],
            block: null,
          }],
          block: null,
        },
      }],
    });
  });
});

describe('list blocks', () => {
  it('sprout_list with 0 connected inputs compiles to list()', () => {
    const ws = makeWorkspace();
    const listBlock = ws.newBlock('sprout_list');
    // no inputs connected — all 3 VALUE slots left unconnected

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('myList', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(listBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'myList',
      init: { kind: 'CallExpr', callee: 'list', args: [], block: null },
    });
  });

  it('sprout_list with 2 connected inputs compiles to list(a, b)', () => {
    const ws = makeWorkspace();
    const listBlock = ws.newBlock('sprout_list');
    const n1 = ws.newBlock('sprout_number');
    n1.setFieldValue('10', 'NUM');
    const n2 = ws.newBlock('sprout_number');
    n2.setFieldValue('20', 'NUM');
    listBlock.getInput('VALUE_0')!.connection!.connect(n1.outputConnection!);
    listBlock.getInput('VALUE_1')!.connection!.connect(n2.outputConnection!);
    // VALUE_2 left unconnected

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('nums', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(listBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'nums',
      init: {
        kind: 'CallExpr', callee: 'list',
        args: [
          { kind: 'NumberLit', value: 10 },
          { kind: 'NumberLit', value: 20 },
        ],
        block: null,
      },
    });
  });

  it('sprout_push compiles to push(list, val)', () => {
    const ws = makeWorkspace();
    const pushBlock = ws.newBlock('sprout_push');
    const listIdent = ws.newBlock('sprout_ident');
    listIdent.setFieldValue('colors', 'NAME');
    const val = ws.newBlock('sprout_number');
    val.setFieldValue('5', 'NUM');
    pushBlock.getInput('LIST')!.connection!.connect(listIdent.outputConnection!);
    pushBlock.getInput('VAL')!.connection!.connect(val.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('result', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(pushBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'result',
      init: {
        kind: 'CallExpr', callee: 'push',
        args: [
          { kind: 'Ident', name: 'colors' },
          { kind: 'NumberLit', value: 5 },
        ],
        block: null,
      },
    });
  });

  it('sprout_get compiles to get(list, index)', () => {
    const ws = makeWorkspace();
    const getBlock = ws.newBlock('sprout_get');
    const listIdent = ws.newBlock('sprout_ident');
    listIdent.setFieldValue('scores', 'NAME');
    const idx = ws.newBlock('sprout_number');
    idx.setFieldValue('1', 'NUM');
    getBlock.getInput('LIST')!.connection!.connect(listIdent.outputConnection!);
    getBlock.getInput('INDEX')!.connection!.connect(idx.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('item', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(getBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'item',
      init: {
        kind: 'CallExpr', callee: 'get',
        args: [
          { kind: 'Ident', name: 'scores' },
          { kind: 'NumberLit', value: 1 },
        ],
        block: null,
      },
    });
  });

  it('sprout_size compiles to size(list)', () => {
    const ws = makeWorkspace();
    const sizeBlock = ws.newBlock('sprout_size');
    const listIdent = ws.newBlock('sprout_ident');
    listIdent.setFieldValue('items', 'NAME');
    sizeBlock.getInput('LIST')!.connection!.connect(listIdent.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('n', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(sizeBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'n',
      init: {
        kind: 'CallExpr', callee: 'size',
        args: [{ kind: 'Ident', name: 'items' }],
        block: null,
      },
    });
  });

  it('sprout_is_empty compiles to isEmpty(list)', () => {
    const ws = makeWorkspace();
    const isEmptyBlock = ws.newBlock('sprout_is_empty');
    const listIdent = ws.newBlock('sprout_ident');
    listIdent.setFieldValue('things', 'NAME');
    isEmptyBlock.getInput('LIST')!.connection!.connect(listIdent.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('empty', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(isEmptyBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'empty',
      init: {
        kind: 'CallExpr', callee: 'isEmpty',
        args: [{ kind: 'Ident', name: 'things' }],
        block: null,
      },
    });
  });
});

describe('new list blocks', () => {
  it('sprout_first compiles to first(list)', () => {
    const ws = makeWorkspace();
    const firstBlock = ws.newBlock('sprout_first');
    const listIdent = ws.newBlock('sprout_ident');
    listIdent.setFieldValue('items', 'NAME');
    firstBlock.getInput('LIST')!.connection!.connect(listIdent.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('head', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(firstBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'head',
      init: {
        kind: 'CallExpr', callee: 'first',
        args: [{ kind: 'Ident', name: 'items' }],
        block: null,
      },
    });
  });

  it('sprout_last compiles to last(list)', () => {
    const ws = makeWorkspace();
    const lastBlock = ws.newBlock('sprout_last');
    const listIdent = ws.newBlock('sprout_ident');
    listIdent.setFieldValue('items', 'NAME');
    lastBlock.getInput('LIST')!.connection!.connect(listIdent.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('tail', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(lastBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'tail',
      init: {
        kind: 'CallExpr', callee: 'last',
        args: [{ kind: 'Ident', name: 'items' }],
        block: null,
      },
    });
  });

  it('sprout_pop compiles to pop(list)', () => {
    const ws = makeWorkspace();
    const popBlock = ws.newBlock('sprout_pop');
    const listIdent = ws.newBlock('sprout_ident');
    listIdent.setFieldValue('items', 'NAME');
    popBlock.getInput('LIST')!.connection!.connect(listIdent.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('shorter', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(popBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'shorter',
      init: {
        kind: 'CallExpr', callee: 'pop',
        args: [{ kind: 'Ident', name: 'items' }],
        block: null,
      },
    });
  });

  it('sprout_concat compiles to concat(list1, list2)', () => {
    const ws = makeWorkspace();
    const concatBlock = ws.newBlock('sprout_concat');
    const a = ws.newBlock('sprout_ident');
    a.setFieldValue('xs', 'NAME');
    const b = ws.newBlock('sprout_ident');
    b.setFieldValue('ys', 'NAME');
    concatBlock.getInput('LIST1')!.connection!.connect(a.outputConnection!);
    concatBlock.getInput('LIST2')!.connection!.connect(b.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('all', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(concatBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'all',
      init: {
        kind: 'CallExpr', callee: 'concat',
        args: [
          { kind: 'Ident', name: 'xs' },
          { kind: 'Ident', name: 'ys' },
        ],
        block: null,
      },
    });
  });

  it('sprout_reverse compiles to reverse(list)', () => {
    const ws = makeWorkspace();
    const revBlock = ws.newBlock('sprout_reverse');
    const listIdent = ws.newBlock('sprout_ident');
    listIdent.setFieldValue('items', 'NAME');
    revBlock.getInput('LIST')!.connection!.connect(listIdent.outputConnection!);

    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('rev', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(revBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'rev',
      init: {
        kind: 'CallExpr', callee: 'reverse',
        args: [{ kind: 'Ident', name: 'items' }],
        block: null,
      },
    });
  });
});

describe('stamp block', () => {
  it('sprout_stamp compiles to stamp()', () => {
    const ws = makeWorkspace();
    const stampBlock = ws.newBlock('sprout_stamp');
    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('s', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(stampBlock.outputConnection!);
    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 's',
      init: { kind: 'CallExpr', callee: 'stamp', args: [], block: null },
    });
  });
});

describe('for each block', () => {
  it('sprout_for_each compiles to ExprStmt wrapping ForEachExpr', () => {
    const ws = makeWorkspace();
    const forEachBlock = ws.newBlock('sprout_for_each');
    forEachBlock.setFieldValue('myItem', 'ITEM');

    const listBlock = ws.newBlock('sprout_list');
    forEachBlock.getInput('LIST')!.connection!.connect(listBlock.outputConnection!);

    const fwdBlock = ws.newBlock('sprout_forward');
    const distBlock = ws.newBlock('sprout_number');
    distBlock.setFieldValue('10', 'NUM');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(distBlock.outputConnection!);
    forEachBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);

    const result = compileWorkspace(ws);
    const expected: ForEachExpr = {
      kind: 'ForEachExpr',
      item: 'myItem',
      list: { kind: 'CallExpr', callee: 'list', args: [], block: null },
      body: {
        kind: 'BlockExpr',
        body: [{
          kind: 'ExprStmt',
          expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 10 }], block: null },
        }],
      },
    };
    expect(result).toEqual({ kind: 'Program', stmts: [{ kind: 'ExprStmt', expr: expected }] });
    ws.dispose();
  });
});
