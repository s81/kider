import * as Blockly from 'blockly/node';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllBlocks } from '../src/definitions/index.js';
import { generateText } from '../src/generator.js';
import { expectedText as squareText } from '../../../examples/square.fixture.js';
import { expectedText as polygonText } from '../../../examples/polygon.fixture.js';
import { expectedText as besideText } from '../../../examples/beside.fixture.js';
import { expectedText as repeatText } from '../../../examples/repeat-loop.fixture.js';
import { expectedText as clickText } from '../../../examples/click-event.fixture.js';

beforeAll(() => {
  registerAllBlocks();
});

function makeWs(): Blockly.Workspace { return new Blockly.Workspace(); }

function buildSquare(ws: Blockly.Workspace): void {
  const r = ws.newBlock('sprout_repeat');
  const c = ws.newBlock('sprout_number'); c.setFieldValue('4', 'NUM');
  r.getInput('COUNT')!.connection!.connect(c.outputConnection!);
  const f = ws.newBlock('sprout_forward');
  const f100 = ws.newBlock('sprout_number'); f100.setFieldValue('100', 'NUM');
  f.getInput('DISTANCE')!.connection!.connect(f100.outputConnection!);
  const t = ws.newBlock('sprout_turn');
  const t90 = ws.newBlock('sprout_number'); t90.setFieldValue('90', 'NUM');
  t.getInput('DEGREES')!.connection!.connect(t90.outputConnection!);
  r.getInput('BODY')!.connection!.connect(f.previousConnection!);
  f.nextConnection!.connect(t.previousConnection!);
}

function buildPolygon(ws: Blockly.Workspace): void {
  const def = ws.newBlock('sprout_def');
  def.setFieldValue('polygon', 'NAME');
  def.setFieldValue('sides', 'PARAM0');
  def.setFieldValue('size', 'PARAM1');
  const rep = ws.newBlock('sprout_repeat');
  const sc = ws.newBlock('sprout_ident'); sc.setFieldValue('sides', 'NAME');
  rep.getInput('COUNT')!.connection!.connect(sc.outputConnection!);
  const fwd = ws.newBlock('sprout_forward');
  const si = ws.newBlock('sprout_ident'); si.setFieldValue('size', 'NAME');
  fwd.getInput('DISTANCE')!.connection!.connect(si.outputConnection!);
  const trn = ws.newBlock('sprout_turn');
  const inf = ws.newBlock('sprout_infix'); inf.setFieldValue('/', 'OP');
  const n360 = ws.newBlock('sprout_number'); n360.setFieldValue('360', 'NUM');
  const si2 = ws.newBlock('sprout_ident'); si2.setFieldValue('sides', 'NAME');
  inf.getInput('LEFT')!.connection!.connect(n360.outputConnection!);
  inf.getInput('RIGHT')!.connection!.connect(si2.outputConnection!);
  trn.getInput('DEGREES')!.connection!.connect(inf.outputConnection!);
  rep.getInput('BODY')!.connection!.connect(fwd.previousConnection!);
  fwd.nextConnection!.connect(trn.previousConnection!);
  def.getInput('BODY')!.connection!.connect(rep.previousConnection!);
  const call = ws.newBlock('sprout_call_stmt'); call.setFieldValue('polygon', 'CALLEE');
  const a6 = ws.newBlock('sprout_number'); a6.setFieldValue('6', 'NUM');
  const a80 = ws.newBlock('sprout_number'); a80.setFieldValue('80', 'NUM');
  call.getInput('ARG0')!.connection!.connect(a6.outputConnection!);
  call.getInput('ARG1')!.connection!.connect(a80.outputConnection!);
  def.nextConnection!.connect(call.previousConnection!);
}

function buildBeside(ws: Blockly.Workspace): void {
  const def = ws.newBlock('sprout_def'); def.setFieldValue('square', 'NAME');
  const rep = ws.newBlock('sprout_repeat');
  const c4 = ws.newBlock('sprout_number'); c4.setFieldValue('4', 'NUM');
  rep.getInput('COUNT')!.connection!.connect(c4.outputConnection!);
  const fwd = ws.newBlock('sprout_forward');
  const f100 = ws.newBlock('sprout_number'); f100.setFieldValue('100', 'NUM');
  fwd.getInput('DISTANCE')!.connection!.connect(f100.outputConnection!);
  const trn = ws.newBlock('sprout_turn');
  const t90 = ws.newBlock('sprout_number'); t90.setFieldValue('90', 'NUM');
  trn.getInput('DEGREES')!.connection!.connect(t90.outputConnection!);
  rep.getInput('BODY')!.connection!.connect(fwd.previousConnection!);
  fwd.nextConnection!.connect(trn.previousConnection!);
  def.getInput('BODY')!.connection!.connect(rep.previousConnection!);
  const bd = ws.newBlock('sprout_beside');
  const sq1 = ws.newBlock('sprout_call_expr'); sq1.setFieldValue('square', 'CALLEE');
  const sq2 = ws.newBlock('sprout_call_expr'); sq2.setFieldValue('square', 'CALLEE');
  bd.getInput('LEFT')!.connection!.connect(sq1.outputConnection!);
  bd.getInput('RIGHT')!.connection!.connect(sq2.outputConnection!);
  def.nextConnection!.connect(bd.previousConnection!);
}

function buildRepeatLoop(ws: Blockly.Workspace): void {
  const rep = ws.newBlock('sprout_repeat');
  const c8 = ws.newBlock('sprout_number'); c8.setFieldValue('8', 'NUM');
  rep.getInput('COUNT')!.connection!.connect(c8.outputConnection!);
  const fwd = ws.newBlock('sprout_forward');
  const f60 = ws.newBlock('sprout_number'); f60.setFieldValue('60', 'NUM');
  fwd.getInput('DISTANCE')!.connection!.connect(f60.outputConnection!);
  const trn = ws.newBlock('sprout_turn');
  const t45 = ws.newBlock('sprout_number'); t45.setFieldValue('45', 'NUM');
  trn.getInput('DEGREES')!.connection!.connect(t45.outputConnection!);
  rep.getInput('BODY')!.connection!.connect(fwd.previousConnection!);
  fwd.nextConnection!.connect(trn.previousConnection!);
}

function buildClickEvent(ws: Blockly.Workspace): void {
  const on = ws.newBlock('sprout_on_event'); on.setFieldValue('click', 'EVENT');
  const fwd = ws.newBlock('sprout_forward');
  const f20 = ws.newBlock('sprout_number'); f20.setFieldValue('20', 'NUM');
  fwd.getInput('DISTANCE')!.connection!.connect(f20.outputConnection!);
  const trn = ws.newBlock('sprout_turn');
  const t15 = ws.newBlock('sprout_number'); t15.setFieldValue('15', 'NUM');
  trn.getInput('DEGREES')!.connection!.connect(t15.outputConnection!);
  on.getInput('BODY')!.connection!.connect(fwd.previousConnection!);
  fwd.nextConnection!.connect(trn.previousConnection!);
}

describe('generateText', () => {
  it('generates square text', () => {
    const ws = makeWs();
    buildSquare(ws);
    expect(generateText(ws)).toBe(squareText);
    ws.dispose();
  });

  it('generates polygon text', () => {
    const ws = makeWs();
    buildPolygon(ws);
    expect(generateText(ws)).toBe(polygonText);
    ws.dispose();
  });

  it('generates beside text', () => {
    const ws = makeWs();
    buildBeside(ws);
    expect(generateText(ws)).toBe(besideText);
    ws.dispose();
  });

  it('generates repeat-loop text', () => {
    const ws = makeWs();
    buildRepeatLoop(ws);
    expect(generateText(ws)).toBe(repeatText);
    ws.dispose();
  });

  it('generates click-event text', () => {
    const ws = makeWs();
    buildClickEvent(ws);
    expect(generateText(ws)).toBe(clickText);
    ws.dispose();
  });
});
