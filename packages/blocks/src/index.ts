import * as Blockly from 'blockly';
import type { Program, Stmt } from '@sprout/lang';
import { serialize } from '@sprout/lang';

// ---------------------------------------------------------------------------
// Block → AST compiler helpers
// ---------------------------------------------------------------------------

function compileBlock(block: Blockly.Block): Stmt[] {
  const stmts: Stmt[] = [];
  let current: Blockly.Block | null = block;
  while (current !== null) {
    const stmt = compileBlockToStmt(current);
    if (stmt !== null) stmts.push(stmt);
    current = current.getNextBlock();
  }
  return stmts;
}

function getFieldValue(block: Blockly.Block, name: string): string {
  return block.getFieldValue(name) ?? '';
}

function getChildBlock(block: Blockly.Block, inputName: string): Blockly.Block | null {
  const input = block.getInput(inputName);
  return input?.connection?.targetBlock() ?? null;
}

function compileExprBlock(block: Blockly.Block | null): import('@sprout/lang').Expr {
  if (block === null) {
    return { kind: 'NumberLit', value: 0 };
  }
  switch (block.type) {
    case 'sprout_number': {
      const val = parseFloat(getFieldValue(block, 'NUM'));
      return { kind: 'NumberLit', value: isNaN(val) ? 0 : val };
    }
    case 'sprout_ident': {
      return { kind: 'Ident', name: getFieldValue(block, 'NAME') };
    }
    case 'sprout_infix': {
      const op = getFieldValue(block, 'OP') as '+' | '-' | '*' | '/';
      const left = compileExprBlock(getChildBlock(block, 'LEFT'));
      const right = compileExprBlock(getChildBlock(block, 'RIGHT'));
      return { kind: 'InfixExpr', op, left, right };
    }
    case 'sprout_call_expr': {
      const callee = getFieldValue(block, 'NAME');
      const args = compileArgList(block);
      return { kind: 'CallExpr', callee, args, block: null };
    }
    default:
      return { kind: 'NumberLit', value: 0 };
  }
}

function compileArgList(block: Blockly.Block): import('@sprout/lang').Expr[] {
  const args: import('@sprout/lang').Expr[] = [];
  let i = 0;
  while (block.getInput(`ARG${i}`) !== null) {
    args.push(compileExprBlock(getChildBlock(block, `ARG${i}`)));
    i++;
  }
  return args;
}

function compileBodyBlock(block: Blockly.Block, inputName: string): import('@sprout/lang').BlockExpr {
  const firstChild = getChildBlock(block, inputName);
  const stmts = firstChild !== null ? compileBlock(firstChild) : [];
  return { kind: 'BlockExpr', body: stmts };
}

function compileBlockToStmt(block: Blockly.Block): Stmt | null {
  switch (block.type) {
    case 'sprout_forward': {
      const dist = compileExprBlock(getChildBlock(block, 'DIST'));
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee: 'forward', args: [dist], block: null } };
    }
    case 'sprout_turn': {
      const angle = compileExprBlock(getChildBlock(block, 'ANGLE'));
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee: 'turn', args: [angle], block: null } };
    }
    case 'sprout_pen_up':
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee: 'pen_up', args: [], block: null } };
    case 'sprout_pen_down':
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee: 'pen_down', args: [], block: null } };
    case 'sprout_repeat': {
      const count = compileExprBlock(getChildBlock(block, 'COUNT'));
      const body = compileBodyBlock(block, 'DO');
      return { kind: 'ExprStmt', expr: { kind: 'RepeatExpr', count, body } };
    }
    case 'sprout_def': {
      const name = getFieldValue(block, 'NAME');
      const body = compileBodyBlock(block, 'BODY');
      return { kind: 'DefStmt', name, params: [], body };
    }
    case 'sprout_call_stmt': {
      const callee = getFieldValue(block, 'NAME');
      const args = compileArgList(block);
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee, args, block: null } };
    }
    case 'sprout_beside': {
      const left = compileExprBlock(getChildBlock(block, 'LEFT'));
      const right = compileExprBlock(getChildBlock(block, 'RIGHT'));
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee: 'beside', args: [left, right], block: null } };
    }
    case 'sprout_above': {
      const top = compileExprBlock(getChildBlock(block, 'TOP'));
      const bottom = compileExprBlock(getChildBlock(block, 'BOTTOM'));
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee: 'above', args: [top, bottom], block: null } };
    }
    case 'sprout_scale': {
      const factor = compileExprBlock(getChildBlock(block, 'FACTOR'));
      const drawing = compileExprBlock(getChildBlock(block, 'DRAWING'));
      return { kind: 'ExprStmt', expr: { kind: 'CallExpr', callee: 'scale', args: [factor, drawing], block: null } };
    }
    case 'sprout_on_event': {
      const eventName = getFieldValue(block, 'EVENT');
      const body = compileBodyBlock(block, 'DO');
      return {
        kind: 'ExprStmt',
        expr: {
          kind: 'OnExpr',
          event: { kind: 'SymbolLit', name: eventName },
          body,
        },
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Block registration
// ---------------------------------------------------------------------------

export function registerAllBlocks(): void {
  // Statement blocks
  Blockly.Blocks['sprout_forward'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DIST').setCheck('Number').appendField('forward');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_turn'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('ANGLE').setCheck('Number').appendField('turn');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_pen_up'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('pen up');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_pen_down'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('pen down');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_repeat'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COUNT').setCheck('Number').appendField('repeat');
      this.appendStatementInput('DO').appendField('do');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
    },
  };
  Blockly.Blocks['sprout_def'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('def').appendField(new Blockly.FieldTextInput('myFunc'), 'NAME');
      this.appendStatementInput('BODY');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(290);
    },
  };
  Blockly.Blocks['sprout_call_stmt'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('call').appendField(new Blockly.FieldTextInput('myFunc'), 'NAME');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(290);
    },
  };
  Blockly.Blocks['sprout_beside'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').appendField('beside');
      this.appendValueInput('RIGHT');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(200);
    },
  };
  Blockly.Blocks['sprout_above'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TOP').appendField('above');
      this.appendValueInput('BOTTOM');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(200);
    },
  };
  Blockly.Blocks['sprout_scale'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('FACTOR').setCheck('Number').appendField('scale');
      this.appendValueInput('DRAWING');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(200);
    },
  };
  Blockly.Blocks['sprout_on_event'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('on')
        .appendField(new Blockly.FieldTextInput('click'), 'EVENT');
      this.appendStatementInput('DO').appendField('do');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(65);
    },
  };

  // Value (expression) blocks
  Blockly.Blocks['sprout_number'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(0), 'NUM');
      this.setOutput(true, 'Number');
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_ident'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('x'), 'NAME');
      this.setOutput(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_infix'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck('Number');
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([['+', '+'], ['-', '-'], ['×', '*'], ['÷', '/']]) as unknown as Blockly.Field,
        'OP',
      );
      this.appendValueInput('RIGHT').setCheck('Number');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_call_expr'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('myFunc'), 'NAME');
      this.setOutput(true);
      this.setColour(290);
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function compileWorkspace(ws: Blockly.Workspace): Program {
  const topBlocks = ws.getTopBlocks(true);
  const stmts: Stmt[] = [];
  for (const block of topBlocks) {
    const blockStmts = compileBlock(block);
    stmts.push(...blockStmts);
  }
  return { kind: 'Program', stmts };
}

export function generateText(ws: Blockly.Workspace): string {
  const program = compileWorkspace(ws);
  return serialize(program);
}
