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
  const k = v.kind;
  return (
    k === 'forward' ||
    k === 'turn' ||
    k === 'penUp' ||
    k === 'penDown' ||
    k === 'sequence' ||
    k === 'beside' ||
    k === 'above' ||
    k === 'scale' ||
    k === 'empty'
  );
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
  const left = assertNumber(evalExpr(expr.left, env), 'infix left operand');
  const right = assertNumber(evalExpr(expr.right, env), 'infix right operand');
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
  return mkSequence(drawings);
}

function evalCall(expr: CallExpr, env: Env): SproutValue {
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

function evalOn(expr: OnExpr, env: Env): Drawing {
  // MVP: register handler in env under ':' + event.name.
  // The interpreter cannot mutate env, so OnExpr's side-effect of registration
  // is handled at the statement level via evalStmt returning an updated env.
  // Here we just return EMPTY — the registration happens in evalProgram.
  void expr; void env;
  return EMPTY;
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
