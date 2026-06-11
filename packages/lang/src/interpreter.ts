// Tree-walking interpreter for the Sprout visual programming language.

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
  ForEachExpr,
} from './ast.js';

import {
  type SproutValue,
  type SproutNumber,
  type SproutString,
  type SproutBool,
  type SproutVar,
  type SproutFunction,
  type SproutList,
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
  mkStamp,
  mkArc,
  mkGoto,
  mkHome,
  mkList,
  mkWait,
  mkSound,
  mkFillPath,
  HIDE_TURTLE,
  SHOW_TURTLE,
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';

// ---------------------------------------------------------------------------
// Runtime error
// ---------------------------------------------------------------------------

export class SproutRuntimeError extends Error {
  /** 1-based source line the error refers to, when known (text mode only). */
  readonly line: number | undefined;

  constructor(message: string, line?: number) {
    super(line !== undefined ? `Line ${line}: ${message}` : message);
    this.name = 'SproutRuntimeError';
    this.line = line;
  }
}

// Internal signals for return value propagation — not exported.
class ReturnSignal {
  constructor(public value: SproutValue, public drawings: Drawing) {}
}

class ReturnBundle {
  constructor(public value: SproutValue, public drawing: Drawing) {}
}

// Module-level input values — set by interpretWithInputs before each run.
let _inputValues: ReadonlyMap<string, number> = new Map();

// Module-level text input values — set by setTextInputs before each run.
let _textInputValues: ReadonlyMap<string, string> = new Map();

// Module-level HUD values — written by show() during each run.
let _hudValues: Map<string, string> = new Map();

// Module-level timer interval — set by 'on timer every N' during each run; resets to 200 each run.
let _timerInterval: number = 200;

// Module-level stop flag — set by stopTimer(), consumed by the host after each
// run/handler invocation.
let _stopTimer: boolean = false;

function formatValue(v: SproutValue): string {
  switch (v.kind) {
    case 'number': return String(v.value);
    case 'string': return v.value;
    case 'bool': return String(v.value);
    case 'symbol': return `:${(v as { kind: 'symbol'; name: string }).name}`;
    case 'list': return `[${(v as { kind: 'list'; items: readonly unknown[] }).items.length} items]`;
    case 'function': return 'fn';
    case 'var': return formatValue((v as { kind: 'var'; cell: { value: SproutValue } }).cell.value);
    default: return `<${(v as { kind: string }).kind}>`;
  }
}

function extractVariables(env: Env): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of env) {
    if (key.startsWith(':')) continue;
    if (val.kind === 'function') continue;
    if (val.kind === 'var') {
      const inner = (val as { kind: 'var'; cell: { value: SproutValue } }).cell.value;
      if (inner.kind === 'function') continue;
      result[key] = formatValue(inner);
    }
  }
  return result;
}

// Module-level mouse position — set by setMousePosition before each frame.
let _mouseX: number = 0;
let _mouseY: number = 0;

// Module-level held-key state — set by setKeyState from host key events.
const KEY_NAMES = ['left', 'right', 'up', 'down', 'space'] as const;
const _keysDown = new Set<string>();

// Module-level shadow turtle state — updated by turtle-moving builtins during each run.
let _turtleX: number = 0;
let _turtleY: number = 0;
let _turtleHeading: number = 0; // degrees clockwise from north

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isDrawing(v: SproutValue): v is Drawing {
  // Must stay in sync with the Drawing union in values.ts
  switch (v.kind) {
    case 'forward': case 'turn': case 'penUp': case 'penDown':
    case 'sequence': case 'beside': case 'above': case 'scale': case 'color': case 'penWidth': case 'empty':
    case 'circle': case 'rect': case 'ellipse': case 'triangle': case 'polygon': case 'text': case 'background': case 'clearCanvas': case 'stamp': case 'arc': case 'goto': case 'home': case 'wait': case 'sound': case 'fillPath': case 'hideTurtle': case 'showTurtle':
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

function assertList(v: SproutValue, context: string): SproutList {
  if (v.kind !== 'list') {
    throw new SproutRuntimeError(
      `${context}: expected list, got ${v.kind}`
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
    const rad = _turtleHeading * Math.PI / 180;
    _turtleX += d.value * Math.sin(rad);
    _turtleY -= d.value * Math.cos(rad);
    return mkForward(d.value);
  }],
  ['turn', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`turn expects 1 argument, got ${args.length}`);
    const deg = assertNumber(args[0], 'turn');
    _turtleHeading = ((_turtleHeading + deg.value) % 360 + 360) % 360;
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
    _turtleX = 0;
    _turtleY = 0;
    _turtleHeading = 0;
    return mkClearCanvas();
  }],
  ['stamp', (_args) => mkStamp()],
  ['arc', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`arc expects 2 arguments, got ${args.length}`);
    const radius = assertNumber(args[0], 'arc');
    const angle = assertNumber(args[1], 'arc');
    if (radius.value < 0) throw new SproutRuntimeError(`arc: radius must be non-negative, got ${radius.value}`);
    // Update shadow turtle state to match renderer arc logic
    if (angle.value !== 0 && radius.value !== 0) {
      const steps = Math.max(4, Math.abs(Math.round(angle.value / 5)));
      const stepAngle = angle.value / steps;
      const stepDist = (2 * Math.PI * Math.abs(radius.value) / 360) * Math.abs(angle.value / steps);
      for (let i = 0; i < steps; i++) {
        const rad = _turtleHeading * Math.PI / 180;
        _turtleX += stepDist * Math.sin(rad);
        _turtleY -= stepDist * Math.cos(rad);
        _turtleHeading = ((_turtleHeading + stepAngle) % 360 + 360) % 360;
      }
    }
    return mkArc(radius.value, angle.value);
  }],
  ['goto', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`goto expects 2 arguments, got ${args.length}`);
    const x = assertNumber(args[0], 'goto');
    const y = assertNumber(args[1], 'goto');
    _turtleX = x.value;
    _turtleY = y.value;
    return mkGoto(x.value, y.value);
  }],
  ['home', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`home expects 0 arguments, got ${args.length}`);
    _turtleX = 0;
    _turtleY = 0;
    _turtleHeading = 0;
    return mkHome();
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
  ['distance', (args) => {
    if (args.length !== 4) throw new SproutRuntimeError(`distance expects 4 arguments, got ${args.length}`);
    const x1 = assertNumber(args[0], 'distance (x1)');
    const y1 = assertNumber(args[1], 'distance (y1)');
    const x2 = assertNumber(args[2], 'distance (x2)');
    const y2 = assertNumber(args[3], 'distance (y2)');
    return { kind: 'number', value: Math.hypot(x2.value - x1.value, y2.value - y1.value) } satisfies SproutNumber;
  }],
  ['touching', (args) => {
    if (args.length !== 5) throw new SproutRuntimeError(`touching expects 5 arguments, got ${args.length}`);
    const x1 = assertNumber(args[0], 'touching (x1)');
    const y1 = assertNumber(args[1], 'touching (y1)');
    const x2 = assertNumber(args[2], 'touching (x2)');
    const y2 = assertNumber(args[3], 'touching (y2)');
    const radius = assertNumber(args[4], 'touching (radius)');
    const dist = Math.hypot(x2.value - x1.value, y2.value - y1.value);
    return { kind: 'bool', value: dist <= radius.value } satisfies SproutBool;
  }],
  ['random', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`random expects 2 arguments, got ${args.length}`);
    const min = assertNumber(args[0], 'random');
    const max = assertNumber(args[1], 'random');
    if (min.value > max.value) throw new SproutRuntimeError(`random: min (${min.value}) must be <= max (${max.value})`);
    const val = min.value + Math.random() * (max.value - min.value);
    return { kind: 'number', value: val } satisfies SproutNumber;
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
  ['split', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`split expects 2 arguments, got ${args.length}`);
    const str = assertString(args[0], 'split');
    const sep = assertString(args[1], 'split');
    const parts = str.value.split(sep.value);
    return mkList(parts.map(p => ({ kind: 'string' as const, value: p })));
  }],
  ['contains', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`contains expects 2 arguments, got ${args.length}`);
    if (args[0].kind === 'string') {
      const sub = assertString(args[1], 'contains');
      return { kind: 'bool', value: (args[0] as SproutString).value.includes(sub.value) };
    }
    if (args[0].kind === 'list') {
      const list = args[0] as SproutList;
      const item = args[1];
      if (item.kind === 'list' || isDrawing(item) || item.kind === 'function') {
        throw new SproutRuntimeError(`contains: cannot compare items of type ${item.kind}`);
      }
      for (const el of list.items) {
        if (el.kind === item.kind) {
          if ((el.kind === 'number' || el.kind === 'string' || el.kind === 'bool') &&
              (el as { value: unknown }).value === (item as { value: unknown }).value) {
            return { kind: 'bool', value: true };
          }
          if (el.kind === 'symbol' && item.kind === 'symbol' &&
              (el as { kind: 'symbol'; name: string }).name === (item as { kind: 'symbol'; name: string }).name) {
            return { kind: 'bool', value: true };
          }
        }
      }
      return { kind: 'bool', value: false };
    }
    throw new SproutRuntimeError(`contains: expected string or list, got ${args[0].kind}`);
  }],
  ['show', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`show expects 2 arguments, got ${args.length}`);
    const label = assertString(args[0], 'show');
    _hudValues.set(label.value, formatValue(args[1]));
    return EMPTY;
  }],
  ['toUpper', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`toUpper expects 1 argument, got ${args.length}`);
    const s = assertString(args[0], 'toUpper');
    return { kind: 'string', value: s.value.toUpperCase() };
  }],
  ['toLower', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`toLower expects 1 argument, got ${args.length}`);
    const s = assertString(args[0], 'toLower');
    return { kind: 'string', value: s.value.toLowerCase() };
  }],
  ['input', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`input expects 1 argument, got ${args.length}`);
    const name = assertString(args[0], 'input');
    return { kind: 'number', value: _inputValues.get(name.value) ?? 0 } satisfies SproutNumber;
  }],
  ['textInput', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`textInput expects 1 argument, got ${args.length}`);
    const name = assertString(args[0], 'textInput');
    return { kind: 'string', value: _textInputValues.get(name.value) ?? '' };
  }],
  ['mouseX', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`mouseX expects 0 arguments, got ${args.length}`);
    return { kind: 'number', value: _mouseX } satisfies SproutNumber;
  }],
  ['mouseY', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`mouseY expects 0 arguments, got ${args.length}`);
    return { kind: 'number', value: _mouseY } satisfies SproutNumber;
  }],
  ['keyDown', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`keyDown expects 1 argument, got ${args.length}`);
    const arg = args[0];
    let key: string;
    if (arg.kind === 'symbol') key = arg.name;
    else if (arg.kind === 'string') key = arg.value;
    else throw new SproutRuntimeError(`keyDown: expected a key name symbol or string, got ${arg.kind}`);
    const isLetter = key.length === 1 && key >= 'a' && key <= 'z';
    if (!isLetter && !(KEY_NAMES as readonly string[]).includes(key)) {
      throw new SproutRuntimeError(`keyDown: unknown key '${key}' (expected ${KEY_NAMES.join(', ')}, or a letter a-z)`);
    }
    return { kind: 'bool', value: _keysDown.has(key) } satisfies SproutBool;
  }],
  // --- List builtins ---
  ['list', (args) => mkList(args)],

  ['push', (args) => {
    if (args.length !== 2) {
      throw new SproutRuntimeError(`push expects 2 arguments, got ${args.length}`);
    }
    const lst = assertList(args[0], 'push');
    return mkList([...lst.items, args[1]]);
  }],

  ['get', (args) => {
    const lst = assertList(args[0], 'get');
    if (args[1].kind !== 'number') {
      throw new SproutRuntimeError(
        `get: expected number index, got ${args[1].kind}`
      );
    }
    const i = args[1].value;
    if (i < 1 || i > lst.items.length) {
      throw new SproutRuntimeError(
        `get: index ${i} is out of bounds (size ${lst.items.length})`
      );
    }
    return lst.items[i - 1];
  }],

  ['size', (args) => {
    const lst = assertList(args[0], 'size');
    return { kind: 'number' as const, value: lst.items.length };
  }],

  ['isEmpty', (args) => {
    const lst = assertList(args[0], 'isEmpty');
    return { kind: 'bool' as const, value: lst.items.length === 0 };
  }],

  ['at', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`at expects 2 arguments, got ${args.length}`);
    const lst = assertList(args[0], 'at');
    const idx = assertNumber(args[1], 'at');
    const i = idx.value;
    if (i < 0 || i >= lst.items.length) {
      throw new SproutRuntimeError(`at: index ${i} is out of bounds (size ${lst.items.length})`);
    }
    return lst.items[i];
  }],

  ['range', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`range expects 2 arguments, got ${args.length}`);
    const start = assertNumber(args[0], 'range');
    const end = assertNumber(args[1], 'range');
    if (!Number.isInteger(start.value)) throw new SproutRuntimeError(`range: start must be an integer, got ${start.value}`);
    if (!Number.isInteger(end.value)) throw new SproutRuntimeError(`range: end must be an integer, got ${end.value}`);
    if (start.value > end.value) {
      throw new SproutRuntimeError(`range: start (${start.value}) must be <= end (${end.value})`);
    }
    const items: SproutValue[] = [];
    for (let i = start.value; i < end.value; i++) {
      items.push({ kind: 'number', value: i });
    }
    return mkList(items);
  }],

  ['first', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`first expects 1 argument, got ${args.length}`);
    const lst = assertList(args[0], 'first');
    if (lst.items.length === 0) throw new SproutRuntimeError(`first: list is empty`);
    return lst.items[0];
  }],

  ['pick', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`pick expects 1 argument, got ${args.length}`);
    const lst = assertList(args[0], 'pick');
    if (lst.items.length === 0) throw new SproutRuntimeError(`pick: list is empty`);
    return lst.items[Math.floor(Math.random() * lst.items.length)];
  }],

  ['last', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`last expects 1 argument, got ${args.length}`);
    const lst = assertList(args[0], 'last');
    if (lst.items.length === 0) throw new SproutRuntimeError(`last: list is empty`);
    return lst.items[lst.items.length - 1];
  }],

  ['pop', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`pop expects 1 argument, got ${args.length}`);
    const lst = assertList(args[0], 'pop');
    if (lst.items.length === 0) throw new SproutRuntimeError(`pop: list is empty`);
    return mkList(lst.items.slice(0, -1));
  }],

  ['concat', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`concat expects 2 arguments, got ${args.length}`);
    const lst1 = assertList(args[0], 'concat');
    const lst2 = assertList(args[1], 'concat');
    return mkList([...lst1.items, ...lst2.items]);
  }],
  ['reverse', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`reverse expects 1 argument, got ${args.length}`);
    const lst = assertList(args[0], 'reverse');
    return mkList([...lst.items].reverse());
  }],

  ['indexOf', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`indexOf expects 2 arguments, got ${args.length}`);
    const lst = assertList(args[0], 'indexOf');
    const item = args[1];
    if (item.kind === 'list' || isDrawing(item) || item.kind === 'function') {
      throw new SproutRuntimeError(`indexOf: cannot compare items of type ${item.kind}`);
    }
    const idx = lst.items.findIndex(el => {
      if (el.kind !== item.kind) return false;
      if (el.kind === 'number' || el.kind === 'string' || el.kind === 'bool') {
        return (el as { value: unknown }).value === (item as { value: unknown }).value;
      }
      if (el.kind === 'symbol' && item.kind === 'symbol') {
        return (el as { kind: 'symbol'; name: string }).name === (item as { kind: 'symbol'; name: string }).name;
      }
      return false;
    });
    return { kind: 'number', value: idx } satisfies SproutNumber;
  }],

  ['slice', (args) => {
    if (args.length !== 3) throw new SproutRuntimeError(`slice expects 3 arguments, got ${args.length}`);
    const lst = assertList(args[0], 'slice');
    if (args[1].kind !== 'number') throw new SproutRuntimeError(`slice: start must be a number`);
    if (args[2].kind !== 'number') throw new SproutRuntimeError(`slice: end must be a number`);
    const start = Math.max(0, Math.floor((args[1] as SproutNumber).value));
    const end = Math.min(lst.items.length, Math.floor((args[2] as SproutNumber).value));
    return mkList(lst.items.slice(start, end));
  }],

  ['sort', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`sort expects 1 argument, got ${args.length}`);
    const lst = assertList(args[0], 'sort');
    if (lst.items.length === 0) return mkList([]);
    const firstKind = lst.items[0].kind;
    if (firstKind !== 'number' && firstKind !== 'string') {
      throw new SproutRuntimeError(`sort: can only sort lists of numbers or strings`);
    }
    if (lst.items.some(it => it.kind !== firstKind)) {
      throw new SproutRuntimeError(`sort: cannot sort mixed types`);
    }
    const sorted = [...lst.items].sort((a, b) => {
      if (a.kind === 'number' && b.kind === 'number') return a.value - b.value;
      if (a.kind === 'string' && b.kind === 'string') return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
      return 0;
    });
    return mkList(sorted);
  }],
  // --- Turtle state query builtins ---
  ['getX', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`getX expects 0 arguments, got ${args.length}`);
    return { kind: 'number' as const, value: _turtleX };
  }],
  ['getY', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`getY expects 0 arguments, got ${args.length}`);
    return { kind: 'number' as const, value: _turtleY };
  }],
  ['getHeading', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`getHeading expects 0 arguments, got ${args.length}`);
    return { kind: 'number' as const, value: _turtleHeading };
  }],
  ['wait', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`wait expects 1 argument, got ${args.length}`);
    const secs = assertNumber(args[0], 'wait');
    if (secs.value < 0) throw new SproutRuntimeError(`wait: seconds must be non-negative, got ${secs.value}`);
    return mkWait(secs.value);
  }],
  ['playNote', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`playNote expects 2 arguments, got ${args.length}`);
    let frequency: number;
    if (args[0].kind === 'string') {
      frequency = noteToFrequency(args[0].value);
    } else {
      const freq = assertNumber(args[0], 'playNote (note)');
      if (freq.value <= 0) throw new SproutRuntimeError(`playNote: frequency must be positive, got ${freq.value}`);
      frequency = freq.value;
    }
    const secs = assertNumber(args[1], 'playNote (seconds)');
    if (secs.value < 0) throw new SproutRuntimeError(`playNote: seconds must be non-negative, got ${secs.value}`);
    return mkSound(frequency, secs.value);
  }],
  ['beep', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`beep expects 0 arguments, got ${args.length}`);
    return mkSound(880, 0.2);
  }],
  ['stopTimer', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`stopTimer expects 0 arguments, got ${args.length}`);
    _stopTimer = true;
    return EMPTY;
  }],
  ['hideTurtle', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`hideTurtle expects 0 arguments, got ${args.length}`);
    return HIDE_TURTLE;
  }],
  ['showTurtle', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`showTurtle expects 0 arguments, got ${args.length}`);
    return SHOW_TURTLE;
  }],
]);

// Equal temperament: A4 = 440 Hz. Accepts "C4", "F#3", "Bb2" (letter, optional
// #/b, octave 0-8).
const NOTE_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteToFrequency(note: string): number {
  const m = /^([A-G])([#b]?)([0-8])$/.exec(note);
  if (m === null) throw new SproutRuntimeError(`playNote: unknown note '${note}'`);
  const semitone = NOTE_SEMITONES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

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
        throw new SproutRuntimeError(`Unbound identifier: '${expr.name}'`, expr.line);
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

    case 'FillExpr': {
      return mkFillPath(evalBlock(expr.body, env));
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
      if (expr.op === '-') {
        if (v.kind !== 'number') {
          throw new SproutRuntimeError(`-: expected number, got ${v.kind}`);
        }
        return { kind: 'number', value: -v.value };
      }
      if (v.kind !== 'bool') {
        throw new SproutRuntimeError(`not: expected bool, got ${v.kind}`);
      }
      return { kind: 'bool', value: !v.value };
    }

    // --- For-each loop ---
    case 'ForEachExpr':
      return evalForEach(expr, env);

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
    const iterEnv = expr.item !== null
      ? envExtend(env, [[expr.item, { kind: 'number', value: i } satisfies SproutNumber]])
      : env;
    const d = evalBlock(expr.body, iterEnv);
    drawings.push(d);
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}

function evalCall(expr: CallExpr, env: Env): SproutValue {
  try {
    return evalCallInner(expr, env);
  } catch (e) {
    // Annotate escaping runtime errors with this call's line; the innermost
    // call gets there first, which is the most precise location.
    if (e instanceof SproutRuntimeError && e.line === undefined && expr.line !== undefined) {
      throw new SproutRuntimeError(e.message, expr.line);
    }
    throw e;
  }
}

function evalCallInner(expr: CallExpr, env: Env): SproutValue {
  if (expr.block !== null) {
    throw new SproutRuntimeError(`${expr.callee}: trailing do...end blocks are not supported in Phase 1`);
  }

  // Higher-order list builtins (need access to evalExpr).
  if (expr.callee === 'map') {
    if (expr.args.length !== 2) throw new SproutRuntimeError(`map expects 2 arguments, got ${expr.args.length}`);
    const lst = assertList(evalExpr(expr.args[0], env), 'map');
    const fnVal = evalExpr(expr.args[1], env);
    if (fnVal.kind !== 'function') throw new SproutRuntimeError(`map: second argument must be a function`);
    const fn = fnVal as SproutFunction;
    if (fn.params.length !== 1) throw new SproutRuntimeError(`map: function must take exactly 1 parameter, got ${fn.params.length}`);
    const mapped = lst.items.map(item => {
      const childEnv = envExtend(fn.env, [[fn.params[0], item] as [string, SproutValue]]);
      try {
        return evalExpr(fn.body, childEnv);
      } catch (e) {
        if (e instanceof ReturnSignal) {
          return e.value;
        }
        throw e;
      }
    });
    return mkList(mapped);
  }

  if (expr.callee === 'filter') {
    if (expr.args.length !== 2) throw new SproutRuntimeError(`filter expects 2 arguments, got ${expr.args.length}`);
    const lst = assertList(evalExpr(expr.args[0], env), 'filter');
    const fnVal = evalExpr(expr.args[1], env);
    if (fnVal.kind !== 'function') throw new SproutRuntimeError(`filter: second argument must be a function`);
    const fn = fnVal as SproutFunction;
    if (fn.params.length !== 1) throw new SproutRuntimeError(`filter: function must take exactly 1 parameter, got ${fn.params.length}`);
    const filtered = lst.items.filter(item => {
      const childEnv = envExtend(fn.env, [[fn.params[0], item] as [string, SproutValue]]);
      let result: SproutValue;
      try {
        result = evalExpr(fn.body, childEnv);
      } catch (e) {
        if (e instanceof ReturnSignal) {
          result = e.value;
        } else {
          throw e;
        }
      }
      if (result.kind !== 'bool') throw new SproutRuntimeError(`filter: predicate must return a bool, got ${result.kind}`);
      return result.value;
    });
    return mkList(filtered);
  }

  if (expr.callee === 'reduce') {
    if (expr.args.length !== 3) throw new SproutRuntimeError(`reduce expects 3 arguments, got ${expr.args.length}`);
    const lst = assertList(evalExpr(expr.args[0], env), 'reduce');
    const fnVal = evalExpr(expr.args[1], env);
    if (fnVal.kind !== 'function') throw new SproutRuntimeError(`reduce: second argument must be a function`);
    const fn = fnVal as SproutFunction;
    if (fn.params.length !== 2) throw new SproutRuntimeError(`reduce: function must take exactly 2 parameters, got ${fn.params.length}`);
    let acc = evalExpr(expr.args[2], env);
    for (const item of lst.items) {
      const childEnv = envExtend(fn.env, [
        [fn.params[0], acc] as [string, SproutValue],
        [fn.params[1], item] as [string, SproutValue],
      ]);
      try {
        acc = evalExpr(fn.body, childEnv);
      } catch (e) {
        if (e instanceof ReturnSignal) { acc = e.value; continue; }
        throw e;
      }
    }
    return acc;
  }

  // User-defined functions shadow builtins.
  const fnVal = env.get(expr.callee);
  if (fnVal !== undefined && fnVal.kind === 'function') {
    const fn = fnVal as SproutFunction;
    const evaluatedArgs = expr.args.map(a => evalExpr(a, env));
    if (fn.params.length !== evaluatedArgs.length) {
      throw new SproutRuntimeError(
        `'${expr.callee}' expects ${fn.params.length} argument(s), got ${evaluatedArgs.length}`
      );
    }
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

  // Check built-ins.
  const builtin = BUILTINS.get(expr.callee);
  if (builtin !== undefined) {
    const args = expr.args.map(a => evalExpr(a, env));
    return builtin(args);
  }

  // Unbound or non-function variable.
  if (fnVal === undefined) {
    throw new SproutRuntimeError(`Unbound identifier: '${expr.callee}'`);
  }
  throw new SproutRuntimeError(`'${expr.callee}' is not a function (got ${fnVal.kind})`);
}

function evalWhile(expr: WhileExpr, env: Env): Drawing {
  const drawings: Drawing[] = [];
  while (true) {
    const cond = evalExpr(expr.cond, env);
    if (cond.kind !== 'bool') {
      throw new SproutRuntimeError(`while: condition must be bool, got ${cond.kind}`);
    }
    if (!cond.value) break;
    drawings.push(evalBlock(expr.body, env));
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}

function evalForEach(expr: ForEachExpr, env: Env): Drawing {
  const listVal = evalExpr(expr.list, env);
  if (listVal.kind !== 'list') {
    throw new SproutRuntimeError(`for each: expected list, got ${listVal.kind}`);
  }
  const drawings: Drawing[] = [];
  for (const item of listVal.items) {
    const childEnv = envExtend(env, [[expr.item, item]]);
    drawings.push(evalBlock(expr.body, childEnv));
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
        if (onExpr.event.name === 'timer' && onExpr.interval !== null) {
          const n = assertNumber(evalExpr(onExpr.interval, env), 'on timer');
          if (n.value <= 0) {
            throw new SproutRuntimeError(`on timer: interval must be a positive number, got ${n.value}`);
          }
          _timerInterval = n.value;
        }
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
  _hudValues = new Map();
  _timerInterval = 200;
  _stopTimer = false;
  _turtleX = 0;
  _turtleY = 0;
  _turtleHeading = 0;
  let env: Env = initialEnv;
  const drawings: Drawing[] = [];

  try {
    for (const stmt of program.stmts) {
      const [val, newEnv] = evalStmtWithEnv(stmt, env);
      env = newEnv;
      // null → no visual contribution (DefStmt / OnExpr)
      if (val !== null && isDrawing(val)) {
        drawings.push(val);
      }
    }
  } catch (e) {
    if (e instanceof ReturnSignal) {
      throw new SproutRuntimeError('return can only be used inside a function');
    }
    throw e;
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
): { drawing: Drawing; handlers: Map<string, SproutFunction>; hud: Record<string, string>; variables: Record<string, string>; timerInterval: number; stopTimer: boolean } {
  _hudValues = new Map();
  _timerInterval = 200;
  _stopTimer = false;
  _turtleX = 0;
  _turtleY = 0;
  _turtleHeading = 0;
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
    hud: Object.fromEntries(_hudValues),
    variables: extractVariables(env),
    timerInterval: _timerInterval,
    stopTimer: _stopTimer,
  };
}

/**
 * Invoke a zero-parameter event handler closure and return the Drawing it
 * produces.  Returns EMPTY if the body produces a non-Drawing value.
 */
export function callHandler(fn: SproutFunction): { drawing: Drawing; hud: Record<string, string>; variables: Record<string, string>; stopTimer: boolean } {
  _hudValues = new Map();
  _stopTimer = false;
  try {
    const result = evalExpr(fn.body, fn.env);
    const drawing = isDrawing(result) ? result : EMPTY;
    return { drawing, hud: Object.fromEntries(_hudValues), variables: extractVariables(fn.env), stopTimer: _stopTimer };
  } catch (e) {
    if (e instanceof ReturnBundle) {
      return { drawing: e.drawing, hud: Object.fromEntries(_hudValues), variables: extractVariables(fn.env), stopTimer: _stopTimer };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Input name collection — AST scan for <callee>("literal") calls
// ---------------------------------------------------------------------------

export function collectInputNames(program: Program): string[] {
  return collectCalleeStringArgs(program, 'input');
}

export function collectTextInputNames(program: Program): string[] {
  return collectCalleeStringArgs(program, 'textInput');
}

function collectCalleeStringArgs(program: Program, callee: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  function walkExpr(expr: Expr): void {
    switch (expr.kind) {
      case 'CallExpr':
        if (
          expr.callee === callee &&
          expr.args.length >= 1 &&
          expr.args[0].kind === 'StringLit'
        ) {
          const name = expr.args[0].value;
          if (!seen.has(name)) { seen.add(name); result.push(name); }
        }
        for (const arg of expr.args) walkExpr(arg);
        if (expr.block !== null) walkBlock(expr.block);
        break;
      case 'InfixExpr':
        walkExpr(expr.left); walkExpr(expr.right);
        break;
      case 'UnaryExpr':
        walkExpr(expr.operand);
        break;
      case 'BlockExpr':
        walkBlock(expr);
        break;
      case 'RepeatExpr':
        walkExpr(expr.count); walkBlock(expr.body);
        break;
      case 'FillExpr':
        walkBlock(expr.body);
        break;
      case 'OnExpr':
        walkBlock(expr.body);
        break;
      case 'IfExpr':
        walkExpr(expr.cond); walkBlock(expr.then);
        if (expr.else !== null) walkBlock(expr.else);
        break;
      case 'WhileExpr':
        walkExpr(expr.cond); walkBlock(expr.body);
        break;
      case 'ForEachExpr':
        walkExpr(expr.list); walkBlock(expr.body);
        break;
    }
  }

  function walkBlock(blk: BlockExpr): void {
    for (const stmt of blk.body) walkStmt(stmt);
  }

  function walkStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case 'DefStmt': walkExpr(stmt.body); break;
      case 'ExprStmt': walkExpr(stmt.expr); break;
      case 'LetStmt': walkExpr(stmt.init); break;
      case 'AssignStmt': walkExpr(stmt.value); break;
      case 'ReturnStmt': walkExpr(stmt.value); break;
    }
  }

  for (const stmt of program.stmts) walkStmt(stmt);
  return result;
}

// ---------------------------------------------------------------------------
// interpretWithInputs and interpretFullWithInputs
// ---------------------------------------------------------------------------

/**
 * Evaluate a program and return the last `SproutValue` produced by an
 * expression statement.  Non-Drawing values (like lists, numbers, strings)
 * are returned directly instead of being discarded.  Returns `EMPTY` if
 * the program produces no expression values.
 */
export function interpretValue(
  program: Program,
  initialEnv: Env = EMPTY_ENV,
): SproutValue {
  let env: Env = initialEnv;
  let lastValue: SproutValue = EMPTY;

  for (const stmt of program.stmts) {
    const [val, newEnv] = evalStmtWithEnv(stmt, env);
    env = newEnv;
    if (val !== null) {
      lastValue = val;
    }
  }

  return lastValue;
}

export function interpretWithInputs(
  program: Program,
  inputs: ReadonlyMap<string, number>,
  initialEnv: Env = EMPTY_ENV,
): Drawing {
  const prev = _inputValues;
  _inputValues = inputs;
  try {
    return interpret(program, initialEnv);
  } finally {
    _inputValues = prev;
  }
}

export function setMousePosition(x: number, y: number): void {
  _mouseX = x;
  _mouseY = y;
}

export function setKeyState(key: string, down: boolean): void {
  if (down) _keysDown.add(key);
  else _keysDown.delete(key);
}

export function setTextInputs(values: ReadonlyMap<string, string>): void {
  _textInputValues = values;
}

export function interpretFullWithInputs(
  program: Program,
  inputs: ReadonlyMap<string, number>,
  initialEnv: Env = EMPTY_ENV,
): { drawing: Drawing; handlers: Map<string, SproutFunction>; hud: Record<string, string>; variables: Record<string, string>; timerInterval: number; stopTimer: boolean } {
  const prev = _inputValues;
  _inputValues = inputs;
  try {
    return interpretFull(program, initialEnv);
  } finally {
    _inputValues = prev;
  }
}
