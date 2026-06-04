import * as Blockly from 'blockly/node';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllBlocks } from '../src/definitions/index.js';
import { compileWorkspace } from '../src/compiler.js';
import type { LetStmt, AssignStmt, WhileExpr } from '@sprout/lang';
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
    textBlock.setFieldValue('hello', 'TEXT');
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
  const NEW_EVENTS = ['left', 'right', 'up', 'down', 'space', 'timer'] as const;

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
          },
        }],
      });
      ws.dispose();
    });
  }
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
