// Blockly workspace → Sprout AST compiler.
// Companion: generator.ts produces display text by serializing the compiled AST.

import * as Blockly from 'blockly';
import type {
  Program,
  Stmt,
  Expr,
  DefStmt,
  ExprStmt,
  BlockExpr,
  CallExpr,
  RepeatExpr,
  OnExpr,
  InfixExpr,
  NumberLit,
  Ident,
} from '@sprout/lang';
import { serialize } from '@sprout/lang';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Compile a Blockly workspace to a Sprout Program AST. */
export function compileWorkspace(workspace: Blockly.Workspace): Program {
  const topBlocks = workspace.getTopBlocks(true);
  const stmts: Stmt[] = topBlocks.flatMap(compileStmtChain);
  return { kind: 'Program', stmts };
}

/** Compile a Blockly workspace to Sprout display text. */
export function generate(workspace: Blockly.Workspace): string {
  return serialize(compileWorkspace(workspace));
}

// ---------------------------------------------------------------------------
// Statement compilation
// ---------------------------------------------------------------------------

function compileStmtChain(head: Blockly.Block): Stmt[] {
  const stmts: Stmt[] = [];
  let current: Blockly.Block | null = head;
  while (current !== null) {
    stmts.push(compileStmt(current));
    current = current.getNextBlock();
  }
  return stmts;
}

function compileStmt(block: Blockly.Block): Stmt {
  switch (block.type) {
    case 'sprout_def':
      return compileDef(block);

    case 'sprout_expr_stmt': {
      const exprBlock = block.getInputTargetBlock('EXPR');
      if (!exprBlock) throw new CompileError(block, 'sprout_expr_stmt: EXPR input is empty');
      return mkExprStmt(compileExpr(exprBlock));
    }

    case 'sprout_call_stmt':
      return mkExprStmt(compileCall(block));

    // Drawing primitive statement blocks → ExprStmt wrapping their expression
    case 'sprout_forward':
    case 'sprout_turn':
    case 'sprout_pen_up':
    case 'sprout_pen_down':
    case 'sprout_repeat':
    case 'sprout_on':
      return mkExprStmt(compileExpr(block));

    default:
      throw new CompileError(block, `Unknown statement block type: ${block.type}`);
  }
}

// ---------------------------------------------------------------------------
// Expression compilation
// ---------------------------------------------------------------------------

function compileExpr(block: Blockly.Block): Expr {
  switch (block.type) {
    case 'sprout_number':
      return compileNumber(block);

    case 'sprout_ident':
      return compileIdent(block);

    case 'sprout_infix':
      return compileInfix(block);

    case 'sprout_forward': {
      const dist = requireValueInput(block, 'DISTANCE');
      return mkCall('forward', [compileExpr(dist)]);
    }

    case 'sprout_turn': {
      const deg = requireValueInput(block, 'DEGREES');
      return mkCall('turn', [compileExpr(deg)]);
    }

    case 'sprout_pen_up':
      return mkCall('penUp', []);

    case 'sprout_pen_down':
      return mkCall('penDown', []);

    case 'sprout_repeat':
      return compileRepeat(block);

    case 'sprout_on':
      return compileOn(block);

    case 'sprout_beside': {
      const left = requireValueInput(block, 'LEFT');
      const right = requireValueInput(block, 'RIGHT');
      return mkCall('beside', [compileExpr(left), compileExpr(right)]);
    }

    case 'sprout_above': {
      const top = requireValueInput(block, 'TOP');
      const bottom = requireValueInput(block, 'BOTTOM');
      return mkCall('above', [compileExpr(top), compileExpr(bottom)]);
    }

    case 'sprout_scale': {
      const factor = requireValueInput(block, 'FACTOR');
      const drawing = requireValueInput(block, 'DRAWING');
      return mkCall('scale', [compileExpr(factor), compileExpr(drawing)]);
    }

    case 'sprout_call_value':
    case 'sprout_call_stmt':
      return compileCall(block);

    default:
      throw new CompileError(block, `Unknown expression block type: ${block.type}`);
  }
}

// ---------------------------------------------------------------------------
// Individual block compilers
// ---------------------------------------------------------------------------

function compileNumber(block: Blockly.Block): NumberLit {
  const raw = block.getFieldValue('VALUE');
  const value = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return { kind: 'NumberLit', value };
}

function compileIdent(block: Blockly.Block): Ident {
  return { kind: 'Ident', name: block.getFieldValue('NAME') as string };
}

function compileInfix(block: Blockly.Block): InfixExpr {
  const left = requireValueInput(block, 'LEFT');
  const right = requireValueInput(block, 'RIGHT');
  const op = block.getFieldValue('OP') as '+' | '-' | '*' | '/';
  return { kind: 'InfixExpr', op, left: compileExpr(left), right: compileExpr(right) };
}

function compileCall(block: Blockly.Block): CallExpr {
  const callee = block.getFieldValue('CALLEE') as string;
  const args: Expr[] = [];
  for (const name of ['ARG0', 'ARG1', 'ARG2']) {
    const argBlock = block.getInputTargetBlock(name);
    if (argBlock) args.push(compileExpr(argBlock));
  }
  return { kind: 'CallExpr', callee, args, block: null };
}

function compileRepeat(block: Blockly.Block): RepeatExpr {
  const countBlock = requireValueInput(block, 'COUNT');
  const count = compileExpr(countBlock);
  const body = compileBlockExpr(block.getInputTargetBlock('DO'));
  return { kind: 'RepeatExpr', count, body };
}

function compileOn(block: Blockly.Block): OnExpr {
  const eventName = block.getFieldValue('EVENT') as string;
  const body = compileBlockExpr(block.getInputTargetBlock('DO'));
  return {
    kind: 'OnExpr',
    event: { kind: 'SymbolLit', name: eventName },
    body,
  };
}

function compileDef(block: Blockly.Block): DefStmt {
  const name = block.getFieldValue('NAME') as string;
  const paramsRaw = block.getFieldValue('PARAMS') as string;
  const params = paramsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const firstBodyBlock = block.getInputTargetBlock('DO');
  const body = compileDefBody(firstBodyBlock);

  return { kind: 'DefStmt', name, params, body };
}

// ---------------------------------------------------------------------------
// Block-body helpers
// ---------------------------------------------------------------------------

/**
 * Compile a `def` body. When there is exactly one block with no chain, it
 * compiles directly to the block's expression (matching the hand-built fixture
 * AST: `DefStmt.body = RepeatExpr`, not `BlockExpr { body: [ExprStmt(RepeatExpr)] }`).
 * Multiple blocks produce a `BlockExpr`.
 */
function compileDefBody(firstBlock: Blockly.Block | null): Expr {
  if (!firstBlock) return { kind: 'BlockExpr', body: [] };
  if (!firstBlock.getNextBlock()) return compileExpr(firstBlock);
  return { kind: 'BlockExpr', body: compileStmtChain(firstBlock) };
}

/** Compile a statement-input chain to a `BlockExpr` (for repeat / on bodies). */
function compileBlockExpr(firstBlock: Blockly.Block | null): BlockExpr {
  return {
    kind: 'BlockExpr',
    body: firstBlock ? compileStmtChain(firstBlock) : [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkExprStmt(expr: Expr): ExprStmt {
  return { kind: 'ExprStmt', expr };
}

function mkCall(callee: string, args: readonly Expr[]): CallExpr {
  return { kind: 'CallExpr', callee, args, block: null };
}

function requireValueInput(block: Blockly.Block, name: string): Blockly.Block {
  const child = block.getInputTargetBlock(name);
  if (!child) throw new CompileError(block, `${block.type}: required value input "${name}" is empty`);
  return child;
}

export class CompileError extends Error {
  constructor(public readonly block: Blockly.Block, message: string) {
    super(message);
    this.name = 'CompileError';
  }
}
