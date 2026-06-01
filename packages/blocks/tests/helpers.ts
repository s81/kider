// Workspace builder helpers for each of the 5 example fixtures.
// Each function produces a fresh Blockly.Workspace whose block structure
// mirrors the hand-built AST in examples/*.fixture.ts.

import * as Blockly from 'blockly';
import { registerBlocks } from '../src/blocks.js';

registerBlocks();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ws(): Blockly.Workspace {
  return new Blockly.Workspace();
}

function num(workspace: Blockly.Workspace, value: number): Blockly.Block {
  const b = workspace.newBlock('sprout_number');
  b.setFieldValue(String(value), 'VALUE');
  return b;
}

function ident(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const b = workspace.newBlock('sprout_ident');
  b.setFieldValue(name, 'NAME');
  return b;
}

function forward(workspace: Blockly.Workspace, distance: Blockly.Block): Blockly.Block {
  const b = workspace.newBlock('sprout_forward');
  b.getInput('DISTANCE')!.connection!.connect(distance.outputConnection!);
  return b;
}

function turn(workspace: Blockly.Workspace, degrees: Blockly.Block): Blockly.Block {
  const b = workspace.newBlock('sprout_turn');
  b.getInput('DEGREES')!.connection!.connect(degrees.outputConnection!);
  return b;
}

/** Chain statement blocks: a → b → c → ... */
function chain(...blocks: Blockly.Block[]): void {
  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].nextConnection!.connect(blocks[i + 1].previousConnection!);
  }
}

/** Attach `firstStmt` as the first statement inside a statement input. */
function setBody(parent: Blockly.Block, inputName: string, firstStmt: Blockly.Block): void {
  parent.getInput(inputName)!.connection!.connect(firstStmt.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 1: square — repeat 4 do forward(100); turn(90) end
// ---------------------------------------------------------------------------

export function buildSquareWorkspace(): Blockly.Workspace {
  const w = ws();

  const repeatBlock = w.newBlock('sprout_repeat');
  repeatBlock.getInput('COUNT')!.connection!.connect(num(w, 4).outputConnection!);

  const fwd = forward(w, num(w, 100));
  const trn = turn(w, num(w, 90));
  chain(fwd, trn);
  setBody(repeatBlock, 'DO', fwd);

  return w;
}

// ---------------------------------------------------------------------------
// Fixture 2: polygon — def polygon(sides, size) + polygon(6, 80)
// ---------------------------------------------------------------------------

export function buildPolygonWorkspace(): Blockly.Workspace {
  const w = ws();

  // def polygon(sides, size)
  const defBlock = w.newBlock('sprout_def');
  defBlock.setFieldValue('polygon', 'NAME');
  defBlock.setFieldValue('sides, size', 'PARAMS');

  // repeat sides do
  const repeatBlock = w.newBlock('sprout_repeat');
  repeatBlock.getInput('COUNT')!.connection!.connect(ident(w, 'sides').outputConnection!);

  // forward(size)
  const fwd = forward(w, ident(w, 'size'));

  // turn(360 / sides)
  const infix = w.newBlock('sprout_infix');
  infix.getInput('LEFT')!.connection!.connect(num(w, 360).outputConnection!);
  infix.setFieldValue('/', 'OP');
  infix.getInput('RIGHT')!.connection!.connect(ident(w, 'sides').outputConnection!);
  const trn = turn(w, infix);

  chain(fwd, trn);
  setBody(repeatBlock, 'DO', fwd);
  setBody(defBlock, 'DO', repeatBlock);

  // polygon(6, 80)  — standalone call statement chained after def
  const callBlock = w.newBlock('sprout_call_stmt');
  callBlock.setFieldValue('polygon', 'CALLEE');
  callBlock.getInput('ARG0')!.connection!.connect(num(w, 6).outputConnection!);
  callBlock.getInput('ARG1')!.connection!.connect(num(w, 80).outputConnection!);

  chain(defBlock, callBlock);

  return w;
}

// ---------------------------------------------------------------------------
// Fixture 3: beside — def square + beside(square(), square())
// ---------------------------------------------------------------------------

export function buildBesideWorkspace(): Blockly.Workspace {
  const w = ws();

  // def square  (no params)
  const defBlock = w.newBlock('sprout_def');
  defBlock.setFieldValue('square', 'NAME');
  defBlock.setFieldValue('', 'PARAMS');

  const repeatBlock = w.newBlock('sprout_repeat');
  repeatBlock.getInput('COUNT')!.connection!.connect(num(w, 4).outputConnection!);

  const fwd = forward(w, num(w, 100));
  const trn = turn(w, num(w, 90));
  chain(fwd, trn);
  setBody(repeatBlock, 'DO', fwd);
  setBody(defBlock, 'DO', repeatBlock);

  // beside(square(), square())
  // square() as a call_value block (zero args)
  function callSquare(): Blockly.Block {
    const b = w.newBlock('sprout_call_value');
    b.setFieldValue('square', 'CALLEE');
    return b;
  }

  const besideBlock = w.newBlock('sprout_beside');
  besideBlock.getInput('LEFT')!.connection!.connect(callSquare().outputConnection!);
  besideBlock.getInput('RIGHT')!.connection!.connect(callSquare().outputConnection!);

  const exprStmt = w.newBlock('sprout_expr_stmt');
  exprStmt.getInput('EXPR')!.connection!.connect(besideBlock.outputConnection!);

  chain(defBlock, exprStmt);

  return w;
}

// ---------------------------------------------------------------------------
// Fixture 4: repeat-loop — repeat 8 do forward(60); turn(45) end
// ---------------------------------------------------------------------------

export function buildRepeatLoopWorkspace(): Blockly.Workspace {
  const w = ws();

  const repeatBlock = w.newBlock('sprout_repeat');
  repeatBlock.getInput('COUNT')!.connection!.connect(num(w, 8).outputConnection!);

  const fwd = forward(w, num(w, 60));
  const trn = turn(w, num(w, 45));
  chain(fwd, trn);
  setBody(repeatBlock, 'DO', fwd);

  return w;
}

// ---------------------------------------------------------------------------
// Fixture 5: click-event — on :click do forward(20); turn(15) end
// ---------------------------------------------------------------------------

export function buildClickEventWorkspace(): Blockly.Workspace {
  const w = ws();

  const onBlock = w.newBlock('sprout_on');
  onBlock.setFieldValue('click', 'EVENT');

  const fwd = forward(w, num(w, 20));
  const trn = turn(w, num(w, 15));
  chain(fwd, trn);
  setBody(onBlock, 'DO', fwd);

  return w;
}
