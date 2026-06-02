import * as Blockly from 'blockly/node';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllBlocks } from '../src/definitions/index.js';
import { compileWorkspace } from '../src/compiler.js';
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
});
