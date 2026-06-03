import * as Blockly from 'blockly/node';
import type {
  Program, Stmt, Expr,
  DefStmt, ExprStmt,
  NumberLit, Ident, InfixExpr, UnaryExpr, CallExpr,
  BlockExpr, RepeatExpr, OnExpr, IfExpr, SymbolLit, BoolLit,
} from '@sprout/lang';

export function compileWorkspace(ws: Blockly.Workspace): Program {
  const stmts: Stmt[] = [];
  for (const top of ws.getTopBlocks(true)) {
    let current: Blockly.Block | null = top;
    while (current) {
      stmts.push(compileStmt(current));
      current = current.getNextBlock();
    }
  }
  return { kind: 'Program', stmts };
}

function compileStmt(block: Blockly.Block): Stmt {
  switch (block.type) {
    case 'sprout_def':
      return compileDef(block);
    case 'sprout_forward':
    case 'sprout_turn':
    case 'sprout_pen_up':
    case 'sprout_pen_down':
    case 'sprout_color':
    case 'sprout_pen_width':
    case 'sprout_puts':
    case 'sprout_repeat':
    case 'sprout_on_event':
    case 'sprout_call_stmt':
    case 'sprout_beside':
    case 'sprout_above':
    case 'sprout_scale':
    case 'sprout_if':
      return { kind: 'ExprStmt', expr: compileExprBlock(block) };
    default:
      throw new Error(`Unknown statement block type: ${block.type}`);
  }
}

function compileDef(block: Blockly.Block): DefStmt {
  const name = block.getFieldValue('NAME') as string;
  const rawParams = [
    block.getFieldValue('PARAM0') as string,
    block.getFieldValue('PARAM1') as string,
    block.getFieldValue('PARAM2') as string,
  ].filter(p => p.trim() !== '');
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileDefBody(firstBodyBlock);
  return { kind: 'DefStmt', name, params: rawParams, body };
}

/**
 * A def body is compiled as:
 * - A single sprout_repeat block (no next) → RepeatExpr directly
 *   (matches the Phase 1 fixture structure where def body = RepeatExpr)
 * - Otherwise → BlockExpr wrapping all statements
 */
function compileDefBody(firstBlock: Blockly.Block | null): Expr {
  if (!firstBlock) {
    return { kind: 'BlockExpr', body: [] };
  }
  if (firstBlock.type === 'sprout_repeat' && firstBlock.getNextBlock() === null) {
    return compileRepeatExpr(firstBlock);
  }
  return compileBlockExpr(firstBlock);
}

function compileBlockExpr(firstBlock: Blockly.Block | null): BlockExpr {
  const stmts: Stmt[] = [];
  let cur: Blockly.Block | null = firstBlock;
  while (cur) {
    stmts.push(compileStmt(cur));
    cur = cur.getNextBlock();
  }
  return { kind: 'BlockExpr', body: stmts };
}

function compileExprBlock(block: Blockly.Block): Expr {
  switch (block.type) {
    case 'sprout_forward': {
      const dist = compileExpr(mustGetInput(block, 'DISTANCE'));
      return { kind: 'CallExpr', callee: 'forward', args: [dist], block: null };
    }
    case 'sprout_turn': {
      const deg = compileExpr(mustGetInput(block, 'DEGREES'));
      return { kind: 'CallExpr', callee: 'turn', args: [deg], block: null };
    }
    case 'sprout_pen_up':
      return { kind: 'CallExpr', callee: 'penUp', args: [], block: null };
    case 'sprout_pen_down':
      return { kind: 'CallExpr', callee: 'penDown', args: [], block: null };
    case 'sprout_color': {
      const colorName = block.getFieldValue('COLOR') as string;
      return {
        kind: 'CallExpr',
        callee: 'color',
        args: [{ kind: 'SymbolLit', name: colorName }],
        block: null,
      };
    }
    case 'sprout_pen_width': {
      const width = compileExpr(mustGetInput(block, 'WIDTH'));
      return { kind: 'CallExpr', callee: 'penWidth', args: [width], block: null };
    }
    case 'sprout_puts': {
      const val = compileExpr(mustGetInput(block, 'VALUE'));
      return { kind: 'CallExpr', callee: 'puts', args: [val], block: null };
    }
    case 'sprout_repeat':
      return compileRepeatExpr(block);
    case 'sprout_on_event':
      return compileOnExpr(block);
    case 'sprout_call_stmt':
      return compileCallBlock(block);
    case 'sprout_beside': {
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      return { kind: 'CallExpr', callee: 'beside', args: [left, right], block: null };
    }
    case 'sprout_above': {
      const top = compileExpr(mustGetInput(block, 'TOP'));
      const bottom = compileExpr(mustGetInput(block, 'BOTTOM'));
      return { kind: 'CallExpr', callee: 'above', args: [top, bottom], block: null };
    }
    case 'sprout_scale': {
      const factor = compileExpr(mustGetInput(block, 'FACTOR'));
      const drawing = compileExpr(mustGetInput(block, 'DRAWING'));
      return { kind: 'CallExpr', callee: 'scale', args: [factor, drawing], block: null };
    }
    case 'sprout_if': {
      const cond = compileExpr(mustGetInput(block, 'COND'));
      const thenFirst = block.getInputTargetBlock('THEN');
      const thenBlock = compileBlockExpr(thenFirst);
      const elseFirst = block.getInputTargetBlock('ELSE');
      const elseBlock: BlockExpr | null = elseFirst ? compileBlockExpr(elseFirst) : null;
      const ifExpr: IfExpr = { kind: 'IfExpr', cond, then: thenBlock, else: elseBlock };
      return ifExpr;
    }
    default:
      throw new Error(`Block type cannot be compiled as expression: ${block.type}`);
  }
}

function compileRepeatExpr(block: Blockly.Block): RepeatExpr {
  const count = compileExpr(mustGetInput(block, 'COUNT'));
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileBlockExpr(firstBodyBlock);
  return { kind: 'RepeatExpr', count, body };
}

function compileOnExpr(block: Blockly.Block): OnExpr {
  const eventName = block.getFieldValue('EVENT') as string;
  const event: SymbolLit = { kind: 'SymbolLit', name: eventName };
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileBlockExpr(firstBodyBlock);
  return { kind: 'OnExpr', event, body };
}

function compileCallBlock(block: Blockly.Block): CallExpr {
  const callee = block.getFieldValue('CALLEE') as string;
  const args: Expr[] = [];
  const arg0 = block.getInputTargetBlock('ARG0');
  if (arg0) args.push(compileExpr(arg0));
  const arg1 = block.getInputTargetBlock('ARG1');
  if (arg1) args.push(compileExpr(arg1));
  return { kind: 'CallExpr', callee, args, block: null };
}

function compileExpr(block: Blockly.Block): Expr {
  switch (block.type) {
    case 'sprout_number': {
      const value = Number(block.getFieldValue('NUM'));
      const lit: NumberLit = { kind: 'NumberLit', value };
      return lit;
    }
    case 'sprout_ident': {
      const name = block.getFieldValue('NAME') as string;
      const id: Ident = { kind: 'Ident', name };
      return id;
    }
    case 'sprout_infix': {
      const op = block.getFieldValue('OP') as '+' | '-' | '*' | '/';
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      const infix: InfixExpr = { kind: 'InfixExpr', op, left, right };
      return infix;
    }
    case 'sprout_call_expr':
      return compileCallBlock(block);
    case 'sprout_bool': {
      const raw = block.getFieldValue('VALUE') as string;
      const lit: BoolLit = { kind: 'BoolLit', value: raw === 'true' };
      return lit;
    }
    case 'sprout_compare': {
      const op = block.getFieldValue('OP') as InfixExpr['op'];
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      const infix: InfixExpr = { kind: 'InfixExpr', op, left, right };
      return infix;
    }
    case 'sprout_not': {
      const operand = compileExpr(mustGetInput(block, 'OPERAND'));
      const unary: UnaryExpr = { kind: 'UnaryExpr', op: 'not', operand };
      return unary;
    }
    case 'sprout_and': {
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      const infix: InfixExpr = { kind: 'InfixExpr', op: 'and', left, right };
      return infix;
    }
    case 'sprout_or': {
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      const infix: InfixExpr = { kind: 'InfixExpr', op: 'or', left, right };
      return infix;
    }
    default:
      throw new Error(`Unknown value block type: ${block.type}`);
  }
}

function mustGetInput(block: Blockly.Block, inputName: string): Blockly.Block {
  const connected = block.getInputTargetBlock(inputName);
  if (!connected) {
    throw new Error(`Block ${block.type} missing required input "${inputName}"`);
  }
  return connected;
}
