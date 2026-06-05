// Tree-walking interpreter for the Sprout visual programming language.
// Programs are pure and immutable — evaluation produces a Drawing value,
// never mutates state.

import type {
  Program,
  Stmt,
  Expr,
  DefStmt,
  ExprStmt,
  LetStmt,
  AssignStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
  InfixExpr,
  UnaryExpr,
  CallExpr,
  BlockExpr,
  RepeatExpr,
  OnExpr,
  IfExpr,
  WhileExpr,
} from './ast.js';

import {
  type SproutValue,
  type SproutNumber,
  type SproutString,
  type SproutVar,
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
  mkPenWidth,
  mkCircle,
  mkRect,
  mkEllipse,
  mkTriangle,
  mkPolygon,
  mkText,
  mkBackground,
  mkClearCanvas,
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

// Internal signals for return value propagation — not exported.
class ReturnSignal {
  constructor(public value: SproutValue, public drawings: Drawing) {}
}

class ReturnBundle {
  constructor(public value: SproutValue, public drawing: Drawing) {}
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isDrawing(v: SproutValue): v is Drawing {
  // Must stay in sync with the Drawing union in values.ts
  switch (v.kind) {
    case 'forward': case 'turn': case 'penUp': case 'penDown':
    case 'sequence': case 'beside': case 'above': case 'scale': case 'color': case 'penWidth': case 'empty':
    case 'circle': case 'rect': case 'ellipse': case 'triangle': case 'polygon': case 'text': case 'background': case 'clearCanvas':
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

function assertString(v: SproutValue, context: string): SproutString {
  if (v.kind !== 'string') {
    throw new SproutRuntimeError(
      `${context}: expected string, got ${v.kind}`
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

function toStr(v: SproutValue, context: string): string {
  if (v.kind === 'string') return v.value;
  if (v.kind === 'number') return String(v.value);
  if (v.kind === 'bool') return String(v.value);
  if (v.kind === 'symbol') return `:${v.name}`;
  throw new SproutRuntimeError(`${context}: cannot convert ${v.kind} to string`);
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
  ['penWidth', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`penWidth expects 1 argument, got ${args.length}`);
    const w = assertNumber(args[0], 'penWidth');
    if (w.value <= 0) throw new SproutRuntimeError(`penWidth: width must be > 0, got ${w.value}`);
    return mkPenWidth(w.value);
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
  ['randomColor', (args) => {
    if (args.length === 0) {
      const keys = Object.keys(COLOR_MAP);
      const hex = COLOR_MAP[keys[Math.floor(Math.random() * keys.length)]];
      return mkColor(hex);
    }
    if (args.length === 1) {
      const sym = args[0];
      if (sym.kind !== 'symbol' || sym.name !== 'any') {
        throw new SproutRuntimeError(
          `randomColor: expected no arguments or :any, got ${sym.kind === 'symbol' ? ':' + sym.name : sym.kind}`
        );
      }
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      return mkColor(hex);
    }
    throw new SproutRuntimeError(`randomColor expects 0 or 1 arguments, got ${args.length}`);
  }],
  ['background', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`background expects 1 argument, got ${args.length}`);
    const arg = args[0];
    if (arg.kind === 'symbol') {
      const hex = COLOR_MAP[arg.name];
      if (hex === undefined) {
        throw new SproutRuntimeError(
          `background: unknown color :${arg.name}. Available: ${Object.keys(COLOR_MAP).map(k => ':' + k).join(', ')}`
        );
      }
      return mkBackground(hex);
    }
    if (arg.kind === 'string') {
      return mkBackground(arg.value);
    }
    throw new SproutRuntimeError(`background: expects a color symbol or hex string, got ${arg.kind}`);
  }],
  ['clearCanvas', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`clearCanvas expects 0 arguments, got ${args.length}`);
    return mkClearCanvas();
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
  // --- Math builtins ---
  ['sin', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`sin expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'sin');
    return { kind: 'number', value: Math.sin(x.value * Math.PI / 180) } satisfies SproutNumber;
  }],
  ['cos', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`cos expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'cos');
    return { kind: 'number', value: Math.cos(x.value * Math.PI / 180) } satisfies SproutNumber;
  }],
  ['tan', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`tan expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'tan');
    return { kind: 'number', value: Math.tan(x.value * Math.PI / 180) } satisfies SproutNumber;
  }],
  ['abs', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`abs expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'abs');
    return { kind: 'number', value: Math.abs(x.value) } satisfies SproutNumber;
  }],
  ['sqrt', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`sqrt expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'sqrt');
    return { kind: 'number', value: Math.sqrt(x.value) } satisfies SproutNumber;
  }],
  ['pow', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`pow expects 2 arguments, got ${args.length}`);
    const base = assertNumber(args[0], 'pow (base)');
    const exp = assertNumber(args[1], 'pow (exp)');
    return { kind: 'number', value: Math.pow(base.value, exp.value) } satisfies SproutNumber;
  }],
  ['mod', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`mod expects 2 arguments, got ${args.length}`);
    const a = assertNumber(args[0], 'mod (a)');
    const b = assertNumber(args[1], 'mod (b)');
    return { kind: 'number', value: a.value % b.value } satisfies SproutNumber;
  }],
  ['log', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`log expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'log');
    return { kind: 'number', value: Math.log(x.value) } satisfies SproutNumber; // natural log (ln), not log₁₀
  }],
  ['floor', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`floor expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'floor');
    return { kind: 'number', value: Math.floor(x.value) } satisfies SproutNumber;
  }],
  ['ceil', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`ceil expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'ceil');
    return { kind: 'number', value: Math.ceil(x.value) } satisfies SproutNumber;
  }],
  ['round', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`round expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'round');
    return { kind: 'number', value: Math.round(x.value) } satisfies SproutNumber;
  }],
  ['max', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`max expects 2 arguments, got ${args.length}`);
    const a = assertNumber(args[0], 'max (a)');
    const b = assertNumber(args[1], 'max (b)');
    return { kind: 'number', value: Math.max(a.value, b.value) } satisfies SproutNumber;
  }],
  ['min', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`min expects 2 arguments, got ${args.length}`);
    const a = assertNumber(args[0], 'min (a)');
    const b = assertNumber(args[1], 'min (b)');
    return { kind: 'number', value: Math.min(a.value, b.value) } satisfies SproutNumber;
  }],
  ['random', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`random expects 1 argument, got ${args.length}`);
    const n = assertNumber(args[0], 'random');
    return { kind: 'number', value: Math.random() * n.value } satisfies SproutNumber;
  }],
  ['pi', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`pi expects 0 arguments, got ${args.length}`);
    return { kind: 'number', value: Math.PI } satisfies SproutNumber;
  }],
  // --- Shape builtins ---
  ['circle', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`circle expects 1 argument, got ${args.length}`);
    const r = assertNumber(args[0], 'circle');
    return mkCircle(r.value);
  }],
  ['rect', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`rect expects 2 arguments, got ${args.length}`);
    const w = assertNumber(args[0], 'rect (width)');
    const h = assertNumber(args[1], 'rect (height)');
    return mkRect(w.value, h.value);
  }],
  ['ellipse', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`ellipse expects 2 arguments, got ${args.length}`);
    const rx = assertNumber(args[0], 'ellipse (rx)');
    const ry = assertNumber(args[1], 'ellipse (ry)');
    return mkEllipse(rx.value, ry.value);
  }],
  ['triangle', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`triangle expects 1 argument, got ${args.length}`);
    const size = assertNumber(args[0], 'triangle');
    return mkTriangle(size.value);
  }],
  ['polygon', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`polygon expects 2 arguments, got ${args.length}`);
    const n = assertNumber(args[0], 'polygon (n)');
    const size = assertNumber(args[1], 'polygon (size)');
    if (!Number.isInteger(n.value)) throw new SproutRuntimeError(`polygon expects n to be an integer, got ${n.value}`);
    if (n.value < 3) throw new SproutRuntimeError(`polygon expects n ≥ 3, got ${n.value}`);
    return mkPolygon(n.value, size.value);
  }],
  ['text', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`text expects 2 arguments, got ${args.length}`);
    const str = assertString(args[0], 'text (str)');
    const size = assertNumber(args[1], 'text (size)');
    if (size.value <= 0) throw new SproutRuntimeError(`text expects size > 0, got ${size.value}`);
    return mkText(str.value, size.value);
  }],
  // --- String builtins ---
  ['join', (args) => {
    return { kind: 'string', value: args.map(a => toStr(a, 'join')).join('') };
  }],
  ['length', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`length expects 1 argument, got ${args.length}`);
    const s = assertString(args[0], 'length');
    return { kind: 'number', value: s.value.length };
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
      return val.kind === 'var' ? val.cell.value : val;
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
      try {
        return evalCall(expr, env);
      } catch (e) {
        if (e instanceof ReturnBundle) {
          // Expression context: drop drawings, return value only.
          return e.value;
        }
        throw e;
      }
    }

    // --- On (event handler) ---
    case 'OnExpr': {
      return evalOn(expr, env);
    }

    // --- If conditional ---
    case 'IfExpr': {
      const cond = evalExpr(expr.cond, env);
      if (cond.kind !== 'bool') {
        throw new SproutRuntimeError(`if: condition must be a bool, got ${cond.kind}`);
      }
      if (cond.value) return evalBlock(expr.then, env);
      if (expr.else !== null) return evalBlock(expr.else, env);
      return EMPTY;
    }

    // --- Unary not ---
    case 'UnaryExpr': {
      const v = evalExpr(expr.operand, env);
      if (v.kind !== 'bool') {
        throw new SproutRuntimeError(`not: expected bool, got ${v.kind}`);
      }
      return { kind: 'bool', value: !v.value };
    }

    // --- While loop ---
    case 'WhileExpr':
      return evalWhile(expr, env);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = expr;
      throw new SproutRuntimeError(`Unknown expression kind: ${(_exhaustive as Expr).kind}`);
    }
  }
}

function evalInfix(expr: InfixExpr, env: Env): SproutValue {
  // Short-circuit boolean operators
  if (expr.op === 'and') {
    const lv = evalExpr(expr.left, env);
    if (lv.kind !== 'bool') throw new SproutRuntimeError(`and: expected bool, got ${lv.kind}`);
    if (!lv.value) return lv;
    const rv = evalExpr(expr.right, env);
    if (rv.kind !== 'bool') throw new SproutRuntimeError(`and: expected bool, got ${rv.kind}`);
    return rv;
  }
  if (expr.op === 'or') {
    const lv = evalExpr(expr.left, env);
    if (lv.kind !== 'bool') throw new SproutRuntimeError(`or: expected bool, got ${lv.kind}`);
    if (lv.value) return lv;
    const rv = evalExpr(expr.right, env);
    if (rv.kind !== 'bool') throw new SproutRuntimeError(`or: expected bool, got ${rv.kind}`);
    return rv;
  }
  // == and != work on numbers, bools, or strings (same kind required)
  if (expr.op === '==' || expr.op === '!=') {
    const lv = evalExpr(expr.left, env);
    const rv = evalExpr(expr.right, env);
    let eq: boolean;
    if (lv.kind === 'number' && rv.kind === 'number') {
      eq = lv.value === rv.value;
    } else if (lv.kind === 'bool' && rv.kind === 'bool') {
      eq = lv.value === rv.value;
    } else if (lv.kind === 'string' && rv.kind === 'string') {
      eq = lv.value === rv.value;
    } else {
      throw new SproutRuntimeError(`${expr.op}: cannot compare ${lv.kind} and ${rv.kind}`);
    }
    return { kind: 'bool', value: expr.op === '==' ? eq : !eq };
  }
  // Arithmetic and numeric comparisons — + is polymorphic (string concat or numeric add)
  const leftVal = evalExpr(expr.left, env);
  const rightVal = evalExpr(expr.right, env);
  switch (expr.op) {
    case '+': {
      if (leftVal.kind === 'number' && rightVal.kind === 'number') {
        return { kind: 'number', value: leftVal.value + rightVal.value };
      }
      if (leftVal.kind === 'string' || rightVal.kind === 'string') {
        return { kind: 'string', value: toStr(leftVal, '+') + toStr(rightVal, '+') };
      }
      throw new SproutRuntimeError(`+: cannot add ${leftVal.kind} and ${rightVal.kind}`);
    }
    case '-': {
      const left = assertNumber(leftVal, '(-) left operand');
      const right = assertNumber(rightVal, '(-) right operand');
      return { kind: 'number', value: left.value - right.value };
    }
    case '*': {
      const left = assertNumber(leftVal, '(*) left operand');
      const right = assertNumber(rightVal, '(*) right operand');
      return { kind: 'number', value: left.value * right.value };
    }
    case '/': {
      const left = assertNumber(leftVal, '(/) left operand');
      const right = assertNumber(rightVal, '(/) right operand');
      if (right.value === 0) throw new SproutRuntimeError('Division by zero');
      return { kind: 'number', value: left.value / right.value };
    }
    case '<': {
      const left = assertNumber(leftVal, '(<) left operand');
      const right = assertNumber(rightVal, '(<) right operand');
      return { kind: 'bool', value: left.value < right.value };
    }
    case '>': {
      const left = assertNumber(leftVal, '(>) left operand');
      const right = assertNumber(rightVal, '(>) right operand');
      return { kind: 'bool', value: left.value > right.value };
    }
    case '<=': {
      const left = assertNumber(leftVal, '(<=) left operand');
      const right = assertNumber(rightVal, '(<=) right operand');
      return { kind: 'bool', value: left.value <= right.value };
    }
    case '>=': {
      const left = assertNumber(leftVal, '(>=) left operand');
      const right = assertNumber(rightVal, '(>=) right operand');
      return { kind: 'bool', value: left.value >= right.value };
    }
  }
}

/** Evaluate a BlockExpr: collect Drawing results, thread env for let/set. */
function evalBlock(block: BlockExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  let currentEnv = env;
  for (const stmt of block.body) {
    if (stmt.kind === 'ReturnStmt') {
      const value = evalExpr(stmt.value, currentEnv);
      const drawing = drawings.length === 0 ? EMPTY : mkSequence(drawings);
      throw new ReturnSignal(value, drawing);
    }
    const [val, newEnv] = evalStmtWithEnv(stmt, currentEnv);
    currentEnv = newEnv;
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
    try {
      const d = evalBlock(expr.body, env);
      drawings.push(d);
    } catch (e) {
      if (e instanceof ReturnSignal) {
        throw new SproutRuntimeError('return can only be used inside a function');
      }
      throw e;
    }
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

  try {
    return evalExpr(fn.body, childEnv);
  } catch (e) {
    if (e instanceof ReturnSignal) {
      throw new ReturnBundle(e.value, e.drawings);
    }
    throw e;
  }
}

function evalWhile(expr: WhileExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  while (true) {
    const cond = evalExpr(expr.cond, env);
    if (cond.kind !== 'bool') {
      throw new SproutRuntimeError(`while: condition must be bool, got ${cond.kind}`);
    }
    if (!cond.value) break;
    try {
      drawings.push(evalBlock(expr.body, env));
    } catch (e) {
      if (e instanceof ReturnSignal) {
        throw new SproutRuntimeError('return can only be used inside a function');
      }
      throw e;
    }
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
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
      // Direct function call: catch ReturnBundle to emit its drawings.
      if (stmt.expr.kind === 'CallExpr') {
        try {
          const val = evalCall(stmt.expr, env);
          return [val, env];
        } catch (e) {
          if (e instanceof ReturnBundle) {
            // Return value is discarded; drawings surface as this statement's output.
            return [e.drawing, env];
          }
          throw e;
        }
      }
      const val = evalExpr(stmt.expr, env);
      return [val, env];
    }
    case 'LetStmt': {
      // Direct function call as init: extract drawings as a side contribution.
      if (stmt.init.kind === 'CallExpr') {
        let initVal: SproutValue;
        let sideDrawing: Drawing = EMPTY;
        try {
          initVal = evalCall(stmt.init, env);
        } catch (e) {
          if (e instanceof ReturnBundle) {
            initVal = e.value;
            sideDrawing = e.drawing;
          } else {
            throw e;
          }
        }
        const varCell: SproutVar = { kind: 'var', cell: { value: initVal } };
        const newEnv = envExtend(env, [[stmt.name, varCell]]);
        return [sideDrawing === EMPTY ? null : sideDrawing, newEnv];
      }
      const initVal = evalExpr(stmt.init, env);
      const varCell: SproutVar = { kind: 'var', cell: { value: initVal } };
      const newEnv = envExtend(env, [[stmt.name, varCell]]);
      return [null, newEnv];
    }
    case 'AssignStmt': {
      const existing = env.get(stmt.name);
      if (existing === undefined) {
        throw new SproutRuntimeError(`set: '${stmt.name}' is not declared`);
      }
      if (existing.kind !== 'var') {
        throw new SproutRuntimeError(`set: '${stmt.name}' is not a variable`);
      }
      // Direct function call as value: extract drawings as a side contribution.
      if (stmt.value.kind === 'CallExpr') {
        let val: SproutValue;
        let sideDrawing: Drawing = EMPTY;
        try {
          val = evalCall(stmt.value, env);
        } catch (e) {
          if (e instanceof ReturnBundle) {
            val = e.value;
            sideDrawing = e.drawing;
          } else {
            throw e;
          }
        }
        existing.cell.value = val;
        return [sideDrawing === EMPTY ? null : sideDrawing, env];
      }
      existing.cell.value = evalExpr(stmt.value, env);
      return [null, env];
    }
    case 'ReturnStmt': {
      // return used outside a function body — evalBlock intercepts it first,
      // so this only fires at the top level (Program stmts) or other non-function contexts.
      throw new SproutRuntimeError('return can only be used inside a function');
    }
  }
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
  try {
    const result = evalExpr(fn.body, fn.env);
    return isDrawing(result) ? result : EMPTY;
  } catch (e) {
    if (e instanceof ReturnBundle) {
      return e.drawing;
    }
    throw e;
  }
}
