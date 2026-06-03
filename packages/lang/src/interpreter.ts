// Tree-walking interpreter for the Sprout visual programming language.
// Programs are pure and immutable — evaluation produces a Drawing value,
// never mutates state.

import type {
  Program,
  Stmt,
  Expr,
  DefStmt,
  ExprStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
  InfixExpr,
  CallExpr,
  BlockExpr,
  RepeatExpr,
  OnExpr,
} from './ast.js';

import {
  type SproutValue,
  type SproutNumber,
  type SproutFunction,
  type Drawing,
  type Env,
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';

// ---------------------------------------------------------------------------
// Runtime error
// ---------------------------------------------------------------------------

export class SproutRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SproutRuntimeError';
  }
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isDrawing(v: SproutValue): v is Drawing {
  // Must stay in sync with the Drawing union in values.ts
  switch (v.kind) {
    case 'forward': case 'turn': case 'penUp': case 'penDown':
    case 'sequence': case 'beside': case 'above': case 'scale': case 'color': case 'empty':
      return true;
    default:
      return false;
  }
}

function assertNumber(v: SproutValue, context: string): SproutNumber {
  if (v.kind !== 'number') {
    throw new SproutRuntimeError(
      `${context}: expected number, got ${v.kind}`
    );
  }
  return v;
}

function assertDrawing(v: SproutValue, context: string): Drawing {
  if (!isDrawing(v)) {
    throw new SproutRuntimeError(
      `${context}: expected drawing, got ${v.kind}`
    );
  }
  return v;
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function envExtend(base: Env, bindings: Iterable<[string, SproutValue]>): Env {
  return new Map<string, SproutValue>([...base, ...bindings]);
}

// ---------------------------------------------------------------------------
// Built-in function table
// ---------------------------------------------------------------------------

type BuiltinFn = (args: SproutValue[]) => SproutValue;

const COLOR_MAP: Readonly<Record<string, string>> = {
  red:    '#dc2626',
  blue:   '#2563eb',
  green:  '#16a34a',
  orange: '#ea580c',
  purple: '#9333ea',
  black:  '#000000',
  white:  '#ffffff',
  yellow: '#ca8a04',
  pink:   '#db2777',
};

const BUILTINS: ReadonlyMap<string, BuiltinFn> = new Map<string, BuiltinFn>([
  ['forward', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`forward expects 1 argument, got ${args.length}`);
    const d = assertNumber(args[0], 'forward');
    return mkForward(d.value);
  }],
  ['turn', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`turn expects 1 argument, got ${args.length}`);
    const deg = assertNumber(args[0], 'turn');
    return mkTurn(deg.value);
  }],
  ['penUp', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`penUp expects 0 arguments, got ${args.length}`);
    return PEN_UP;
  }],
  ['penDown', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`penDown expects 0 arguments, got ${args.length}`);
    return PEN_DOWN;
  }],
  ['beside', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`beside expects 2 arguments, got ${args.length}`);
    const left = assertDrawing(args[0], 'beside (left)');
    const right = assertDrawing(args[1], 'beside (right)');
    return mkBeside(left, right);
  }],
  ['above', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`above expects 2 arguments, got ${args.length}`);
    const top = assertDrawing(args[0], 'above (top)');
    const bottom = assertDrawing(args[1], 'above (bottom)');
    return mkAbove(top, bottom);
  }],
  ['scale', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`scale expects 2 arguments, got ${args.length}`);
    const factor = assertNumber(args[0], 'scale (factor)');
    const drawing = assertDrawing(args[1], 'scale (drawing)');
    return mkScale(factor.value, drawing);
  }],
  ['color', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`color expects 1 argument, got ${args.length}`);
    const sym = args[0];
    if (sym.kind !== 'symbol') {
      throw new SproutRuntimeError(`color expects a symbol like :red, got ${sym.kind}`);
    }
    const hex = COLOR_MAP[sym.name];
    if (hex === undefined) {
      throw new SproutRuntimeError(
        `Unknown color: :${sym.name}. Available: ${Object.keys(COLOR_MAP).map(k => ':' + k).join(', ')}`
      );
    }
    return mkColor(hex);
  }],
  ['puts', (args) => {
    // Side-effect for kids: print to console (best-effort) and return EMPTY.
    if (args.length >= 1) {
      const v = args[0];
      // Produce a human-readable string without throwing.
      let display: string;
      if (v.kind === 'number' || v.kind === 'bool') {
        display = String(v.value);
      } else if (v.kind === 'string') {
        display = v.value;
      } else if (v.kind === 'symbol') {
        display = ':' + v.name;
      } else {
        display = `[${v.kind}]`;
      }
      console.log(display);
    }
    return EMPTY;
  }],
]);

// ---------------------------------------------------------------------------
// Core evaluator
// ---------------------------------------------------------------------------

function evalExpr(expr: Expr, env: Env): SproutValue {
  switch (expr.kind) {
    // --- Literals ---
    case 'NumberLit':
      return { kind: 'number', value: expr.value } satisfies SproutNumber;

    case 'StringLit':
      return { kind: 'string', value: expr.value };

    case 'SymbolLit':
      return { kind: 'symbol', name: expr.name };

    case 'BoolLit':
      return { kind: 'bool', value: expr.value };

    // --- Identifier ---
    case 'Ident': {
      const val = env.get(expr.name);
      if (val === undefined) {
        throw new SproutRuntimeError(`Unbound identifier: '${expr.name}'`);
      }
      return val;
    }

    // --- Infix arithmetic ---
    case 'InfixExpr': {
      return evalInfix(expr, env);
    }

    // --- Block ---
    case 'BlockExpr': {
      return evalBlock(expr, env);
    }

    // --- Repeat ---
    case 'RepeatExpr': {
      return evalRepeat(expr, env);
    }

    // --- Call ---
    case 'CallExpr': {
      return evalCall(expr, env);
    }

    // --- On (event handler) ---
    case 'OnExpr': {
      return evalOn(expr, env);
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = expr;
      throw new SproutRuntimeError(`Unknown expression kind: ${(_exhaustive as Expr).kind}`);
    }
  }
}

function evalInfix(expr: InfixExpr, env: Env): SproutValue {
  const left = assertNumber(evalExpr(expr.left, env), `(${expr.op}) left operand`);
  const right = assertNumber(evalExpr(expr.right, env), `(${expr.op}) right operand`);
  switch (expr.op) {
    case '+': return { kind: 'number', value: left.value + right.value };
    case '-': return { kind: 'number', value: left.value - right.value };
    case '*': return { kind: 'number', value: left.value * right.value };
    case '/':
      if (right.value === 0) throw new SproutRuntimeError('Division by zero');
      return { kind: 'number', value: left.value / right.value };
  }
}

/** Evaluate a BlockExpr: collect Drawing results, discard non-Drawing values. */
function evalBlock(block: BlockExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  for (const stmt of block.body) {
    const val = evalStmt(stmt, env);
    // null means no visual contribution (DefStmt/OnExpr).
    // Non-null, non-Drawing values (numbers, strings, etc.) are also discarded.
    if (val !== null && isDrawing(val)) {
      drawings.push(val);
    }
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}

function evalRepeat(expr: RepeatExpr, env: Env): Drawing {
  const countVal = assertNumber(evalExpr(expr.count, env), 'repeat count');
  const count = Math.trunc(countVal.value);
  const drawings: Drawing[] = [];
  for (let i = 0; i < count; i++) {
    const d = evalBlock(expr.body, env);
    drawings.push(d);
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}

function evalCall(expr: CallExpr, env: Env): SproutValue {
  if (expr.block !== null) {
    throw new SproutRuntimeError(`${expr.callee}: trailing do...end blocks are not supported in Phase 1`);
  }

  // Check built-ins first.
  const builtin = BUILTINS.get(expr.callee);
  if (builtin !== undefined) {
    const args = expr.args.map(a => evalExpr(a, env));
    return builtin(args);
  }

  // Look up user-defined function.
  const fnVal = env.get(expr.callee);
  if (fnVal === undefined) {
    throw new SproutRuntimeError(`Unbound identifier: '${expr.callee}'`);
  }
  if (fnVal.kind !== 'function') {
    throw new SproutRuntimeError(
      `'${expr.callee}' is not a function (got ${fnVal.kind})`
    );
  }
  const fn = fnVal as SproutFunction;

  // Evaluate arguments in the *current* env (not the closure env).
  const evaluatedArgs = expr.args.map(a => evalExpr(a, env));

  // Arity check.
  if (fn.params.length !== evaluatedArgs.length) {
    throw new SproutRuntimeError(
      `'${expr.callee}' expects ${fn.params.length} argument(s), got ${evaluatedArgs.length}`
    );
  }

  // Build child env: extend the function's *closure* env (lexical scoping).
  const childEnv = envExtend(fn.env, fn.params.map((p, i) => [p, evaluatedArgs[i]] as [string, SproutValue]));

  return evalExpr(fn.body, childEnv);
}

function evalOn(_expr: OnExpr, _env: Env): Drawing {
  throw new SproutRuntimeError('on(...) may only appear as a top-level statement');
}

/**
 * Evaluate a statement, returning [value | null, updatedEnv].
 * `null` means the statement produces no visual contribution (e.g. DefStmt).
 * A real `EMPTY` Drawing (from e.g. `puts`) is distinct: it IS a visual no-op
 * but was explicitly produced by an expression.
 * DefStmt extends the env; ExprStmt does not.
 */
function evalStmtWithEnv(stmt: Stmt, env: Env): [SproutValue | null, Env] {
  switch (stmt.kind) {
    case 'DefStmt': {
      const fn: SproutFunction = {
        kind: 'function',
        params: stmt.params,
        body: stmt.body,
        env,
      };
      const newEnv = envExtend(env, [[stmt.name, fn]]);
      // DefStmt produces NO value — null signals "skip this for drawings".
      return [null, newEnv];
    }
    case 'ExprStmt': {
      // Handle OnExpr specially: register handler, update env, no visual output.
      if (stmt.expr.kind === 'OnExpr') {
        const onExpr = stmt.expr;
        const key = ':' + onExpr.event.name;
        const handler: SproutFunction = {
          kind: 'function',
          params: [],
          body: onExpr.body,
          env,
        };
        const newEnv = envExtend(env, [[key, handler]]);
        return [null, newEnv];
      }
      const val = evalExpr(stmt.expr, env);
      return [val, env];
    }
  }
}

/** evalStmt used inside block/repeat: env mutations don't escape the block. */
function evalStmt(stmt: Stmt, env: Env): SproutValue | null {
  const [val] = evalStmtWithEnv(stmt, env);
  return val;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Empty env used when no initial env is provided. */
const EMPTY_ENV: Env = new Map<string, SproutValue>();

/**
 * Walk a Program and produce the Drawing that represents its visual output.
 * Statements are evaluated in order; only Drawing values contribute to the
 * result.  Def statements extend the environment for subsequent statements.
 */
export function interpret(program: Program, initialEnv: Env = EMPTY_ENV): Drawing {
  let env: Env = initialEnv;
  const drawings: Drawing[] = [];

  for (const stmt of program.stmts) {
    const [val, newEnv] = evalStmtWithEnv(stmt, env);
    env = newEnv;
    // null → no visual contribution (DefStmt / OnExpr)
    if (val !== null && isDrawing(val)) {
      drawings.push(val);
    }
  }

  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}

/**
 * Like `interpret`, but also returns the event handlers registered by
 * `on :eventName do...end` statements, keyed by `':eventName'`.
 */
export function interpretFull(
  program: Program,
  initialEnv: Env = EMPTY_ENV,
): { drawing: Drawing; handlers: Map<string, SproutFunction> } {
  let env: Env = initialEnv;
  const drawings: Drawing[] = [];

  for (const stmt of program.stmts) {
    const [val, newEnv] = evalStmtWithEnv(stmt, env);
    env = newEnv;
    if (val !== null && isDrawing(val)) {
      drawings.push(val);
    }
  }

  const handlers = new Map<string, SproutFunction>();
  for (const [key, val] of env) {
    if (key.startsWith(':') && val.kind === 'function') {
      handlers.set(key, val as SproutFunction);
    }
  }

  return {
    drawing: drawings.length === 0 ? EMPTY : mkSequence(drawings),
    handlers,
  };
}

/**
 * Invoke a zero-parameter event handler closure and return the Drawing it
 * produces.  Returns EMPTY if the body produces a non-Drawing value.
 */
export function callHandler(fn: SproutFunction): Drawing {
  const result = evalExpr(fn.body, fn.env);
  return isDrawing(result) ? result : EMPTY;
}
