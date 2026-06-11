// decompiler.ts — the inverse of compiler.ts: materialize a Program AST as
// Blockly blocks. compiler.ts is the ground truth for every block's input
// and field names; each mapping here inverts one of its cases.
//
// Calls without a dedicated block fall back to the generic call blocks
// (sprout_call_stmt / sprout_call_expr, up to 2 args). Anything that cannot
// be represented as blocks at all throws DecompileError — callers fall back
// to text mode.

import * as Blockly from 'blockly/node';
import type {
  Program, Stmt, Expr,
  DefStmt, CallExpr, InfixExpr, StringLit,
  BlockExpr, RepeatExpr, FillExpr, OnExpr, IfExpr, WhileExpr, ForEachExpr,
} from '@sprout/lang';

export class DecompileError extends Error {}

// ---------------------------------------------------------------------------
// Call → dedicated block tables. Inputs are listed in argument order.
// ---------------------------------------------------------------------------

const STMT_CALL_BLOCKS: Record<string, { type: string; inputs: string[] }> = {
  forward:     { type: 'sprout_forward',      inputs: ['DISTANCE'] },
  turn:        { type: 'sprout_turn',         inputs: ['DEGREES'] },
  penUp:       { type: 'sprout_pen_up',       inputs: [] },
  penDown:     { type: 'sprout_pen_down',     inputs: [] },
  clearCanvas: { type: 'sprout_clear_canvas', inputs: [] },
  home:        { type: 'sprout_home',         inputs: [] },
  beep:        { type: 'sprout_beep',         inputs: [] },
  stopTimer:   { type: 'sprout_stop_timer',   inputs: [] },
  hideTurtle:  { type: 'sprout_hide_turtle',  inputs: [] },
  showTurtle:  { type: 'sprout_show_turtle',  inputs: [] },
  penWidth:    { type: 'sprout_pen_width',    inputs: ['WIDTH'] },
  puts:        { type: 'sprout_puts',         inputs: ['VALUE'] },
  wait:        { type: 'sprout_wait',         inputs: ['SECS'] },
  circle:      { type: 'sprout_circle',       inputs: ['R'] },
  rect:        { type: 'sprout_rect',         inputs: ['W', 'H'] },
  ellipse:     { type: 'sprout_ellipse',      inputs: ['RX', 'RY'] },
  triangle:    { type: 'sprout_triangle',     inputs: ['SIZE'] },
  polygon:     { type: 'sprout_polygon',      inputs: ['N', 'SIZE'] },
  text:        { type: 'sprout_text',         inputs: ['STR', 'SIZE'] },
  arc:         { type: 'sprout_arc',          inputs: ['RADIUS', 'ANGLE'] },
  goto:        { type: 'sprout_goto',         inputs: ['X', 'Y'] },
  beside:      { type: 'sprout_beside',       inputs: ['LEFT', 'RIGHT'] },
  above:       { type: 'sprout_above',        inputs: ['TOP', 'BOTTOM'] },
  scale:       { type: 'sprout_scale',        inputs: ['FACTOR', 'DRAWING'] },
  show:        { type: 'sprout_show',         inputs: ['LABEL', 'VALUE'] },
};

const EXPR_CALL_BLOCKS: Record<string, { type: string; inputs: string[] }> = {
  sin:        { type: 'sprout_sin',        inputs: ['X'] },
  cos:        { type: 'sprout_cos',        inputs: ['X'] },
  tan:        { type: 'sprout_tan',        inputs: ['X'] },
  abs:        { type: 'sprout_abs',        inputs: ['X'] },
  sqrt:       { type: 'sprout_sqrt',       inputs: ['X'] },
  log:        { type: 'sprout_log',        inputs: ['X'] },
  floor:      { type: 'sprout_floor',      inputs: ['X'] },
  ceil:       { type: 'sprout_ceil',       inputs: ['X'] },
  round:      { type: 'sprout_round',      inputs: ['X'] },
  pow:        { type: 'sprout_pow',        inputs: ['A', 'B'] },
  mod:        { type: 'sprout_mod',        inputs: ['A', 'B'] },
  max:        { type: 'sprout_max',        inputs: ['A', 'B'] },
  min:        { type: 'sprout_min',        inputs: ['A', 'B'] },
  pi:         { type: 'sprout_pi',         inputs: [] },
  random:     { type: 'sprout_random',     inputs: ['MIN', 'MAX'] },
  join:       { type: 'sprout_join',       inputs: ['A', 'B'] },
  length:     { type: 'sprout_length',     inputs: ['STR'] },
  split:      { type: 'sprout_split',      inputs: ['STR', 'SEP'] },
  toUpper:    { type: 'sprout_to_upper',   inputs: ['STR'] },
  toLower:    { type: 'sprout_to_lower',   inputs: ['STR'] },
  mouseX:     { type: 'sprout_mouse_x',    inputs: [] },
  mouseY:     { type: 'sprout_mouse_y',    inputs: [] },
  getX:       { type: 'sprout_get_x',      inputs: [] },
  getY:       { type: 'sprout_get_y',      inputs: [] },
  getHeading: { type: 'sprout_get_heading', inputs: [] },
  stamp:      { type: 'sprout_stamp',      inputs: [] },
  push:       { type: 'sprout_push',       inputs: ['LIST', 'VAL'] },
  get:        { type: 'sprout_get',        inputs: ['LIST', 'INDEX'] },
  size:       { type: 'sprout_size',       inputs: ['LIST'] },
  at:         { type: 'sprout_at',         inputs: ['LIST', 'INDEX'] },
  range:      { type: 'sprout_range',      inputs: ['START', 'END'] },
  isEmpty:    { type: 'sprout_is_empty',   inputs: ['LIST'] },
  map:        { type: 'sprout_map',        inputs: ['LIST', 'FN'] },
  filter:     { type: 'sprout_filter',     inputs: ['LIST', 'FN'] },
  reduce:     { type: 'sprout_reduce',     inputs: ['LIST', 'FN', 'INIT'] },
  first:      { type: 'sprout_first',      inputs: ['LIST'] },
  pick:       { type: 'sprout_pick',       inputs: ['LIST'] },
  last:       { type: 'sprout_last',       inputs: ['LIST'] },
  pop:        { type: 'sprout_pop',        inputs: ['LIST'] },
  concat:     { type: 'sprout_concat',     inputs: ['LIST1', 'LIST2'] },
  reverse:    { type: 'sprout_reverse',    inputs: ['LIST'] },
  indexOf:    { type: 'sprout_index_of',   inputs: ['LIST', 'ITEM'] },
  slice:      { type: 'sprout_slice',      inputs: ['LIST', 'START', 'END'] },
  sort:       { type: 'sprout_sort',       inputs: ['LIST'] },
  distance:   { type: 'sprout_distance',   inputs: ['X1', 'Y1', 'X2', 'Y2'] },
  touching:   { type: 'sprout_touching',   inputs: ['X1', 'Y1', 'X2', 'Y2', 'RADIUS'] },
};

// ---------------------------------------------------------------------------
// Sprite blocks — leading string-literal args become text fields. Computed
// names fail the gate and fall through to the generic call blocks.
// ---------------------------------------------------------------------------

type SpriteBlockSpec = { type: string; fields: string[]; inputs: string[] };

const SPRITE_STMT_BLOCKS: Record<string, SpriteBlockSpec> = {
  sprite:        { type: 'sprout_sprite',           fields: ['NAME'], inputs: ['COSTUME'] },
  moveSprite:    { type: 'sprout_move_sprite',      fields: ['NAME'], inputs: ['DIST'] },
  turnSprite:    { type: 'sprout_turn_sprite',      fields: ['NAME'], inputs: ['DEG'] },
  gotoSprite:    { type: 'sprout_goto_sprite',      fields: ['NAME'], inputs: ['X', 'Y'] },
  changeSpriteX: { type: 'sprout_change_sprite_x',  fields: ['NAME'], inputs: ['AMOUNT'] },
  changeSpriteY: { type: 'sprout_change_sprite_y',  fields: ['NAME'], inputs: ['AMOUNT'] },
  hideSprite:    { type: 'sprout_hide_sprite',      fields: ['NAME'], inputs: [] },
  showSprite:    { type: 'sprout_show_sprite',      fields: ['NAME'], inputs: [] },
  removeSprite:  { type: 'sprout_remove_sprite',    fields: ['NAME'], inputs: [] },
};

const SPRITE_EXPR_BLOCKS: Record<string, SpriteBlockSpec> = {
  spriteX:         { type: 'sprout_sprite_x',         fields: ['NAME'], inputs: [] },
  spriteY:         { type: 'sprout_sprite_y',         fields: ['NAME'], inputs: [] },
  spritesTouching: { type: 'sprout_sprites_touching', fields: ['NAME_A', 'NAME_B'], inputs: [] },
};

function trySpriteBlock(
  ws: Blockly.Workspace,
  call: CallExpr,
  table: Record<string, SpriteBlockSpec>,
): Blockly.Block | null {
  const mapped = table[call.callee];
  if (!mapped) return null;
  if (call.args.length !== mapped.fields.length + mapped.inputs.length) return null;
  const leading = call.args.slice(0, mapped.fields.length);
  if (!leading.every((a): a is StringLit => a.kind === 'StringLit')) return null;
  const block = ws.newBlock(mapped.type);
  mapped.fields.forEach((f, i) => block.setFieldValue((call.args[i] as StringLit).value, f));
  mapped.inputs.forEach((input, i) =>
    connectInput(ws, block, input, call.args[mapped.fields.length + i]));
  return block;
}

// Dropdown option sets — field-backed blocks are only used when the literal
// argument is one of the dropdown's options.
const COLOR_OPTIONS = ['red', 'blue', 'green', 'orange', 'purple', 'black', 'yellow', 'pink'];
const BACKGROUND_OPTIONS = ['white', 'black', 'red', 'blue', 'green', 'orange', 'purple', 'yellow', 'pink'];
const NOTE_OPTIONS = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
const KEY_OPTIONS = ['left', 'right', 'up', 'down', 'space', 'w', 'a', 's', 'd'];
const EVENT_OPTIONS = ['click', 'load', 'left', 'right', 'up', 'down', 'space'];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function decompileProgram(ws: Blockly.Workspace, program: Program): void {
  let prev: Blockly.Block | null = null;
  for (const stmt of program.stmts) {
    const block = decompileStmt(ws, stmt);
    if (prev !== null) {
      prev.nextConnection!.connect(block.previousConnection!);
    }
    prev = block;
  }
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

function decompileStmt(ws: Blockly.Workspace, stmt: Stmt): Blockly.Block {
  switch (stmt.kind) {
    case 'LetStmt': {
      const block = ws.newBlock('sprout_let');
      block.setFieldValue(stmt.name, 'NAME');
      connectInput(ws, block, 'INIT', stmt.init);
      return block;
    }
    case 'AssignStmt': {
      const block = ws.newBlock('sprout_set');
      block.setFieldValue(stmt.name, 'NAME');
      connectInput(ws, block, 'VALUE', stmt.value);
      return block;
    }
    case 'ReturnStmt': {
      const block = ws.newBlock('sprout_return');
      connectInput(ws, block, 'VALUE', stmt.value);
      return block;
    }
    case 'DefStmt':
      return decompileDef(ws, stmt);
    case 'ExprStmt':
      return decompileExprStmt(ws, stmt.expr);
  }
}

function decompileDef(ws: Blockly.Workspace, stmt: DefStmt): Blockly.Block {
  if (stmt.params.length > 3) {
    throw new DecompileError(`def ${stmt.name}: the def block supports at most 3 params, got ${stmt.params.length}`);
  }
  const block = ws.newBlock('sprout_def');
  block.setFieldValue(stmt.name, 'NAME');
  stmt.params.forEach((p, i) => block.setFieldValue(p, `PARAM${i}`));
  const bodyStmts: readonly Stmt[] = stmt.body.kind === 'BlockExpr'
    ? stmt.body.body
    : [{ kind: 'ExprStmt', expr: stmt.body }];
  connectBody(ws, block, 'BODY', bodyStmts);
  return block;
}

/** Statement-position expression → statement block. */
function decompileExprStmt(ws: Blockly.Workspace, expr: Expr): Blockly.Block {
  switch (expr.kind) {
    case 'RepeatExpr':
      return decompileRepeat(ws, expr);
    case 'FillExpr':
      return decompileFill(ws, expr);
    case 'OnExpr':
      return decompileOn(ws, expr);
    case 'IfExpr':
      return decompileIf(ws, expr);
    case 'WhileExpr':
      return decompileWhile(ws, expr);
    case 'ForEachExpr':
      return decompileForEach(ws, expr);
    case 'CallExpr':
      return decompileCallStmt(ws, expr);
    default:
      throw new DecompileError(`No statement block for expression kind ${expr.kind}`);
  }
}

function decompileRepeat(ws: Blockly.Workspace, expr: RepeatExpr): Blockly.Block {
  const block = ws.newBlock(expr.item === null ? 'sprout_repeat' : 'sprout_repeat_with');
  if (expr.item !== null) block.setFieldValue(expr.item, 'VAR');
  connectInput(ws, block, 'COUNT', expr.count);
  connectBody(ws, block, 'BODY', expr.body.body);
  return block;
}

function decompileFill(ws: Blockly.Workspace, expr: FillExpr): Blockly.Block {
  const block = ws.newBlock('sprout_fill');
  connectBody(ws, block, 'BODY', expr.body.body);
  return block;
}

function decompileOn(ws: Blockly.Workspace, expr: OnExpr): Blockly.Block {
  if (expr.event.name === 'timer') {
    // `on timer do` (null interval) materializes the interpreter default.
    let interval = 200;
    if (expr.interval !== null) {
      if (expr.interval.kind !== 'NumberLit') {
        throw new DecompileError('on timer: the timer block needs a literal interval');
      }
      interval = expr.interval.value;
    }
    const block = ws.newBlock('sprout_on_timer');
    block.setFieldValue(String(interval), 'INTERVAL');
    connectBody(ws, block, 'BODY', expr.body.body);
    return block;
  }
  if (!EVENT_OPTIONS.includes(expr.event.name)) {
    throw new DecompileError(`on :${expr.event.name}: not an event the on-event block offers`);
  }
  const block = ws.newBlock('sprout_on_event');
  block.setFieldValue(expr.event.name, 'EVENT');
  connectBody(ws, block, 'BODY', expr.body.body);
  return block;
}

function decompileIf(ws: Blockly.Workspace, expr: IfExpr): Blockly.Block {
  const block = ws.newBlock('sprout_if');
  connectInput(ws, block, 'COND', expr.cond);
  connectBody(ws, block, 'THEN', expr.then.body);
  if (expr.else !== null) connectBody(ws, block, 'ELSE', expr.else.body);
  return block;
}

function decompileWhile(ws: Blockly.Workspace, expr: WhileExpr): Blockly.Block {
  const block = ws.newBlock('sprout_while');
  connectInput(ws, block, 'COND', expr.cond);
  connectBody(ws, block, 'BODY', expr.body.body);
  return block;
}

function decompileForEach(ws: Blockly.Workspace, expr: ForEachExpr): Blockly.Block {
  const block = ws.newBlock('sprout_for_each');
  block.setFieldValue(expr.item, 'ITEM');
  connectInput(ws, block, 'LIST', expr.list);
  connectBody(ws, block, 'BODY', expr.body.body);
  return block;
}

function decompileCallStmt(ws: Blockly.Workspace, call: CallExpr): Blockly.Block {
  if (call.block !== null) {
    throw new DecompileError(`${call.callee}: calls with do...end blocks have no block form`);
  }

  // Field-backed statement blocks (dropdown must cover the literal).
  if (call.callee === 'color' && call.args.length === 1 && call.args[0].kind === 'SymbolLit'
      && COLOR_OPTIONS.includes(call.args[0].name)) {
    const block = ws.newBlock('sprout_color');
    block.setFieldValue(call.args[0].name, 'COLOR');
    return block;
  }
  if (call.callee === 'background' && call.args.length === 1 && call.args[0].kind === 'SymbolLit'
      && BACKGROUND_OPTIONS.includes(call.args[0].name)) {
    const block = ws.newBlock('sprout_background');
    block.setFieldValue(call.args[0].name, 'COLOR');
    return block;
  }
  if (call.callee === 'randomColor' && call.args.length === 0) {
    const block = ws.newBlock('sprout_random_color');
    block.setFieldValue('palette', 'MODE');
    return block;
  }
  if (call.callee === 'randomColor' && call.args.length === 1
      && call.args[0].kind === 'SymbolLit' && call.args[0].name === 'any') {
    const block = ws.newBlock('sprout_random_color');
    block.setFieldValue('any', 'MODE');
    return block;
  }
  if (call.callee === 'playNote' && call.args.length === 2 && call.args[0].kind === 'StringLit'
      && NOTE_OPTIONS.includes(call.args[0].value)) {
    const block = ws.newBlock('sprout_play_note');
    block.setFieldValue(call.args[0].value, 'NOTE');
    connectInput(ws, block, 'SECS', call.args[1]);
    return block;
  }

  const spriteStmtBlock = trySpriteBlock(ws, call, SPRITE_STMT_BLOCKS);
  if (spriteStmtBlock) return spriteStmtBlock;

  const mapped = STMT_CALL_BLOCKS[call.callee];
  if (mapped && mapped.inputs.length === call.args.length) {
    const block = ws.newBlock(mapped.type);
    mapped.inputs.forEach((input, i) => connectInput(ws, block, input, call.args[i]));
    return block;
  }

  return genericCall(ws, call, 'sprout_call_stmt');
}

// ---------------------------------------------------------------------------
// Expressions (value position)
// ---------------------------------------------------------------------------

function decompileExpr(ws: Blockly.Workspace, expr: Expr): Blockly.Block {
  switch (expr.kind) {
    case 'NumberLit': {
      const block = ws.newBlock('sprout_number');
      block.setFieldValue(String(expr.value), 'NUM');
      return block;
    }
    case 'StringLit': {
      const block = ws.newBlock('sprout_string');
      block.setFieldValue(expr.value, 'VALUE');
      return block;
    }
    case 'BoolLit': {
      const block = ws.newBlock('sprout_bool');
      block.setFieldValue(expr.value ? 'true' : 'false', 'VALUE');
      return block;
    }
    case 'Ident': {
      const block = ws.newBlock('sprout_ident');
      block.setFieldValue(expr.name, 'NAME');
      return block;
    }
    case 'InfixExpr':
      return decompileInfix(ws, expr);
    case 'UnaryExpr': {
      if (expr.op === 'not') {
        const block = ws.newBlock('sprout_not');
        connectInput(ws, block, 'OPERAND', expr.operand);
        return block;
      }
      // Unary minus: fold a literal into a negative number block,
      // otherwise represent as 0 - x.
      if (expr.operand.kind === 'NumberLit') {
        const block = ws.newBlock('sprout_number');
        block.setFieldValue(String(-expr.operand.value), 'NUM');
        return block;
      }
      return decompileInfix(ws, {
        kind: 'InfixExpr', op: '-',
        left: { kind: 'NumberLit', value: 0 },
        right: expr.operand,
      });
    }
    case 'CallExpr':
      return decompileCallExpr(ws, expr);
    default:
      throw new DecompileError(`No value block for expression kind ${expr.kind}`);
  }
}

const ARITH_OPS = ['+', '-', '*', '/'];
const COMPARE_OPS = ['==', '!=', '<', '>', '<=', '>='];

function decompileInfix(ws: Blockly.Workspace, expr: InfixExpr): Blockly.Block {
  let type: string;
  if (ARITH_OPS.includes(expr.op)) type = 'sprout_infix';
  else if (COMPARE_OPS.includes(expr.op)) type = 'sprout_compare';
  else if (expr.op === 'and') type = 'sprout_and';
  else if (expr.op === 'or') type = 'sprout_or';
  else throw new DecompileError(`No block for infix operator ${expr.op}`);

  const block = ws.newBlock(type);
  if (type === 'sprout_infix' || type === 'sprout_compare') {
    block.setFieldValue(expr.op, 'OP');
  }
  connectInput(ws, block, 'LEFT', expr.left);
  connectInput(ws, block, 'RIGHT', expr.right);
  return block;
}

function decompileCallExpr(ws: Blockly.Workspace, call: CallExpr): Blockly.Block {
  if (call.block !== null) {
    throw new DecompileError(`${call.callee}: calls with do...end blocks have no block form`);
  }

  if (call.callee === 'keyDown' && call.args.length === 1 && call.args[0].kind === 'SymbolLit') {
    if (KEY_OPTIONS.includes(call.args[0].name)) {
      const block = ws.newBlock('sprout_key_down');
      block.setFieldValue(call.args[0].name, 'KEY');
      return block;
    }
    // Letters outside the dropdown: keyDown treats symbol and string keys
    // equivalently, so represent as a generic call with a string argument.
    return genericCall(ws, {
      ...call,
      args: [{ kind: 'StringLit', value: call.args[0].name }],
    }, 'sprout_call_expr');
  }
  if (call.callee === 'input' && call.args.length === 1 && call.args[0].kind === 'StringLit') {
    const block = ws.newBlock('sprout_input');
    block.setFieldValue(call.args[0].value, 'NAME');
    return block;
  }
  if (call.callee === 'textInput' && call.args.length === 1 && call.args[0].kind === 'StringLit') {
    const block = ws.newBlock('sprout_text_input');
    block.setFieldValue(call.args[0].value, 'NAME');
    return block;
  }
  if (call.callee === 'list') {
    if (call.args.length > 3) {
      throw new DecompileError(`list: the list block supports at most 3 items, got ${call.args.length}`);
    }
    const block = ws.newBlock('sprout_list');
    call.args.forEach((arg, i) => connectInput(ws, block, `VALUE_${i}`, arg));
    return block;
  }

  const spriteExprBlock = trySpriteBlock(ws, call, SPRITE_EXPR_BLOCKS);
  if (spriteExprBlock) return spriteExprBlock;

  const mapped = EXPR_CALL_BLOCKS[call.callee];
  if (mapped && mapped.inputs.length === call.args.length) {
    const block = ws.newBlock(mapped.type);
    mapped.inputs.forEach((input, i) => connectInput(ws, block, input, call.args[i]));
    return block;
  }

  return genericCall(ws, call, 'sprout_call_expr');
}

function genericCall(ws: Blockly.Workspace, call: CallExpr, blockType: string): Blockly.Block {
  if (call.args.length > 2) {
    throw new DecompileError(`${call.callee}: no dedicated block and the generic call block supports at most 2 args, got ${call.args.length}`);
  }
  const block = ws.newBlock(blockType);
  block.setFieldValue(call.callee, 'CALLEE');
  call.args.forEach((arg, i) => connectInput(ws, block, `ARG${i}`, arg));
  return block;
}

// ---------------------------------------------------------------------------
// Connection helpers
// ---------------------------------------------------------------------------

function connectInput(ws: Blockly.Workspace, parent: Blockly.Block, inputName: string, expr: Expr): void {
  const child = decompileExpr(ws, expr);
  const input = parent.getInput(inputName);
  if (!input || !input.connection || !child.outputConnection) {
    throw new DecompileError(`Cannot connect ${child.type} into ${parent.type}.${inputName}`);
  }
  input.connection.connect(child.outputConnection);
}

function connectBody(ws: Blockly.Workspace, parent: Blockly.Block, inputName: string, stmts: readonly Stmt[]): void {
  let prev: Blockly.Block | null = null;
  for (const stmt of stmts) {
    const block = decompileStmt(ws, stmt);
    if (prev === null) {
      const input = parent.getInput(inputName);
      if (!input || !input.connection || !block.previousConnection) {
        throw new DecompileError(`Cannot connect ${block.type} into ${parent.type}.${inputName}`);
      }
      input.connection.connect(block.previousConnection);
    } else {
      prev.nextConnection!.connect(block.previousConnection!);
    }
    prev = block;
  }
}
