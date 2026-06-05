import * as Blockly from 'blockly/node';
import type {
  Program, Stmt, Expr,
  DefStmt, ExprStmt,
  LetStmt, AssignStmt, ReturnStmt,
  NumberLit, Ident, InfixExpr, UnaryExpr, CallExpr,
  BlockExpr, RepeatExpr, OnExpr, IfExpr, WhileExpr, ForEachExpr, SymbolLit, BoolLit, StringLit,
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
    case 'sprout_random_color':
    case 'sprout_background':
    case 'sprout_clear_canvas':
    case 'sprout_pen_width':
    case 'sprout_puts':
    case 'sprout_repeat':
    case 'sprout_on_event':
    case 'sprout_call_stmt':
    case 'sprout_beside':
    case 'sprout_above':
    case 'sprout_scale':
    case 'sprout_if':
    case 'sprout_while':
    case 'sprout_for_each':
    case 'sprout_circle':
    case 'sprout_rect':
    case 'sprout_ellipse':
    case 'sprout_triangle':
    case 'sprout_polygon':
    case 'sprout_text':
    case 'sprout_arc':
      return { kind: 'ExprStmt', expr: compileExprBlock(block) };
    case 'sprout_let':
      return compileLet(block);
    case 'sprout_set':
      return compileSet(block);
    case 'sprout_return':
      return compileReturn(block);
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

function compileLet(block: Blockly.Block): LetStmt {
  const name = block.getFieldValue('NAME') as string;
  const init = compileExpr(mustGetInput(block, 'INIT'));
  return { kind: 'LetStmt', name, init };
}

function compileSet(block: Blockly.Block): AssignStmt {
  const name = block.getFieldValue('NAME') as string;
  const value = compileExpr(mustGetInput(block, 'VALUE'));
  return { kind: 'AssignStmt', name, value };
}

function compileReturn(block: Blockly.Block): ReturnStmt {
  const value = compileExpr(mustGetInput(block, 'VALUE'));
  return { kind: 'ReturnStmt', value };
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
    case 'sprout_random_color': {
      const mode = block.getFieldValue('MODE') as string;
      const args = mode === 'any'
        ? [{ kind: 'SymbolLit' as const, name: 'any' }]
        : [];
      return { kind: 'CallExpr', callee: 'randomColor', args, block: null };
    }
    case 'sprout_background': {
      const color = block.getFieldValue('COLOR') as string;
      return { kind: 'CallExpr', callee: 'background', args: [{ kind: 'SymbolLit', name: color }], block: null };
    }
    case 'sprout_clear_canvas':
      return { kind: 'CallExpr', callee: 'clearCanvas', args: [], block: null };
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
    case 'sprout_while': {
      const cond = compileExpr(mustGetInput(block, 'COND'));
      const firstBodyBlock = block.getInputTargetBlock('BODY');
      const body = compileBlockExpr(firstBodyBlock);
      const whileExpr: WhileExpr = { kind: 'WhileExpr', cond, body };
      return whileExpr;
    }
    case 'sprout_circle': {
      const r = compileExpr(mustGetInput(block, 'R'));
      return { kind: 'CallExpr', callee: 'circle', args: [r], block: null };
    }
    case 'sprout_rect': {
      const w = compileExpr(mustGetInput(block, 'W'));
      const h = compileExpr(mustGetInput(block, 'H'));
      return { kind: 'CallExpr', callee: 'rect', args: [w, h], block: null };
    }
    case 'sprout_ellipse': {
      const rx = compileExpr(mustGetInput(block, 'RX'));
      const ry = compileExpr(mustGetInput(block, 'RY'));
      return { kind: 'CallExpr', callee: 'ellipse', args: [rx, ry], block: null };
    }
    case 'sprout_triangle': {
      const size = compileExpr(mustGetInput(block, 'SIZE'));
      return { kind: 'CallExpr', callee: 'triangle', args: [size], block: null };
    }
    case 'sprout_polygon': {
      const n = compileExpr(mustGetInput(block, 'N'));
      const size = compileExpr(mustGetInput(block, 'SIZE'));
      return { kind: 'CallExpr', callee: 'polygon', args: [n, size], block: null };
    }
    case 'sprout_text': {
      const str = compileExpr(mustGetInput(block, 'STR'));
      const size = compileExpr(mustGetInput(block, 'SIZE'));
      return { kind: 'CallExpr', callee: 'text', args: [str, size], block: null };
    }
    case 'sprout_arc': {
      const radius = compileExpr(mustGetInput(block, 'RADIUS'));
      const angle = compileExpr(mustGetInput(block, 'ANGLE'));
      return { kind: 'CallExpr', callee: 'arc', args: [radius, angle], block: null };
    }
    case 'sprout_for_each':
      return compileForEachExpr(block);
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

function compileForEachExpr(block: Blockly.Block): ForEachExpr {
  const item = block.getFieldValue('ITEM') as string;
  const listBlock = block.getInputTargetBlock('LIST');
  const list = listBlock
    ? compileExpr(listBlock)
    : { kind: 'CallExpr' as const, callee: 'list', args: [], block: null };
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileBlockExpr(firstBodyBlock);
  return { kind: 'ForEachExpr', item, list, body };
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
    case 'sprout_sin': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'sin', args: [x], block: null };
    }
    case 'sprout_cos': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'cos', args: [x], block: null };
    }
    case 'sprout_tan': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'tan', args: [x], block: null };
    }
    case 'sprout_abs': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'abs', args: [x], block: null };
    }
    case 'sprout_sqrt': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'sqrt', args: [x], block: null };
    }
    case 'sprout_log': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'log', args: [x], block: null };
    }
    case 'sprout_floor': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'floor', args: [x], block: null };
    }
    case 'sprout_ceil': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'ceil', args: [x], block: null };
    }
    case 'sprout_round': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'round', args: [x], block: null };
    }
    case 'sprout_random': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'random', args: [x], block: null };
    }
    case 'sprout_pow': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'pow', args: [a, b], block: null };
    }
    case 'sprout_mod': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'mod', args: [a, b], block: null };
    }
    case 'sprout_max': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'max', args: [a, b], block: null };
    }
    case 'sprout_min': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'min', args: [a, b], block: null };
    }
    case 'sprout_pi':
      return { kind: 'CallExpr', callee: 'pi', args: [], block: null };
    case 'sprout_string': {
      const value = block.getFieldValue('VALUE') as string;
      const lit: StringLit = { kind: 'StringLit', value };
      return lit;
    }
    case 'sprout_join': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'join', args: [a, b], block: null };
    }
    case 'sprout_length': {
      const str = compileExpr(mustGetInput(block, 'STR'));
      return { kind: 'CallExpr', callee: 'length', args: [str], block: null };
    }
    case 'sprout_input': {
      const name = block.getFieldValue('NAME') as string;
      return {
        kind: 'CallExpr',
        callee: 'input',
        args: [{ kind: 'StringLit', value: name }],
        block: null,
      };
    }
    case 'sprout_list': {
      const items: Expr[] = [];
      for (const key of ['VALUE_0', 'VALUE_1', 'VALUE_2']) {
        const b = block.getInputTargetBlock(key);
        if (b !== null) items.push(compileExpr(b));
      }
      return { kind: 'CallExpr', callee: 'list', args: items, block: null };
    }
    case 'sprout_push': {
      const lst = compileExpr(mustGetInput(block, 'LIST'));
      const val = compileExpr(mustGetInput(block, 'VAL'));
      return { kind: 'CallExpr', callee: 'push', args: [lst, val], block: null };
    }
    case 'sprout_get': {
      const lst = compileExpr(mustGetInput(block, 'LIST'));
      const idx = compileExpr(mustGetInput(block, 'INDEX'));
      return { kind: 'CallExpr', callee: 'get', args: [lst, idx], block: null };
    }
    case 'sprout_size': {
      const lst = compileExpr(mustGetInput(block, 'LIST'));
      return { kind: 'CallExpr', callee: 'size', args: [lst], block: null };
    }
    case 'sprout_is_empty': {
      const lst = compileExpr(mustGetInput(block, 'LIST'));
      return { kind: 'CallExpr', callee: 'isEmpty', args: [lst], block: null };
    }
    case 'sprout_stamp':
      return { kind: 'CallExpr', callee: 'stamp', args: [], block: null };
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
