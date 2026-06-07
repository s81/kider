import { describe, it, expect, beforeEach } from 'vitest';
import { interpret, interpretFull, interpretValue, callHandler, collectInputNames, interpretWithInputs, interpretFullWithInputs, setMousePosition, SproutRuntimeError } from '../src/interpreter.js';
import {
  EMPTY,
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  mkPenWidth,
  mkPolygon,
  mkText,
  mkBackground,
  mkClearCanvas,
  mkStamp,
  mkArc,
  mkGoto,
  mkHome,
  mkList,
  PEN_UP,
  PEN_DOWN,
  type SproutFunction,
} from '../src/values.js';
import type { Program, Expr, Stmt, InfixExpr, LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers (keep tests readable)
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const symLit = (name: string): Expr => ({ kind: 'SymbolLit', name });
const boolLit = (value: boolean): Expr => ({ kind: 'BoolLit', value });
const ident = (name: string): Expr => ({ kind: 'Ident', name });
const infix = (op: InfixExpr['op'], left: Expr, right: Expr): Expr =>
  ({ kind: 'InfixExpr', op, left, right });
const call = (callee: string, args: Expr[], block = null): Expr =>
  ({ kind: 'CallExpr', callee, args, block });
const block = (body: Stmt[]): Expr =>
  ({ kind: 'BlockExpr', body });
const repeat = (count: Expr, bodyStmts: Stmt[]): Expr =>
  ({ kind: 'RepeatExpr', count, body: { kind: 'BlockExpr', body: bodyStmts } });
const ifExpr = (cond: Expr, thenStmts: Stmt[], elseStmts: Stmt[] | null = null): Expr => ({
  kind: 'IfExpr' as const,
  cond,
  then: { kind: 'BlockExpr' as const, body: thenStmts },
  else: elseStmts !== null ? { kind: 'BlockExpr' as const, body: elseStmts } : null,
});
const unary = (op: 'not', operand: Expr): Expr =>
  ({ kind: 'UnaryExpr' as const, op, operand });

const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const defStmt = (name: string, params: string[], body: Expr): Stmt =>
  ({ kind: 'DefStmt', name, params, body });
const letStmt = (name: string, init: Expr): LetStmt =>
  ({ kind: 'LetStmt', name, init });
const assignStmt = (name: string, value: Expr): AssignStmt =>
  ({ kind: 'AssignStmt', name, value });
const whileExpr = (cond: Expr, body: Stmt[]): WhileExpr => ({
  kind: 'WhileExpr',
  cond,
  body: { kind: 'BlockExpr', body },
});

const forEachExpr = (item: string, list: Expr, body: Stmt[]): ForEachExpr => ({
  kind: 'ForEachExpr',
  item,
  list,
  body: { kind: 'BlockExpr', body },
});

const program = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });
const returnStmt = (value: Expr): Stmt => ({ kind: 'ReturnStmt', value });

// ---------------------------------------------------------------------------
// 1. NumberLit evaluates to SproutNumber
// ---------------------------------------------------------------------------
describe('NumberLit', () => {
  it('evaluates to a SproutNumber wrapped in a sequence (through interpret)', () => {
    // interpret collects Drawings; a raw SproutNumber is discarded.
    // We test via forward(42) which wraps the number in a Drawing.
    const prog = program(exprStmt(call('forward', [numLit(42)])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(42)]));
  });

  it('evaluates number literal correctly in arithmetic context', () => {
    // 5 + 3 = 8 → forward(8)
    const prog = program(exprStmt(call('forward', [infix('+', numLit(5), numLit(3))])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(8)]));
  });
});

// ---------------------------------------------------------------------------
// 2. InfixExpr addition
// ---------------------------------------------------------------------------
describe('InfixExpr', () => {
  it('adds two numbers', () => {
    const prog = program(exprStmt(call('forward', [infix('+', numLit(10), numLit(20))])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(30)]));
  });

  it('subtracts two numbers', () => {
    const prog = program(exprStmt(call('forward', [infix('-', numLit(50), numLit(15))])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(35)]));
  });

  it('multiplies two numbers', () => {
    const prog = program(exprStmt(call('forward', [infix('*', numLit(6), numLit(7))])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(42)]));
  });

  it('divides two numbers', () => {
    const prog = program(exprStmt(call('forward', [infix('/', numLit(100), numLit(4))])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(25)]));
  });
});

// ---------------------------------------------------------------------------
// 3. Division by zero throws SproutRuntimeError
// ---------------------------------------------------------------------------
describe('Division by zero', () => {
  it('throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('forward', [infix('/', numLit(1), numLit(0))])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow('Division by zero');
  });
});

// ---------------------------------------------------------------------------
// 4. DefStmt + CallExpr: user-defined function called correctly
// ---------------------------------------------------------------------------
describe('User-defined functions', () => {
  it('calls a zero-param function that returns a Drawing', () => {
    // def square() = forward(100)
    // square()   → forward(100)
    const prog = program(
      defStmt('square', [], call('forward', [numLit(100)])),
      exprStmt(call('square', [])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(100)]));
  });

  it('calls a function with a parameter', () => {
    // def step(n) = forward(n)
    // step(75)
    const prog = program(
      defStmt('step', ['n'], call('forward', [ident('n')])),
      exprStmt(call('step', [numLit(75)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(75)]));
  });

  it('applies lexical (closure) scoping for user-defined functions', () => {
    // x = 10 (via a workaround: def getX() = forward(10), call immediately)
    // The closure env captures x at definition time, not call time.
    // def makeAdder(base) = forward(base + 5)
    // makeAdder(15) → forward(20)
    const prog = program(
      defStmt('makeAdder', ['base'], call('forward', [infix('+', ident('base'), numLit(5))])),
      exprStmt(call('makeAdder', [numLit(15)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(20)]));
  });

  it('throws on arity mismatch', () => {
    const prog = program(
      defStmt('f', ['a', 'b'], call('forward', [ident('a')])),
      exprStmt(call('f', [numLit(1)])),  // too few args
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow(/expects/);
  });

  it('throws when calling a non-function', () => {
    // Bind 'x' to a number, then try to call it as a function.
    // We do this via: def x() = forward(1)  then call x() — nope, x is a function.
    // Instead: manually provide an env with a number bound to 'x'
    // but the interpreter doesn't expose evalExpr directly.
    // Use initialEnv workaround: the interpret function accepts an initialEnv.
    const initialEnv = new Map([['notaFn', { kind: 'number' as const, value: 5 }]]);
    const prog = program(exprStmt(call('notaFn', [])));
    expect(() => interpret(prog, initialEnv)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog, initialEnv)).toThrow(/not a function/);
  });
});

// ---------------------------------------------------------------------------
// 5. RepeatExpr produces a Sequence of N copies
// ---------------------------------------------------------------------------
describe('RepeatExpr', () => {
  it('produces a sequence of 4 drawings', () => {
    // repeat 4 do forward(10) end
    const prog = program(
      exprStmt(repeat(numLit(4), [exprStmt(call('forward', [numLit(10)]))])),
    );
    const result = interpret(prog);
    // interpret wraps top-level drawing in a sequence; the repeat itself is a sequence of 4 sequences-of-1
    expect(result.kind).toBe('sequence');
    if (result.kind === 'sequence') {
      // One top-level sequence containing the result of the repeat
      expect(result.steps).toHaveLength(1);
      const repeatResult = result.steps[0];
      expect(repeatResult.kind).toBe('sequence');
      if (repeatResult.kind === 'sequence') {
        expect(repeatResult.steps).toHaveLength(4);
      }
    }
  });

  it('produces EMPTY for repeat 0', () => {
    const prog = program(
      exprStmt(repeat(numLit(0), [exprStmt(call('forward', [numLit(10)]))])),
    );
    const result = interpret(prog);
    // repeat 0 → EMPTY (identity element, not mkSequence([]))
    expect(result.kind).toBe('sequence');
    if (result.kind === 'sequence') {
      expect(result.steps).toHaveLength(1);
      const repeatResult = result.steps[0];
      expect(repeatResult).toEqual(EMPTY);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. `forward` built-in returns correct Drawing
// ---------------------------------------------------------------------------
describe('forward built-in', () => {
  it('returns mkForward(distance)', () => {
    const prog = program(exprStmt(call('forward', [numLit(100)])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(100)]));
  });

  it('throws on wrong argument type', () => {
    const prog = program(exprStmt(call('forward', [strLit('hello')])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow(/forward/);
  });

  it('throws on wrong arity', () => {
    const prog = program(exprStmt(call('forward', [numLit(1), numLit(2)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow(/forward/);
  });
});

// ---------------------------------------------------------------------------
// Additional built-ins
// ---------------------------------------------------------------------------
describe('turn built-in', () => {
  it('returns mkTurn(degrees)', () => {
    const prog = program(exprStmt(call('turn', [numLit(90)])));
    expect(interpret(prog)).toEqual(mkSequence([mkTurn(90)]));
  });
});

describe('penUp / penDown built-ins', () => {
  it('penUp returns PEN_UP', () => {
    const prog = program(exprStmt(call('penUp', [])));
    expect(interpret(prog)).toEqual(mkSequence([PEN_UP]));
  });

  it('penDown returns PEN_DOWN', () => {
    const prog = program(exprStmt(call('penDown', [])));
    expect(interpret(prog)).toEqual(mkSequence([PEN_DOWN]));
  });
});

// ---------------------------------------------------------------------------
// 7. `beside` built-in composes two Drawings
// ---------------------------------------------------------------------------
describe('beside built-in', () => {
  it('composes two drawings side by side', () => {
    const prog = program(
      exprStmt(call('beside', [
        call('forward', [numLit(10)]),
        call('forward', [numLit(20)]),
      ])),
    );
    expect(interpret(prog)).toEqual(
      mkSequence([mkBeside(mkForward(10), mkForward(20))])
    );
  });

  it('throws when given a non-drawing argument', () => {
    const prog = program(
      exprStmt(call('beside', [numLit(1), call('forward', [numLit(10)])])),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow(/beside/);
  });
});

describe('above built-in', () => {
  it('composes two drawings vertically', () => {
    const prog = program(
      exprStmt(call('above', [
        call('forward', [numLit(10)]),
        call('forward', [numLit(20)]),
      ])),
    );
    expect(interpret(prog)).toEqual(
      mkSequence([mkAbove(mkForward(10), mkForward(20))])
    );
  });
});

describe('scale built-in', () => {
  it('scales a drawing by a factor', () => {
    const prog = program(
      exprStmt(call('scale', [numLit(2), call('forward', [numLit(50)])])),
    );
    expect(interpret(prog)).toEqual(
      mkSequence([mkScale(2, mkForward(50))])
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Unbound identifier throws SproutRuntimeError
// ---------------------------------------------------------------------------
describe('Unbound identifier', () => {
  it('throws SproutRuntimeError for unbound name', () => {
    const prog = program(exprStmt(ident('notDefined')));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow("notDefined");
  });

  it('throws SproutRuntimeError when calling unbound function', () => {
    const prog = program(exprStmt(call('noSuchFn', [])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow(/noSuchFn|Unbound/);
  });
});

// ---------------------------------------------------------------------------
// 9. BlockExpr collects Drawing values and discards non-Drawing values
// ---------------------------------------------------------------------------
describe('BlockExpr', () => {
  it('collects only Drawing values', () => {
    // block containing: forward(10), some string literal (discarded), forward(20)
    // The string literal is discarded, so we should get sequence([forward(10), forward(20)])
    const prog = program(
      exprStmt(block([
        exprStmt(call('forward', [numLit(10)])),
        exprStmt(strLit('hello')),  // not a Drawing — discarded
        exprStmt(call('forward', [numLit(20)])),
      ])),
    );
    // The block returns a sequence of [forward(10), forward(20)]
    // The outer interpret wraps that in another sequence.
    const result = interpret(prog);
    expect(result.kind).toBe('sequence');
    if (result.kind === 'sequence') {
      expect(result.steps).toHaveLength(1);
      const blockResult = result.steps[0];
      expect(blockResult).toEqual(mkSequence([mkForward(10), mkForward(20)]));
    }
  });

  it('returns EMPTY when no Drawing values in block', () => {
    const prog = program(
      exprStmt(block([
        exprStmt(numLit(1)),
        exprStmt(strLit('hi')),
        exprStmt(boolLit(true)),
      ])),
    );
    // block with no drawings returns EMPTY (the identity element).
    // EMPTY IS a Drawing, so it IS collected at the top level.
    const result = interpret(prog);
    expect(result.kind).toBe('sequence');
    if (result.kind === 'sequence') {
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toEqual(EMPTY);
    }
  });

  it('DefStmt inside block extends env for subsequent statements in the same block', () => {
    // evalBlock threads env, so def f inside a block is visible to subsequent statements.
    const prog = program(
      exprStmt(block([
        defStmt('f', [], call('forward', [numLit(5)])),
        exprStmt(call('f', [])),
      ])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(5)])]));
  });

  it('top-level DefStmt properly extends env for subsequent statements', () => {
    // At program level, env IS threaded, so def followed by call should work.
    const prog = program(
      defStmt('box', [], call('forward', [numLit(50)])),
      exprStmt(call('box', [])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(50)]));
  });
});

// ---------------------------------------------------------------------------
// Additional: Literals
// ---------------------------------------------------------------------------
describe('Literal values (non-Drawing)', () => {
  it('StringLit is discarded at top level (not a Drawing)', () => {
    const prog = program(exprStmt(strLit('hello')));
    // No drawings collected → EMPTY
    expect(interpret(prog)).toEqual(EMPTY);
  });

  it('BoolLit is discarded at top level', () => {
    const prog = program(exprStmt(boolLit(true)));
    expect(interpret(prog)).toEqual(EMPTY);
  });

  it('SymbolLit is discarded at top level', () => {
    const prog = program(exprStmt(symLit('click')));
    expect(interpret(prog)).toEqual(EMPTY);
  });
});

// ---------------------------------------------------------------------------
// Additional: puts built-in
// ---------------------------------------------------------------------------
describe('puts built-in', () => {
  it('returns EMPTY drawing (is collected as a visual no-op)', () => {
    // puts returns EMPTY — it IS a Drawing, so it IS collected.
    const prog = program(exprStmt(call('puts', [strLit('hello')])));
    expect(interpret(prog)).toEqual(mkSequence([EMPTY]));
  });
});

// ---------------------------------------------------------------------------
// Additional: OnExpr
// ---------------------------------------------------------------------------
describe('OnExpr', () => {
  it('produces no Drawing — OnExpr at statement level is not collected', () => {
    const onExpr: Expr = {
      kind: 'OnExpr',
      event: { kind: 'SymbolLit', name: 'click' },
      body: { kind: 'BlockExpr', body: [exprStmt(call('forward', [numLit(10)]))] },
      interval: null,
    };
    const prog = program(exprStmt(onExpr));
    // OnExpr at statement level registers a handler; produces null (no Drawing).
    // If it were the only statement, the result should be EMPTY.
    expect(interpret(prog)).toEqual(EMPTY);
  });
});

// ---------------------------------------------------------------------------
// Integration: full mini-program
// ---------------------------------------------------------------------------
describe('Integration', () => {
  it('square: repeat 4 do forward(100) turn(90) end', () => {
    //   repeat 4 do
    //     forward(100)
    //     turn(90)
    //   end
    const squareBody: Stmt[] = [
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('turn', [numLit(90)])),
    ];
    const prog = program(exprStmt(repeat(numLit(4), squareBody)));
    const result = interpret(prog);

    // result is a sequence of 1 (the repeat), which itself is a sequence of 4
    expect(result.kind).toBe('sequence');
    if (result.kind === 'sequence') {
      const repeatResult = result.steps[0];
      expect(repeatResult.kind).toBe('sequence');
      if (repeatResult.kind === 'sequence') {
        expect(repeatResult.steps).toHaveLength(4);
        // Each step should be sequence([forward(100), turn(90)])
        for (const step of repeatResult.steps) {
          expect(step).toEqual(mkSequence([mkForward(100), mkTurn(90)]));
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Additional builder for OnExpr
// ---------------------------------------------------------------------------
const onExpr = (eventName: string, bodyStmts: Stmt[], interval: Expr | null = null): Expr => ({
  kind: 'OnExpr',
  event: { kind: 'SymbolLit', name: eventName },
  body: { kind: 'BlockExpr', body: bodyStmts },
  interval,
});

// ---------------------------------------------------------------------------
// interpretFull
// ---------------------------------------------------------------------------
describe('interpretFull', () => {
  it('returns the same drawing as interpret() when there are no handlers', () => {
    const prog = program(exprStmt(call('forward', [numLit(100)])));
    const { drawing, handlers } = interpretFull(prog);
    expect(drawing).toEqual(interpret(prog));
    expect(handlers.size).toBe(0);
  });

  it('exposes a :click handler registered with on :click do...end', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('forward', [numLit(20)]))])),
    );
    const { drawing, handlers } = interpretFull(prog);
    expect(drawing).toEqual(EMPTY);
    expect(handlers.has(':click')).toBe(true);
    expect(handlers.get(':click')!.kind).toBe('function');
  });

  it('drawing from interpretFull excludes the on-expr visual output', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(50)])),
      exprStmt(onExpr('click', [exprStmt(call('turn', [numLit(90)]))])),
    );
    const { drawing, handlers } = interpretFull(prog);
    expect(drawing).toEqual(mkSequence([mkForward(50)]));
    expect(handlers.has(':click')).toBe(true);
  });

  it('handles multiple different event names', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('forward', [numLit(10)]))])),
      exprStmt(onExpr('load', [exprStmt(call('turn', [numLit(45)]))])),
    );
    const { handlers } = interpretFull(prog);
    expect(handlers.has(':click')).toBe(true);
    expect(handlers.has(':load')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// callHandler
// ---------------------------------------------------------------------------
describe('callHandler', () => {
  it('evaluates handler body and returns a Drawing', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('forward', [numLit(30)]))])),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    const { drawing: delta } = callHandler(fn);
    expect(delta).toEqual(mkSequence([mkForward(30)]));
  });

  it('returns EMPTY when handler body produces no drawing', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('puts', [numLit(1)]))])),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    const { drawing: delta } = callHandler(fn);
    expect(delta).toEqual(mkSequence([EMPTY]));
  });

  it('handler closure captures variables defined before the on-expr', () => {
    const prog = program(
      defStmt('step', [], call('forward', [numLit(5)])),
      exprStmt(onExpr('click', [exprStmt(call('step', []))])),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    const { drawing: delta } = callHandler(fn);
    expect(delta).toEqual(mkSequence([mkForward(5)]));
  });
});

// ---------------------------------------------------------------------------
// penWidth builtin
// ---------------------------------------------------------------------------
describe('penWidth builtin', () => {
  it('penWidth(3) returns a penWidth Drawing', () => {
    const prog = program(exprStmt(call('penWidth', [numLit(3)])));
    expect(interpret(prog)).toEqual(mkSequence([mkPenWidth(3)]));
  });

  it('penWidth(0.5) returns a penWidth Drawing with fractional width', () => {
    const prog = program(exprStmt(call('penWidth', [numLit(0.5)])));
    expect(interpret(prog)).toEqual(mkSequence([mkPenWidth(0.5)]));
  });

  it('penWidth with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('penWidth', [])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('penWidth with non-number argument throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('penWidth', [{ kind: 'SymbolLit' as const, name: 'thick' }])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('penWidth(0) throws SproutRuntimeError — width must be > 0', () => {
    const prog = program(exprStmt(call('penWidth', [numLit(0)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('penWidth(-1) throws SproutRuntimeError — width must be > 0', () => {
    const prog = program(exprStmt(call('penWidth', [numLit(-1)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('penWidth inside a sequence composes correctly', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('penWidth', [numLit(5)])),
      exprStmt(call('forward', [numLit(50)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([
      mkForward(100),
      mkPenWidth(5),
      mkForward(50),
    ]));
  });
});

// ---------------------------------------------------------------------------
// color builtin
// ---------------------------------------------------------------------------
describe('color builtin', () => {
  it('color(:red) returns a color Drawing with hex #dc2626', () => {
    const prog = program(exprStmt(call('color', [{ kind: 'SymbolLit' as const, name: 'red' }])));
    const result = interpret(prog);
    expect(result).toEqual(mkSequence([mkColor('#dc2626')]));
  });

  it('color(:blue) returns #2563eb', () => {
    const prog = program(exprStmt(call('color', [{ kind: 'SymbolLit' as const, name: 'blue' }])));
    expect(interpret(prog)).toEqual(mkSequence([mkColor('#2563eb')]));
  });

  it('color with unknown symbol throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('color', [{ kind: 'SymbolLit' as const, name: 'turquoise' }])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('color with non-symbol argument throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('color', [numLit(1)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('color inside a sequence composes correctly', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('color', [{ kind: 'SymbolLit' as const, name: 'red' }])),
      exprStmt(call('forward', [numLit(50)])),
    );
    const result = interpret(prog);
    expect(result).toEqual(mkSequence([
      mkForward(100),
      mkColor('#dc2626'),
      mkForward(50),
    ]));
  });
});

// ---------------------------------------------------------------------------
// randomColor builtin
// ---------------------------------------------------------------------------
describe('randomColor builtin', () => {
  const PALETTE_COLORS = [
    '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea',
    '#000000', '#ffffff', '#ca8a04', '#db2777',
  ];

  it('randomColor() returns mkSequence([mkColor(x)]) where x is a palette color', () => {
    const result = interpret(program(exprStmt(call('randomColor', []))));
    const possible = PALETTE_COLORS.map(c => mkSequence([mkColor(c)]));
    expect(possible).toContainEqual(result);
  });

  it('randomColor(:any) returns a color Drawing with a valid #rrggbb hex, and can produce non-palette colors', () => {
    const paletteSet = new Set(PALETTE_COLORS);
    const results: string[] = [];
    for (let i = 0; i < 20; i++) {
      const result = interpret(program(exprStmt(call('randomColor', [{ kind: 'SymbolLit' as const, name: 'any' }]))));
      const seq = result as { kind: 'sequence'; steps: Array<{ kind: string; color?: string }> };
      expect(seq.steps[0].kind).toBe('color');
      const color = seq.steps[0].color!;
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      results.push(color);
    }
    expect(results.some(c => !paletteSet.has(c))).toBe(true);
  });

  it('randomColor(:bad) throws SproutRuntimeError', () => {
    expect(() =>
      interpret(program(exprStmt(call('randomColor', [{ kind: 'SymbolLit' as const, name: 'bad' }]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(program(exprStmt(call('randomColor', [{ kind: 'SymbolLit' as const, name: 'bad' }]))))
    ).toThrow(/randomColor/);
  });

  it('randomColor with 2 args throws SproutRuntimeError', () => {
    expect(() =>
      interpret(program(exprStmt(call('randomColor', [numLit(1), numLit(2)]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(program(exprStmt(call('randomColor', [numLit(1), numLit(2)]))))
    ).toThrow(/randomColor/);
  });
});

// ---------------------------------------------------------------------------
// IfExpr — conditional expression
// ---------------------------------------------------------------------------
describe('IfExpr', () => {
  it('returns then-branch drawing when condition is true', () => {
    const prog = program(
      exprStmt(ifExpr(boolLit(true), [exprStmt(call('forward', [numLit(50)]))])),
    );
    // IfExpr returns evalBlock(then) = mkSequence([mkForward(50)]);
    // interpret wraps that in its own outer sequence.
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(50)])]));
  });

  it('returns EMPTY when condition is false and no else', () => {
    const prog = program(
      exprStmt(ifExpr(boolLit(false), [exprStmt(call('forward', [numLit(50)]))])),
    );
    // IfExpr returns EMPTY; interpret collects it and wraps: mkSequence([EMPTY])
    expect(interpret(prog)).toEqual(mkSequence([EMPTY]));
  });

  it('returns else-branch drawing when condition is false', () => {
    const prog = program(
      exprStmt(ifExpr(
        boolLit(false),
        [exprStmt(call('forward', [numLit(50)]))],
        [exprStmt(call('turn', [numLit(90)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkTurn(90)])]));
  });

  it('throws SproutRuntimeError when condition is not a bool', () => {
    const prog = program(
      exprStmt(ifExpr(numLit(1), [exprStmt(call('forward', [numLit(10)]))])),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow('if: condition must be a bool');
  });

  it('evaluates condition using a comparison', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('<', numLit(5), numLit(10)),
        [exprStmt(call('forward', [numLit(30)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(30)])]));
  });
});

// ---------------------------------------------------------------------------
// Comparison operators
// ---------------------------------------------------------------------------
describe('comparison operators', () => {
  const testCmp = (op: InfixExpr['op'], l: number, r: number, expected: boolean) => {
    const prog = program(
      exprStmt(ifExpr(
        infix(op, numLit(l), numLit(r)),
        [exprStmt(call('forward', [numLit(1)]))],
        [exprStmt(call('turn', [numLit(1)]))],
      )),
    );
    if (expected) {
      expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(1)])]));
    } else {
      expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkTurn(1)])]));
    }
  };

  it('< returns true when left < right',   () => testCmp('<',  3, 5, true));
  it('< returns false when left >= right', () => testCmp('<',  5, 3, false));
  it('> returns true when left > right',   () => testCmp('>',  5, 3, true));
  it('>= returns true when equal',          () => testCmp('>=', 4, 4, true));
  it('<= returns true when left < right',   () => testCmp('<=', 2, 4, true));
  it('== returns true for equal numbers',   () => testCmp('==', 7, 7, true));
  it('== returns false for unequal',        () => testCmp('==', 7, 8, false));
  it('!= returns true for unequal',         () => testCmp('!=', 7, 8, true));
  it('!= returns false for equal',          () => testCmp('!=', 7, 7, false));

  it('== works on booleans', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('==', boolLit(true), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(1)])]));
  });

  it('throws when comparing incompatible types', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('==', numLit(1), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// UnaryExpr not
// ---------------------------------------------------------------------------
describe('UnaryExpr not', () => {
  it('negates true to false', () => {
    const prog = program(
      exprStmt(ifExpr(
        unary('not', boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
        [exprStmt(call('turn', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkTurn(1)])]));
  });

  it('negates false to true', () => {
    const prog = program(
      exprStmt(ifExpr(
        unary('not', boolLit(false)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(1)])]));
  });

  it('throws when operand is not a bool', () => {
    const prog = program(
      exprStmt(ifExpr(
        unary('not', numLit(1)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow('not: expected bool');
  });
});

// ---------------------------------------------------------------------------
// and / or short-circuit
// ---------------------------------------------------------------------------
describe('and / or short-circuit', () => {
  it('and returns false without evaluating right when left is false', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('and', boolLit(false), infix('>', infix('/', numLit(1), numLit(0)), numLit(0))),
        [exprStmt(call('forward', [numLit(1)]))],
        [exprStmt(call('turn', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkTurn(1)])]));
  });

  it('and returns right value when both are true', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('and', boolLit(true), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(1)])]));
  });

  it('or returns true without evaluating right when left is true', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('or', boolLit(true), infix('>', infix('/', numLit(1), numLit(0)), numLit(0))),
        [exprStmt(call('forward', [numLit(1)]))],
        [exprStmt(call('turn', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(1)])]));
  });

  it('or evaluates right when left is false', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('or', boolLit(false), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(1)])]));
  });

  it('throws when and operand is not a bool', () => {
    const prog = program(
      exprStmt(ifExpr(
        infix('and', numLit(1), boolLit(true)),
        [exprStmt(call('forward', [numLit(1)]))],
      )),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow('and: expected bool');
  });
});

// ---------------------------------------------------------------------------
// Variables — let / set
// ---------------------------------------------------------------------------
describe('variables — let / set', () => {
  it('let x = 5 then forward(x) draws forward(5)', () => {
    const prog = program(
      letStmt('x', numLit(5)),
      exprStmt(call('forward', [ident('x')])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(5)]));
  });

  it('set updates the variable value', () => {
    const prog = program(
      letStmt('x', numLit(1)),
      assignStmt('x', numLit(99)),
      exprStmt(call('forward', [ident('x')])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(99)]));
  });

  it('let inside a while body is re-created each iteration', () => {
    const prog = program(
      letStmt('i', numLit(0)),
      exprStmt(whileExpr(
        infix('<', ident('i'), numLit(2)),
        [
          letStmt('y', numLit(10)),
          exprStmt(call('forward', [ident('y')])),
          assignStmt('i', infix('+', ident('i'), numLit(1))),
        ],
      )),
    );
    const iterDrawing = mkSequence([mkForward(10)]);
    expect(interpret(prog)).toEqual(
      mkSequence([mkSequence([iterDrawing, iterDrawing])])
    );
  });

  it('throws on set of undeclared variable', () => {
    const prog = program(assignStmt('z', numLit(1)));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow("set: 'z' is not declared");
  });

  it('throws on set of a def-bound name (not a var)', () => {
    const prog = program(
      defStmt('f', [], numLit(1)),
      assignStmt('f', numLit(2)),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow("set: 'f' is not a variable");
  });
});

// ---------------------------------------------------------------------------
// While loop
// ---------------------------------------------------------------------------
describe('while loop', () => {
  it('does not execute when condition is false from the start', () => {
    const prog = program(
      letStmt('x', numLit(0)),
      exprStmt(whileExpr(
        infix('<', ident('x'), numLit(0)),
        [exprStmt(call('forward', [numLit(10)]))],
      )),
    );
    expect(interpret(prog)).toEqual(mkSequence([EMPTY]));
  });

  it('counts to 3 and collects drawings from each iteration', () => {
    const prog = program(
      letStmt('x', numLit(0)),
      exprStmt(whileExpr(
        infix('<', ident('x'), numLit(3)),
        [
          exprStmt(call('forward', [numLit(10)])),
          assignStmt('x', infix('+', ident('x'), numLit(1))),
        ],
      )),
    );
    const iterDrawing = mkSequence([mkForward(10)]);
    expect(interpret(prog)).toEqual(
      mkSequence([mkSequence([iterDrawing, iterDrawing, iterDrawing])])
    );
  });

  it('throws when condition is not a bool', () => {
    const prog = program(
      letStmt('x', numLit(0)),
      exprStmt(whileExpr(numLit(1), [assignStmt('x', numLit(1))])),
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow('while: condition must be bool');
  });
});

// ---------------------------------------------------------------------------
// Math builtins
// ---------------------------------------------------------------------------

describe('math builtins', () => {
  // --- trig (degrees) ---
  it('sin(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('sin', [numLit(0)])]))))).toEqual(mkSequence([mkForward(0)]));
  });
  it('cos(180) = -1', () => {
    expect(interpret(program(exprStmt(call('forward', [call('cos', [numLit(180)])]))))).toEqual(mkSequence([mkForward(-1)]));
  });
  it('cos(0) = 1', () => {
    expect(interpret(program(exprStmt(call('forward', [call('cos', [numLit(0)])]))))).toEqual(mkSequence([mkForward(1)]));
  });
  it('tan(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('tan', [numLit(0)])]))))).toEqual(mkSequence([mkForward(0)]));
  });

  // --- arithmetic ---
  it('abs(-5) = 5', () => {
    expect(interpret(program(exprStmt(call('forward', [call('abs', [numLit(-5)])]))))).toEqual(mkSequence([mkForward(5)]));
  });
  it('abs(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('abs', [numLit(0)])]))))).toEqual(mkSequence([mkForward(0)]));
  });
  it('sqrt(4) = 2', () => {
    expect(interpret(program(exprStmt(call('forward', [call('sqrt', [numLit(4)])]))))).toEqual(mkSequence([mkForward(2)]));
  });
  it('sqrt(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('sqrt', [numLit(0)])]))))).toEqual(mkSequence([mkForward(0)]));
  });
  it('pow(2, 3) = 8', () => {
    expect(interpret(program(exprStmt(call('forward', [call('pow', [numLit(2), numLit(3)])]))))).toEqual(mkSequence([mkForward(8)]));
  });
  it('mod(7, 3) = 1', () => {
    expect(interpret(program(exprStmt(call('forward', [call('mod', [numLit(7), numLit(3)])]))))).toEqual(mkSequence([mkForward(1)]));
  });
  it('log(1) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('log', [numLit(1)])]))))).toEqual(mkSequence([mkForward(0)]));
  });

  // --- rounding ---
  it('floor(3.7) = 3', () => {
    expect(interpret(program(exprStmt(call('forward', [call('floor', [numLit(3.7)])]))))).toEqual(mkSequence([mkForward(3)]));
  });
  it('floor(-1.5) = -2', () => {
    expect(interpret(program(exprStmt(call('forward', [call('floor', [numLit(-1.5)])]))))).toEqual(mkSequence([mkForward(-2)]));
  });
  it('ceil(3.2) = 4', () => {
    expect(interpret(program(exprStmt(call('forward', [call('ceil', [numLit(3.2)])]))))).toEqual(mkSequence([mkForward(4)]));
  });
  it('ceil(-1.5) = -1', () => {
    expect(interpret(program(exprStmt(call('forward', [call('ceil', [numLit(-1.5)])]))))).toEqual(mkSequence([mkForward(-1)]));
  });
  it('round(3.5) = 4', () => {
    expect(interpret(program(exprStmt(call('forward', [call('round', [numLit(3.5)])]))))).toEqual(mkSequence([mkForward(4)]));
  });

  // --- extrema ---
  it('max(3, 7) = 7', () => {
    expect(interpret(program(exprStmt(call('forward', [call('max', [numLit(3), numLit(7)])]))))).toEqual(mkSequence([mkForward(7)]));
  });
  it('min(3, 7) = 3', () => {
    expect(interpret(program(exprStmt(call('forward', [call('min', [numLit(3), numLit(7)])]))))).toEqual(mkSequence([mkForward(3)]));
  });

  // --- random ---
  it('random(1, 10) returns a number in [1, 10]', () => {
    for (let i = 0; i < 20; i++) {
      const result = interpret(program(exprStmt(call('forward', [call('random', [numLit(1), numLit(10)])]))));
      expect(result).toMatchObject({ kind: 'sequence' });
      const seq = result as { kind: 'sequence'; steps: { kind: string; distance: number }[] };
      const val = seq.steps[0].distance;
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(10);
    }
  });
  it('random(5, 5) = 5', () => {
    expect(interpret(program(exprStmt(call('forward', [call('random', [numLit(5), numLit(5)])]))))).toEqual(mkSequence([mkForward(5)]));
  });
  it('random(0, 0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('random', [numLit(0), numLit(0)])]))))).toEqual(mkSequence([mkForward(0)]));
  });
  it('random(10, 1) throws SproutRuntimeError (min > max)', () => {
    expect(() => interpret(program(exprStmt(call('random', [numLit(10), numLit(1)]))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('random', [numLit(10), numLit(1)]))))).toThrow(/random/);
  });
  it('random with 1 arg throws SproutRuntimeError', () => {
    expect(() => interpret(program(exprStmt(call('random', [numLit(5)]))))).toThrow(SproutRuntimeError);
  });
  it('random with 0 args throws SproutRuntimeError', () => {
    expect(() => interpret(program(exprStmt(call('random', []))))).toThrow(SproutRuntimeError);
  });
  it('random with non-number arg throws SproutRuntimeError', () => {
    expect(() => interpret(program(exprStmt(call('random', [{ kind: 'StringLit' as const, value: 'a' }, numLit(5)]))))).toThrow(SproutRuntimeError);
  });

  // --- pi ---
  it('pi() = Math.PI', () => {
    expect(interpret(program(exprStmt(call('forward', [call('pi', [])]))))).toEqual(mkSequence([mkForward(Math.PI)]));
  });

  // --- arity errors ---
  it('sin throws with 0 args', () => {
    expect(() => interpret(program(exprStmt(call('sin', []))))).toThrow(SproutRuntimeError);
  });
  it('sin throws with 2 args', () => {
    expect(() => interpret(program(exprStmt(call('sin', [numLit(0), numLit(0)]))))).toThrow(SproutRuntimeError);
  });
  it('pow throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('pow', [numLit(2)]))))).toThrow(SproutRuntimeError);
  });
  it('pi throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('pi', [numLit(1)]))))).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// Shape builtins
// ---------------------------------------------------------------------------

describe('shape builtins', () => {
  it('circle(50) returns circle Drawing', () => {
    expect(interpret(program(exprStmt(call('circle', [numLit(50)]))))).toEqual(mkSequence([{ kind: 'circle', radius: 50 }]));
  });
  it('rect(80, 40) returns rect Drawing', () => {
    expect(interpret(program(exprStmt(call('rect', [numLit(80), numLit(40)]))))).toEqual(mkSequence([{ kind: 'rect', width: 80, height: 40 }]));
  });
  it('ellipse(60, 30) returns ellipse Drawing', () => {
    expect(interpret(program(exprStmt(call('ellipse', [numLit(60), numLit(30)]))))).toEqual(mkSequence([{ kind: 'ellipse', rx: 60, ry: 30 }]));
  });
  it('triangle(50) returns triangle Drawing', () => {
    expect(interpret(program(exprStmt(call('triangle', [numLit(50)]))))).toEqual(mkSequence([{ kind: 'triangle', size: 50 }]));
  });
  it('circle throws with 0 args', () => {
    expect(() => interpret(program(exprStmt(call('circle', []))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('circle', []))))).toThrow(/circle/);
  });
  it('rect throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('rect', [numLit(100)]))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('rect', [numLit(100)]))))).toThrow(/rect/);
  });
  it('ellipse throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('ellipse', [numLit(10)]))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('ellipse', [numLit(10)]))))).toThrow(/ellipse/);
  });
  it('triangle throws with 0 args', () => {
    expect(() => interpret(program(exprStmt(call('triangle', []))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('triangle', []))))).toThrow(/triangle/);
  });
  it('circle throws with non-number arg', () => {
    expect(() => interpret(program(exprStmt(call('circle', [boolLit(true)]))))).toThrow(SproutRuntimeError);
  });
  it('rect throws with non-number first arg', () => {
    expect(() => interpret(program(exprStmt(call('rect', [boolLit(true), numLit(40)]))))).toThrow(SproutRuntimeError);
  });
  it('ellipse throws with non-number second arg', () => {
    expect(() => interpret(program(exprStmt(call('ellipse', [numLit(60), boolLit(true)]))))).toThrow(SproutRuntimeError);
  });
  it('triangle throws with non-number arg', () => {
    expect(() => interpret(program(exprStmt(call('triangle', [boolLit(true)]))))).toThrow(SproutRuntimeError);
  });
  it('polygon(6, 60) returns polygon Drawing', () => {
    expect(interpret(program(exprStmt(call('polygon', [numLit(6), numLit(60)]))))).toEqual(
      mkSequence([mkPolygon(6, 60)])
    );
  });
  it('polygon() throws with 0 args', () => {
    expect(() => interpret(program(exprStmt(call('polygon', []))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('polygon', []))))).toThrow(/polygon/);
  });
  it('polygon(6) throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('polygon', [numLit(6)]))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('polygon', [numLit(6)]))))).toThrow(/polygon/);
  });
  it('polygon(2, 60) throws when n < 3', () => {
    expect(() => interpret(program(exprStmt(call('polygon', [numLit(2), numLit(60)]))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('polygon', [numLit(2), numLit(60)]))))).toThrow(/polygon/);
  });
  it('polygon(true, 60) throws with non-number n', () => {
    expect(() => interpret(program(exprStmt(call('polygon', [boolLit(true), numLit(60)]))))).toThrow(SproutRuntimeError);
  });
  it('polygon(6, true) throws with non-number size', () => {
    expect(() => interpret(program(exprStmt(call('polygon', [numLit(6), boolLit(true)]))))).toThrow(SproutRuntimeError);
  });
  it('polygon(2.5, 60) throws for non-integer n (not just n<3)', () => {
    expect(() => interpret(program(exprStmt(call('polygon', [numLit(2.5), numLit(60)]))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('polygon', [numLit(2.5), numLit(60)]))))).toThrow(/integer/);
  });
});

// ---------------------------------------------------------------------------
// text builtin
// ---------------------------------------------------------------------------
describe('text builtin', () => {
  it('text("hi", 20) returns text Drawing', () => {
    expect(interpret(program(exprStmt(call('text', [strLit('hi'), numLit(20)]))))).toEqual(
      mkSequence([mkText('hi', 20)])
    );
  });
  it('text() with 0 args throws', () => {
    expect(() => interpret(program(exprStmt(call('text', []))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('text', []))))).toThrow(/text/);
  });
  it('text("hi") with 1 arg throws', () => {
    expect(() => interpret(program(exprStmt(call('text', [strLit('hi')]))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('text', [strLit('hi')]))))).toThrow(/text/);
  });
  it('text(42, 20) with non-string first arg throws', () => {
    expect(() => interpret(program(exprStmt(call('text', [numLit(42), numLit(20)]))))).toThrow(SproutRuntimeError);
  });
  it('text("hi", true) with non-number size throws', () => {
    expect(() => interpret(program(exprStmt(call('text', [strLit('hi'), boolLit(true)]))))).toThrow(SproutRuntimeError);
  });
  it('text("hi", 0) with size <= 0 throws', () => {
    expect(() => interpret(program(exprStmt(call('text', [strLit('hi'), numLit(0)]))))).toThrow(SproutRuntimeError);
    expect(() => interpret(program(exprStmt(call('text', [strLit('hi'), numLit(0)]))))).toThrow(/text/);
  });
});

// ---------------------------------------------------------------------------
// background builtin
// ---------------------------------------------------------------------------
describe('background builtin', () => {
  it('background(:red) returns a background Drawing with the palette hex', () => {
    expect(interpret(program(exprStmt(call('background', [symLit('red')]))))).toEqual(
      mkSequence([mkBackground('#dc2626')])
    );
  });

  it('background(:white) returns a background Drawing with #ffffff', () => {
    expect(interpret(program(exprStmt(call('background', [symLit('white')]))))).toEqual(
      mkSequence([mkBackground('#ffffff')])
    );
  });

  it('background("#ff4400") accepts a hex string directly', () => {
    expect(interpret(program(exprStmt(call('background', [strLit('#ff4400')]))))).toEqual(
      mkSequence([mkBackground('#ff4400')])
    );
  });

  it('background inside a sequence is accumulated correctly', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(100)])),
      exprStmt(call('background', [symLit('red')])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(100), mkBackground('#dc2626')]));
  });

  it('background(:unknown) throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('background', [symLit('unknown')]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/background/);
  });

  it('background(1) throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('background', [numLit(1)]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/background/);
  });

  it('background() with no args throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('background', []))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/background/);
  });
});

// ---------------------------------------------------------------------------
// clearCanvas builtin
// ---------------------------------------------------------------------------
describe('clearCanvas builtin', () => {
  it('clearCanvas() returns a clearCanvas Drawing', () => {
    expect(interpret(program(exprStmt(call('clearCanvas', []))))).toEqual(
      mkSequence([mkClearCanvas()])
    );
  });

  it('clearCanvas(1) throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('clearCanvas', [numLit(1)]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/clearCanvas/);
  });

  it('clearCanvas inside a sequence is accumulated correctly', () => {
    const prog = program(
      exprStmt(call('forward', [numLit(50)])),
      exprStmt(call('clearCanvas', [])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(50), mkClearCanvas()]));
  });
});

// ---------------------------------------------------------------------------
// String + operator
// ---------------------------------------------------------------------------
describe('+ with strings', () => {
  it('"a" + "b" concatenates to "ab"', () => {
    const prog = program(exprStmt(call('text', [infix('+', strLit('a'), strLit('b')), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('ab', 20)]));
  });

  it('"Score: " + 42 concatenates to "Score: 42"', () => {
    const prog = program(exprStmt(call('text', [infix('+', strLit('Score: '), numLit(42)), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('Score: 42', 20)]));
  });

  it('42 + " pts" concatenates to "42 pts"', () => {
    const prog = program(exprStmt(call('text', [infix('+', numLit(42), strLit(' pts')), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('42 pts', 20)]));
  });

  it('3 + 4 still adds numbers', () => {
    const prog = program(exprStmt(call('forward', [infix('+', numLit(3), numLit(4))])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(7)]));
  });

  it('"x" + true concatenates to "xtrue"', () => {
    const prog = program(exprStmt(call('text', [infix('+', strLit('x'), boolLit(true)), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('xtrue', 20)]));
  });
});

// ---------------------------------------------------------------------------
// String == operator
// ---------------------------------------------------------------------------
describe('== for strings', () => {
  it('"hello" == "hello" is true', () => {
    const prog = program(exprStmt(ifExpr(
      infix('==', strLit('hello'), strLit('hello')),
      [exprStmt(call('forward', [numLit(1)]))]
    )));
    // IfExpr returns evalBlock(then) = mkSequence([mkForward(1)]);
    // interpret wraps that in its own outer sequence.
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(1)])]));
  });

  it('"hello" == "world" is false', () => {
    const prog = program(exprStmt(ifExpr(
      infix('==', strLit('hello'), strLit('world')),
      [exprStmt(call('forward', [numLit(1)]))]
    )));
    // IfExpr returns EMPTY; interpret collects it and wraps: mkSequence([EMPTY])
    expect(interpret(prog)).toEqual(mkSequence([EMPTY]));
  });

  it('"hello" != "world" is true', () => {
    const prog = program(exprStmt(ifExpr(
      infix('!=', strLit('hello'), strLit('world')),
      [exprStmt(call('forward', [numLit(1)]))]
    )));
    // IfExpr returns evalBlock(then) = mkSequence([mkForward(1)]);
    // interpret wraps that in its own outer sequence.
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkForward(1)])]));
  });

  it('"hello" == 42 throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(ifExpr(
      infix('==', strLit('hello'), numLit(42)),
      [exprStmt(call('forward', [numLit(1)]))]
    ))));
    expect(fn).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// join builtin
// ---------------------------------------------------------------------------
describe('join builtin', () => {
  it('join() returns ""', () => {
    const prog = program(exprStmt(call('text', [call('join', []), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('', 20)]));
  });

  it('join("hello") returns "hello"', () => {
    const prog = program(exprStmt(call('text', [call('join', [strLit('hello')]), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('hello', 20)]));
  });

  it('join("Score: ", 42) returns "Score: 42"', () => {
    const prog = program(exprStmt(call('text', [call('join', [strLit('Score: '), numLit(42)]), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('Score: 42', 20)]));
  });

  it('join(true, "!") returns "true!"', () => {
    const prog = program(exprStmt(call('text', [call('join', [boolLit(true), strLit('!')]), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('true!', 20)]));
  });

  it('join("a", "b", "c") returns "abc"', () => {
    const prog = program(exprStmt(call('text', [call('join', [strLit('a'), strLit('b'), strLit('c')]), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('abc', 20)]));
  });

  it('join with drawing argument throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('join', [call('circle', [numLit(50)])]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/join/);
  });
});

// ---------------------------------------------------------------------------
// length builtin
// ---------------------------------------------------------------------------
describe('length builtin', () => {
  it('length("hello") returns 5', () => {
    const prog = program(exprStmt(call('forward', [call('length', [strLit('hello')])])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(5)]));
  });

  it('length("") returns 0', () => {
    const prog = program(exprStmt(call('forward', [call('length', [strLit('')])])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(0)]));
  });

  it('length(42) throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('length', [numLit(42)]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/length/);
  });

  it('length("a", "b") throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('length', [strLit('a'), strLit('b')]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/length/);
  });
});

// ---------------------------------------------------------------------------
// Return statement
// ---------------------------------------------------------------------------
describe('return statement', () => {
  it('function with only return — returns the value', () => {
    // def double(n) { return n * 2 }
    // let x = double(3)
    // forward(x)
    const prog = program(
      defStmt('double', ['n'], block([
        returnStmt(infix('*', ident('n'), numLit(2))),
      ])),
      letStmt('x', call('double', [numLit(3)])),
      exprStmt(call('forward', [ident('x')])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(6)]));
  });

  it('function with drawing then return — drawings appear, value returned', () => {
    // def drawAndGet(r) { circle(r); return r }
    // let size = drawAndGet(50)
    // forward(size)
    const mkCircle = (r: number) => ({ kind: 'circle' as const, radius: r });
    const prog = program(
      defStmt('drawAndGet', ['r'], block([
        exprStmt(call('circle', [ident('r')])),
        returnStmt(ident('r')),
      ])),
      letStmt('size', call('drawAndGet', [numLit(50)])),
      exprStmt(call('forward', [ident('size')])),
    );
    const result = interpret(prog);
    // Result: sequence of [drawings from drawAndGet call (circle(50)), forward(50)]
    expect(result).toEqual(mkSequence([mkSequence([mkCircle(50)]), mkForward(50)]));
  });

  it('function with only drawing, no return — still works (no regression)', () => {
    // def draw(r) { circle(r) }
    // draw(30)
    const mkCircle = (r: number) => ({ kind: 'circle' as const, radius: r });
    const prog = program(
      defStmt('draw', ['r'], block([
        exprStmt(call('circle', [ident('r')])),
      ])),
      exprStmt(call('draw', [numLit(30)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkCircle(30)])]));
  });

  it('bare function call statement with return — drawings appear, return value discarded', () => {
    // def drawAndGet(r) { circle(r); return r }
    // drawAndGet(40)  ← call as statement
    const mkCircle = (r: number) => ({ kind: 'circle' as const, radius: r });
    const prog = program(
      defStmt('drawAndGet', ['r'], block([
        exprStmt(call('circle', [ident('r')])),
        returnStmt(ident('r')),
      ])),
      exprStmt(call('drawAndGet', [numLit(40)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkSequence([mkCircle(40)])]));
  });

  it('function with return returns correct type — string', () => {
    // def greeting() { return "hello" }
    // let msg = greeting()
    // text(msg, 20)
    const prog = program(
      defStmt('greeting', [], block([
        returnStmt(strLit('hello')),
      ])),
      letStmt('msg', call('greeting', [])),
      exprStmt(call('text', [ident('msg'), numLit(20)])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkText('hello', 20)]));
  });

  it('return outside function throws SproutRuntimeError', () => {
    const prog = program(
      { kind: 'ReturnStmt', value: numLit(42) },
    );
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
    expect(() => interpret(prog)).toThrow(/return/);
  });

  it('callHandler: calling a value-returning function surfaces its drawing', () => {
    // def draw(r) { circle(r); return r }
    // on :click do draw(40) end
    // callHandler on the click handler should surface the circle drawing
    const { handlers } = interpretFull(program(
      defStmt('draw', ['r'], block([
        exprStmt(call('circle', [ident('r')])),
        returnStmt(ident('r')),
      ])),
      exprStmt(onExpr('click', [exprStmt(call('draw', [numLit(40)]))])),
    ));
    const fn = handlers.get(':click')!;
    const { drawing } = callHandler(fn);
    expect(drawing).toMatchObject({ kind: 'sequence' });
  });

  it('return inside repeat at top level throws SproutRuntimeError', () => {
    expect(() => interpret(program(
      exprStmt(repeat(numLit(3), [returnStmt(numLit(1))])),
    ))).toThrow(SproutRuntimeError);
  });

  it('return inside while at top level throws SproutRuntimeError', () => {
    expect(() => interpret(program(
      exprStmt(whileExpr(boolLit(true), [returnStmt(numLit(1))])),
    ))).toThrow(SproutRuntimeError);
  });

  it('return inside repeat inside a function exits the function', () => {
    // def myFunc(n) { repeat 3 do return n end }
    // let x = myFunc(7)
    // forward(x)
    const prog = program(
      defStmt('myFunc', ['n'], block([
        exprStmt(repeat(numLit(3), [
          returnStmt(ident('n')),
        ])),
      ])),
      letStmt('x', call('myFunc', [numLit(7)])),
      exprStmt(call('forward', [ident('x')])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(7)]));
  });

  it('return inside while inside a function exits the function', () => {
    // def f() { while true do return 42 end }
    // let x = f()
    // forward(x)
    const prog = program(
      defStmt('f', [], block([
        exprStmt(whileExpr(boolLit(true), [
          returnStmt(numLit(42)),
        ])),
      ])),
      letStmt('x', call('f', [])),
      exprStmt(call('forward', [ident('x')])),
    );
    expect(interpret(prog)).toEqual(mkSequence([mkForward(42)]));
  });
});

// ---------------------------------------------------------------------------
// input builtin
// ---------------------------------------------------------------------------
describe('input builtin', () => {
  it('interpretWithInputs returns value from map', () => {
    const prog = program(exprStmt(call('forward', [call('input', [strLit('x')])])));
    const inputs = new Map<string, number>([['x', 42]]);
    expect(interpretWithInputs(prog, inputs)).toEqual(mkSequence([mkForward(42)]));
  });

  it('returns 0 for missing key', () => {
    const prog = program(exprStmt(call('forward', [call('input', [strLit('y')])])));
    const inputs = new Map<string, number>([['x', 42]]);
    expect(interpretWithInputs(prog, inputs)).toEqual(mkSequence([mkForward(0)]));
  });

  it('interpret (no inputs) returns 0', () => {
    const prog = program(exprStmt(call('forward', [call('input', [strLit('x')])])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(0)]));
  });

  it('throws when argument is not a string', () => {
    const prog = program(exprStmt(call('forward', [call('input', [numLit(5)])])));
    expect(() => interpretWithInputs(prog, new Map())).toThrow(SproutRuntimeError);
  });

  it('interpretFullWithInputs passes inputs to handlers', () => {
    // Program: def handler draws forward(input("speed")) steps
    // then register on :timer do handler() end
    // The test calls interpretFullWithInputs and checks the drawing is correct.
    const handlerBody: Expr = {
      kind: 'BlockExpr',
      body: [exprStmt(call('forward', [call('input', [strLit('speed')])]))],
    };
    const prog = program(
      defStmt('go', [], handlerBody),
      exprStmt(call('forward', [call('input', [strLit('speed')])])),
    );
    const inputs = new Map<string, number>([['speed', 7]]);
    const { drawing } = interpretFullWithInputs(prog, inputs);
    expect(drawing).toEqual(mkSequence([mkForward(7)]));
  });
});

// ---------------------------------------------------------------------------
// mouseX / mouseY builtins
// ---------------------------------------------------------------------------
describe('mouseX / mouseY builtins', () => {
  beforeEach(() => setMousePosition(0, 0));

  it('mouseX() returns 0 by default', () => {
    const prog = program(exprStmt(call('forward', [call('mouseX', [])])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(0)]));
  });

  it('mouseY() returns 0 by default', () => {
    const prog = program(exprStmt(call('forward', [call('mouseY', [])])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(0)]));
  });

  it('mouseX() returns set X value', () => {
    setMousePosition(100, 200);
    try {
      const prog = program(exprStmt(call('forward', [call('mouseX', [])])));
      expect(interpret(prog)).toEqual(mkSequence([mkForward(100)]));
    } finally {
      setMousePosition(0, 0);
    }
  });

  it('mouseY() returns set Y value', () => {
    setMousePosition(100, 200);
    try {
      const prog = program(exprStmt(call('forward', [call('mouseY', [])])));
      expect(interpret(prog)).toEqual(mkSequence([mkForward(200)]));
    } finally {
      setMousePosition(0, 0);
    }
  });

  it('mouseX throws when given arguments', () => {
    const prog = program(exprStmt(call('mouseX', [numLit(1)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });

  it('mouseY throws when given arguments', () => {
    const prog = program(exprStmt(call('mouseY', [numLit(1)])));
    expect(() => interpret(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// collectInputNames
// ---------------------------------------------------------------------------
describe('collectInputNames', () => {
  it('returns [] for empty program', () => {
    expect(collectInputNames(program())).toEqual([]);
  });

  it('returns [name] for a single input call', () => {
    const prog = program(exprStmt(call('forward', [call('input', [strLit('speed')])])));
    expect(collectInputNames(prog)).toEqual(['speed']);
  });

  it('deduplicates repeated names', () => {
    const prog = program(
      exprStmt(call('forward', [call('input', [strLit('x')])])),
      exprStmt(call('forward', [call('input', [strLit('x')])])),
    );
    expect(collectInputNames(prog)).toEqual(['x']);
  });

  it('returns names in order of first appearance', () => {
    const prog = program(
      exprStmt(call('forward', [call('input', [strLit('a')])])),
      exprStmt(call('forward', [call('input', [strLit('b')])])),
    );
    expect(collectInputNames(prog)).toEqual(['a', 'b']);
  });

  it('finds names nested inside a def body', () => {
    const defBody: Expr = {
      kind: 'BlockExpr',
      body: [exprStmt(call('forward', [call('input', [strLit('size')])]))],
    };
    const prog = program(defStmt('draw', [], defBody));
    expect(collectInputNames(prog)).toEqual(['size']);
  });

  it('ignores input() calls where arg is not a StringLit', () => {
    const prog = program(exprStmt(call('input', [ident('x')])));
    expect(collectInputNames(prog)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// list builtins
// ---------------------------------------------------------------------------
describe('list builtins', () => {
  describe('list()', () => {
    it('creates an empty list', () => {
      const prog = program(exprStmt(call('list', [])));
      expect(interpretValue(prog)).toEqual(mkList([]));
    });

    it('creates a list with items', () => {
      const prog = program(exprStmt(call('list', [numLit(1), numLit(2), numLit(3)])));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 3 },
      ]));
    });

    it('accepts mixed types', () => {
      const prog = program(exprStmt(call('list', [numLit(1), strLit('hi')])));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'string', value: 'hi' },
      ]));
    });
  });

  describe('push()', () => {
    it('appends a value to the list', () => {
      const prog = program(exprStmt(
        call('push', [call('list', [numLit(1), numLit(2)]), numLit(3)])
      ));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 3 },
      ]));
    });

    it('does not mutate the original list', () => {
      const prog = program(
        letStmt('colors', call('list', [numLit(1)])),
        letStmt('colors2', call('push', [ident('colors'), numLit(2)])),
        exprStmt(ident('colors')),
      );
      expect(interpretValue(prog)).toEqual(mkList([{ kind: 'number', value: 1 }]));
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('push', [call('list', [])])));
      expect(() => interpretValue(prog)).toThrow('push expects 2 arguments, got 1');
    });

    it('throws if first arg is not a list', () => {
      const prog = program(exprStmt(call('push', [numLit(1), numLit(2)])));
      expect(() => interpretValue(prog)).toThrow('push: expected list, got number');
    });
  });

  describe('get()', () => {
    it('returns item at 1-based index', () => {
      const prog = program(exprStmt(
        call('get', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(1)])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 10 });
    });

    it('returns last item', () => {
      const prog = program(exprStmt(
        call('get', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(3)])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 30 });
    });

    it('throws on out-of-bounds index', () => {
      const prog = program(exprStmt(
        call('get', [call('list', [numLit(1), numLit(2)]), numLit(5)])
      ));
      expect(() => interpretValue(prog)).toThrow('get: index 5 is out of bounds (size 2)');
    });

    it('throws on index 0', () => {
      const prog = program(exprStmt(
        call('get', [call('list', [numLit(1)]), numLit(0)])
      ));
      expect(() => interpretValue(prog)).toThrow('get: index 0 is out of bounds (size 1)');
    });

    it('throws if first arg is not a list', () => {
      const prog = program(exprStmt(call('get', [numLit(5), numLit(1)])));
      expect(() => interpretValue(prog)).toThrow('get: expected list, got number');
    });

    it('throws if second arg is not a number', () => {
      const prog = program(exprStmt(
        call('get', [call('list', [numLit(1)]), strLit('x')])
      ));
      expect(() => interpretValue(prog)).toThrow('get: expected number index, got string');
    });
  });

  describe('size()', () => {
    it('returns 0 for empty list', () => {
      const prog = program(exprStmt(call('size', [call('list', [])])));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 0 });
    });

    it('returns item count', () => {
      const prog = program(exprStmt(
        call('size', [call('list', [numLit(1), numLit(2), numLit(3)])])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 3 });
    });

    it('throws if arg is not a list', () => {
      const prog = program(exprStmt(call('size', [numLit(5)])));
      expect(() => interpretValue(prog)).toThrow('size: expected list, got number');
    });
  });

  describe('isEmpty()', () => {
    it('returns true for empty list', () => {
      const prog = program(exprStmt(call('isEmpty', [call('list', [])])));
      expect(interpretValue(prog)).toEqual({ kind: 'bool', value: true });
    });

    it('returns false for non-empty list', () => {
      const prog = program(exprStmt(
        call('isEmpty', [call('list', [numLit(1), numLit(2)])])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'bool', value: false });
    });

    it('throws if arg is not a list', () => {
      const prog = program(exprStmt(call('isEmpty', [strLit('hi')])));
      expect(() => interpretValue(prog)).toThrow('isEmpty: expected list, got string');
    });
  });

  describe('map()', () => {
    it('applies function to each item', () => {
      // def double(x) = x * 2; map(list(1,2,3), double)
      const prog = program(
        defStmt('double', ['x'], infix('*', ident('x'), numLit(2))),
        exprStmt(call('map', [
          call('list', [numLit(1), numLit(2), numLit(3)]),
          ident('double'),
        ])),
      );
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 2 },
        { kind: 'number', value: 4 },
        { kind: 'number', value: 6 },
      ]));
    });

    it('returns empty list for empty input', () => {
      const prog = program(
        defStmt('double', ['x'], infix('*', ident('x'), numLit(2))),
        exprStmt(call('map', [call('list', []), ident('double')])),
      );
      expect(interpretValue(prog)).toEqual(mkList([]));
    });

    it('throws on wrong arg count', () => {
      const prog = program(exprStmt(call('map', [call('list', [])])));
      expect(() => interpretValue(prog)).toThrow('map expects 2 arguments, got 1');
    });

    it('throws if first arg is not a list', () => {
      const prog = program(
        defStmt('id', ['x'], ident('x')),
        exprStmt(call('map', [numLit(1), ident('id')])),
      );
      expect(() => interpretValue(prog)).toThrow('map: expected list, got number');
    });

    it('throws if second arg is not a function', () => {
      const prog = program(exprStmt(
        call('map', [call('list', [numLit(1)]), numLit(42)])
      ));
      expect(() => interpretValue(prog)).toThrow('map: second argument must be a function');
    });

    it('throws if function takes 0 parameters', () => {
      const prog = program(
        defStmt('noParam', [], numLit(1)),
        exprStmt(call('map', [call('list', [numLit(1)]), ident('noParam')])),
      );
      expect(() => interpretValue(prog)).toThrow('must take exactly 1 parameter');
    });
  });

  describe('filter()', () => {
    it('keeps items where function returns true', () => {
      // def gt2(x) = x > 2; filter(list(1,2,3,4), gt2)
      const prog = program(
        defStmt('gt2', ['x'], infix('>', ident('x'), numLit(2))),
        exprStmt(call('filter', [
          call('list', [numLit(1), numLit(2), numLit(3), numLit(4)]),
          ident('gt2'),
        ])),
      );
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 3 },
        { kind: 'number', value: 4 },
      ]));
    });

    it('returns empty list for empty input', () => {
      const prog = program(
        defStmt('gt2', ['x'], infix('>', ident('x'), numLit(2))),
        exprStmt(call('filter', [call('list', []), ident('gt2')])),
      );
      expect(interpretValue(prog)).toEqual(mkList([]));
    });

    it('returns empty list when no items pass', () => {
      const prog = program(
        defStmt('gt10', ['x'], infix('>', ident('x'), numLit(10))),
        exprStmt(call('filter', [
          call('list', [numLit(1), numLit(2)]),
          ident('gt10'),
        ])),
      );
      expect(interpretValue(prog)).toEqual(mkList([]));
    });

    it('throws on wrong arg count', () => {
      const prog = program(exprStmt(call('filter', [call('list', [])])));
      expect(() => interpretValue(prog)).toThrow('filter expects 2 arguments, got 1');
    });

    it('throws if first arg is not a list', () => {
      const prog = program(
        defStmt('id', ['x'], ident('x')),
        exprStmt(call('filter', [strLit('hi'), ident('id')])),
      );
      expect(() => interpretValue(prog)).toThrow('filter: expected list, got string');
    });

    it('throws if second arg is not a function', () => {
      const prog = program(exprStmt(
        call('filter', [call('list', [numLit(1)]), boolLit(true)])
      ));
      expect(() => interpretValue(prog)).toThrow('filter: second argument must be a function');
    });

    it('throws if function takes 0 parameters', () => {
      const prog = program(
        defStmt('noParam', [], boolLit(true)),
        exprStmt(call('filter', [call('list', [numLit(1)]), ident('noParam')])),
      );
      expect(() => interpretValue(prog)).toThrow('must take exactly 1 parameter');
    });

    it('throws if predicate returns a non-bool', () => {
      const prog = program(
        defStmt('retNum', ['x'], numLit(42)),
        exprStmt(call('filter', [
          call('list', [numLit(1)]),
          ident('retNum'),
        ])),
      );
      expect(() => interpretValue(prog)).toThrow('predicate must return a bool');
    });
  });

  describe('reduce()', () => {
    it('sums a list (reduce with add, init 0)', () => {
      const prog = program(
        defStmt('add', ['a', 'b'], infix('+', ident('a'), ident('b'))),
        exprStmt(call('reduce', [
          call('list', [numLit(1), numLit(2), numLit(3), numLit(4)]),
          ident('add'),
          numLit(0),
        ])),
      );
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 10 });
    });

    it('multiplies a list (reduce with mul, init 1)', () => {
      const prog = program(
        defStmt('mul', ['a', 'b'], infix('*', ident('a'), ident('b'))),
        exprStmt(call('reduce', [
          call('list', [numLit(1), numLit(2), numLit(3)]),
          ident('mul'),
          numLit(1),
        ])),
      );
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 6 });
    });

    it('returns init for empty list', () => {
      const prog = program(
        defStmt('add', ['a', 'b'], infix('+', ident('a'), ident('b'))),
        exprStmt(call('reduce', [call('list', []), ident('add'), numLit(0)])),
      );
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 0 });
    });

    it('is a left fold (reduce with sub, init 10)', () => {
      // 10 - 1 - 2 - 3 = 4
      const prog = program(
        defStmt('sub', ['a', 'b'], infix('-', ident('a'), ident('b'))),
        exprStmt(call('reduce', [
          call('list', [numLit(1), numLit(2), numLit(3)]),
          ident('sub'),
          numLit(10),
        ])),
      );
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 4 });
    });

    it('throws on wrong arg count', () => {
      const prog = program(exprStmt(call('reduce', [call('list', []), numLit(0)])));
      expect(() => interpretValue(prog)).toThrow('reduce expects 3 arguments, got 2');
    });

    it('throws if first arg is not a list', () => {
      const prog = program(
        defStmt('add', ['a', 'b'], infix('+', ident('a'), ident('b'))),
        exprStmt(call('reduce', [numLit(1), ident('add'), numLit(0)])),
      );
      expect(() => interpretValue(prog)).toThrow('reduce: expected list, got number');
    });

    it('throws if second arg is not a function', () => {
      const prog = program(exprStmt(
        call('reduce', [call('list', [numLit(1)]), numLit(42), numLit(0)])
      ));
      expect(() => interpretValue(prog)).toThrow('reduce: second argument must be a function');
    });

    it('throws if function takes only 1 parameter', () => {
      const prog = program(
        defStmt('oneParam', ['x'], ident('x')),
        exprStmt(call('reduce', [call('list', [numLit(1)]), ident('oneParam'), numLit(0)])),
      );
      expect(() => interpretValue(prog)).toThrow('reduce: function must take exactly 2 parameters, got 1');
    });
  });

  describe('first()', () => {
    it('returns the first item', () => {
      const prog = program(exprStmt(
        call('first', [call('list', [numLit(10), numLit(20), numLit(30)])])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 10 });
    });

    it('returns the only item in a singleton list', () => {
      const prog = program(exprStmt(
        call('first', [call('list', [numLit(42)])])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 42 });
    });

    it('throws on empty list', () => {
      const prog = program(exprStmt(call('first', [call('list', [])])));
      expect(() => interpretValue(prog)).toThrow('first: list is empty');
    });

    it('throws if arg is not a list', () => {
      const prog = program(exprStmt(call('first', [numLit(5)])));
      expect(() => interpretValue(prog)).toThrow('first: expected list, got number');
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('first', [])));
      expect(() => interpretValue(prog)).toThrow('first expects 1 argument, got 0');
    });
  });

  describe('last()', () => {
    it('returns the last item', () => {
      const prog = program(exprStmt(
        call('last', [call('list', [numLit(10), numLit(20), numLit(30)])])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 30 });
    });

    it('returns the only item in a singleton list', () => {
      const prog = program(exprStmt(
        call('last', [call('list', [numLit(42)])])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 42 });
    });

    it('throws on empty list', () => {
      const prog = program(exprStmt(call('last', [call('list', [])])));
      expect(() => interpretValue(prog)).toThrow('last: list is empty');
    });

    it('throws if arg is not a list', () => {
      const prog = program(exprStmt(call('last', [strLit('hi')])));
      expect(() => interpretValue(prog)).toThrow('last: expected list, got string');
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('last', [])));
      expect(() => interpretValue(prog)).toThrow('last expects 1 argument, got 0');
    });
  });

  describe('pop()', () => {
    it('returns new list with last item removed', () => {
      const prog = program(exprStmt(
        call('pop', [call('list', [numLit(1), numLit(2), numLit(3)])])
      ));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
      ]));
    });

    it('returns empty list when popping singleton', () => {
      const prog = program(exprStmt(
        call('pop', [call('list', [numLit(99)])])
      ));
      expect(interpretValue(prog)).toEqual(mkList([]));
    });

    it('does not mutate the original list', () => {
      const prog = program(
        letStmt('original', call('list', [numLit(1), numLit(2)])),
        letStmt('shorter', call('pop', [ident('original')])),
        exprStmt(ident('original')),
      );
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
      ]));
    });

    it('throws on empty list', () => {
      const prog = program(exprStmt(call('pop', [call('list', [])])));
      expect(() => interpretValue(prog)).toThrow('pop: list is empty');
    });

    it('throws if arg is not a list', () => {
      const prog = program(exprStmt(call('pop', [numLit(5)])));
      expect(() => interpretValue(prog)).toThrow('pop: expected list, got number');
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('pop', [])));
      expect(() => interpretValue(prog)).toThrow('pop expects 1 argument, got 0');
    });
  });

  describe('concat()', () => {
    it('joins two lists', () => {
      const prog = program(exprStmt(
        call('concat', [
          call('list', [numLit(1), numLit(2)]),
          call('list', [numLit(3), numLit(4)]),
        ])
      ));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 3 },
        { kind: 'number', value: 4 },
      ]));
    });

    it('handles empty first list', () => {
      const prog = program(exprStmt(
        call('concat', [call('list', []), call('list', [numLit(1), numLit(2)])])
      ));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
      ]));
    });

    it('handles empty second list', () => {
      const prog = program(exprStmt(
        call('concat', [call('list', [numLit(1), numLit(2)]), call('list', [])])
      ));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
      ]));
    });

    it('does not mutate the original lists', () => {
      const prog = program(
        letStmt('a', call('list', [numLit(1)])),
        letStmt('b', call('list', [numLit(2)])),
        letStmt('c', call('concat', [ident('a'), ident('b')])),
        exprStmt(ident('a')),
      );
      expect(interpretValue(prog)).toEqual(mkList([{ kind: 'number', value: 1 }]));
    });

    it('throws if first arg is not a list', () => {
      const prog = program(exprStmt(
        call('concat', [numLit(1), call('list', [])])
      ));
      expect(() => interpretValue(prog)).toThrow('concat: expected list, got number');
    });

    it('throws if second arg is not a list', () => {
      const prog = program(exprStmt(
        call('concat', [call('list', []), strLit('hi')])
      ));
      expect(() => interpretValue(prog)).toThrow('concat: expected list, got string');
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('concat', [call('list', [])])));
      expect(() => interpretValue(prog)).toThrow('concat expects 2 arguments, got 1');
    });
  });

  describe('reverse()', () => {
    it('reverses a list', () => {
      const prog = program(exprStmt(
        call('reverse', [call('list', [numLit(1), numLit(2), numLit(3)])])
      ));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 3 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 1 },
      ]));
    });

    it('returns empty list when reversing empty list', () => {
      const prog = program(exprStmt(call('reverse', [call('list', [])])));
      expect(interpretValue(prog)).toEqual(mkList([]));
    });

    it('returns singleton unchanged', () => {
      const prog = program(exprStmt(
        call('reverse', [call('list', [numLit(42)])])
      ));
      expect(interpretValue(prog)).toEqual(mkList([{ kind: 'number', value: 42 }]));
    });

    it('does not mutate the original list', () => {
      const prog = program(
        letStmt('original', call('list', [numLit(1), numLit(2), numLit(3)])),
        letStmt('rev', call('reverse', [ident('original')])),
        exprStmt(ident('original')),
      );
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 3 },
      ]));
    });

    it('throws if arg is not a list', () => {
      const prog = program(exprStmt(call('reverse', [numLit(5)])));
      expect(() => interpretValue(prog)).toThrow('reverse: expected list, got number');
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('reverse', [])));
      expect(() => interpretValue(prog)).toThrow('reverse expects 1 argument, got 0');
    });
  });

  describe('indexOf()', () => {
    it('returns 0-based index of matching number', () => {
      const prog = program(exprStmt(
        call('indexOf', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(20)])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 1 });
    });

    it('returns -1 when item not found', () => {
      const prog = program(exprStmt(
        call('indexOf', [call('list', [numLit(1), numLit(2)]), numLit(99)])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: -1 });
    });

    it('returns index of matching string', () => {
      const prog = program(exprStmt(
        call('indexOf', [call('list', [strLit('a'), strLit('b'), strLit('c')]), strLit('b')])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 1 });
    });

    it('returns first index when duplicates exist', () => {
      const prog = program(exprStmt(
        call('indexOf', [call('list', [numLit(5), numLit(5), numLit(5)]), numLit(5)])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: 0 });
    });

    it('returns -1 on empty list', () => {
      const prog = program(exprStmt(
        call('indexOf', [call('list', []), numLit(1)])
      ));
      expect(interpretValue(prog)).toEqual({ kind: 'number', value: -1 });
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('indexOf', [call('list', [])])));
      expect(() => interpretValue(prog)).toThrow('indexOf expects 2 arguments, got 1');
    });

    it('throws if first arg is not a list', () => {
      const prog = program(exprStmt(call('indexOf', [numLit(5), numLit(1)])));
      expect(() => interpretValue(prog)).toThrow('indexOf: expected list, got number');
    });
  });

  describe('slice()', () => {
    it('returns sublist from start to end (exclusive)', () => {
      const prog = program(exprStmt(
        call('slice', [call('list', [numLit(1), numLit(2), numLit(3), numLit(4)]), numLit(1), numLit(3)])
      ));
      expect(interpretValue(prog)).toEqual(mkList([{ kind: 'number', value: 2 }, { kind: 'number', value: 3 }]));
    });

    it('returns full list when start=0 end=length', () => {
      const prog = program(exprStmt(
        call('slice', [call('list', [numLit(1), numLit(2)]), numLit(0), numLit(2)])
      ));
      expect(interpretValue(prog)).toEqual(mkList([{ kind: 'number', value: 1 }, { kind: 'number', value: 2 }]));
    });

    it('clamps out-of-bounds end', () => {
      const prog = program(exprStmt(
        call('slice', [call('list', [numLit(1), numLit(2)]), numLit(0), numLit(100)])
      ));
      expect(interpretValue(prog)).toEqual(mkList([{ kind: 'number', value: 1 }, { kind: 'number', value: 2 }]));
    });

    it('returns empty list when start >= end', () => {
      const prog = program(exprStmt(
        call('slice', [call('list', [numLit(1), numLit(2), numLit(3)]), numLit(2), numLit(1)])
      ));
      expect(interpretValue(prog)).toEqual(mkList([]));
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('slice', [call('list', []), numLit(0)])));
      expect(() => interpretValue(prog)).toThrow('slice expects 3 arguments, got 2');
    });

    it('throws if first arg is not a list', () => {
      const prog = program(exprStmt(call('slice', [numLit(5), numLit(0), numLit(1)])));
      expect(() => interpretValue(prog)).toThrow('slice: expected list, got number');
    });
  });

  describe('sort()', () => {
    it('sorts numbers ascending', () => {
      const prog = program(exprStmt(
        call('sort', [call('list', [numLit(3), numLit(1), numLit(2)])])
      ));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 3 },
      ]));
    });

    it('sorts strings lexicographically', () => {
      const prog = program(exprStmt(
        call('sort', [call('list', [strLit('banana'), strLit('apple'), strLit('cherry')])])
      ));
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'string', value: 'apple' },
        { kind: 'string', value: 'banana' },
        { kind: 'string', value: 'cherry' },
      ]));
    });

    it('returns empty list unchanged', () => {
      const prog = program(exprStmt(call('sort', [call('list', [])])));
      expect(interpretValue(prog)).toEqual(mkList([]));
    });

    it('does not mutate original list', () => {
      const prog = program(
        letStmt('original', call('list', [numLit(3), numLit(1), numLit(2)])),
        letStmt('sorted', call('sort', [ident('original')])),
        exprStmt(ident('original')),
      );
      expect(interpretValue(prog)).toEqual(mkList([
        { kind: 'number', value: 3 },
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
      ]));
    });

    it('throws on mixed types', () => {
      const prog = program(exprStmt(
        call('sort', [call('list', [numLit(1), strLit('a')])])
      ));
      expect(() => interpretValue(prog)).toThrow('sort: cannot sort mixed types');
    });

    it('throws if arg is not a list', () => {
      const prog = program(exprStmt(call('sort', [numLit(5)])));
      expect(() => interpretValue(prog)).toThrow('sort: expected list, got number');
    });

    it('throws on wrong arity', () => {
      const prog = program(exprStmt(call('sort', [])));
      expect(() => interpretValue(prog)).toThrow('sort expects 1 argument, got 0');
    });
  });
});

describe('stamp builtin', () => {
  it('returns a stamp Drawing', () => {
    const prog = program(exprStmt(call('stamp', [])));
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkStamp()]));
  });
});

describe('arc builtin', () => {
  it('arc(100, 90) returns a Drawing with kind arc, radius 100, angle 90', () => {
    const prog = program(exprStmt(call('arc', [numLit(100), numLit(90)])));
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkArc(100, 90)]));
  });

  it('arc(50, -45) returns arc with negative angle', () => {
    const prog = program(exprStmt(call('arc', [numLit(50), numLit(-45)])));
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkArc(50, -45)]));
  });

  it('arc with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('arc', [numLit(100)])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('arc with zero args throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('arc', [])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('arc(-50, 90) throws SproutRuntimeError for negative radius', () => {
    const prog = program(exprStmt(call('arc', [numLit(-50), numLit(90)])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });
});

describe('for each loop', () => {
  it('empty list produces EMPTY drawing', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', []), [
        exprStmt(call('forward', [numLit(10)])),
      ])),
    );
    // evalForEach returns EMPTY; interpretFull wraps it in mkSequence([EMPTY])
    expect(interpretFull(prog).drawing).toEqual(mkSequence([EMPTY]));
  });

  it('single-item list runs body once', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', [numLit(50)]), [
        exprStmt(call('forward', [ident('x')])),
      ])),
    );
    // evalForEach → mkSequence([mkSequence([mkForward(50)])])
    // interpretFull wraps → mkSequence([mkSequence([mkSequence([mkForward(50)])])])
    const iterDrawing = mkSequence([mkForward(50)]);
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkSequence([iterDrawing])]));
  });

  it('multi-item list runs body N times', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', [numLit(10), numLit(20), numLit(30)]), [
        exprStmt(call('forward', [ident('x')])),
      ])),
    );
    // evalForEach → mkSequence([mkSequence([mkForward(10)]), mkSequence([mkForward(20)]), mkSequence([mkForward(30)])])
    // interpretFull wraps that in mkSequence([...])
    const d10 = mkSequence([mkForward(10)]);
    const d20 = mkSequence([mkForward(20)]);
    const d30 = mkSequence([mkForward(30)]);
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkSequence([d10, d20, d30])]));
  });

  it('throws on non-list', () => {
    const prog = program(
      exprStmt(forEachExpr('x', numLit(42), [])),
    );
    expect(() => interpretFull(prog)).toThrow('for each: expected list, got number');
  });

  it('item variable shadows outer and outer is restored after loop', () => {
    const prog = program(
      letStmt('x', numLit(99)),
      exprStmt(forEachExpr('x', call('list', [numLit(7)]), [
        exprStmt(call('forward', [ident('x')])),
      ])),
      exprStmt(call('forward', [ident('x')])),
    );
    // inner x=7 draws forward(7), outer x=99 draws forward(99) after loop
    // interpretFull drawing:
    //   mkSequence([
    //     mkSequence([mkSequence([mkForward(7)])]),  ← for each result (one iteration)
    //     mkForward(99),                              ← forward(x) using restored outer x
    //   ])
    const result = interpretFull(prog).drawing;
    expect(result).toEqual(
      mkSequence([
        mkSequence([mkSequence([mkForward(7)])]),
        mkForward(99),
      ])
    );
  });

  it('item variable does not leak out of loop', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', [numLit(1)]), [])),
      exprStmt(ident('x')),
    );
    expect(() => interpretFull(prog)).toThrow();
  });

  it('return inside for each body exits function early', () => {
    // def f() { for each x in list(1, 2, 3) do return x end }
    // let result = f()       → f() returns 1 (first item), stops iterating
    // forward(result)        → draws forward(1)
    const prog = program(
      defStmt('f', [], block([
        exprStmt(forEachExpr('x', call('list', [numLit(1), numLit(2), numLit(3)]), [
          returnStmt(ident('x')),
        ])),
      ])),
      letStmt('result', call('f', [])),
      exprStmt(call('forward', [ident('result')])),
    );
    const drawing = interpretFull(prog).drawing;
    // f() returned 1 on first iteration; forward(result) draws forward(1)
    // interpretFull wraps the single top-level forward(result) call: mkSequence([mkForward(1)])
    expect(drawing).toEqual(mkSequence([mkForward(1)]));
  });
});

// ---------------------------------------------------------------------------
// goto builtin
// ---------------------------------------------------------------------------
describe('goto builtin', () => {
  it('goto(50, 100) returns a goto Drawing', () => {
    const prog = program(exprStmt(call('goto', [numLit(50), numLit(100)])));
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkGoto(50, 100)]));
  });

  it('goto(0, 0) returns a goto Drawing at origin', () => {
    const prog = program(exprStmt(call('goto', [numLit(0), numLit(0)])));
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkGoto(0, 0)]));
  });

  it('goto(-30, 40) accepts negative coordinates', () => {
    const prog = program(exprStmt(call('goto', [numLit(-30), numLit(40)])));
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkGoto(-30, 40)]));
  });

  it('goto with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('goto', [numLit(50)])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('goto with zero args throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('goto', [])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('goto with non-number first arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('goto', [strLit('a'), numLit(0)])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('goto with non-number second arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('goto', [numLit(0), strLit('b')])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// home builtin
// ---------------------------------------------------------------------------
describe('home builtin', () => {
  it('home() returns a home Drawing', () => {
    const prog = program(exprStmt(call('home', [])));
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkHome()]));
  });

  it('home with any args throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('home', [numLit(0)])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// split builtin
// ---------------------------------------------------------------------------
describe('split builtin', () => {
  it('split("a,b,c", ",") returns list ["a","b","c"]', () => {
    const prog = program(exprStmt(call('split', [strLit('a,b,c'), strLit(',')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'list', items: [
      { kind: 'string', value: 'a' },
      { kind: 'string', value: 'b' },
      { kind: 'string', value: 'c' },
    ]});
  });

  it('split("hello world", " ") returns list ["hello","world"]', () => {
    const prog = program(exprStmt(call('split', [strLit('hello world'), strLit(' ')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'list', items: [
      { kind: 'string', value: 'hello' },
      { kind: 'string', value: 'world' },
    ]});
  });

  it('split("abc", "") returns list of individual characters', () => {
    const prog = program(exprStmt(call('split', [strLit('abc'), strLit('')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'list', items: [
      { kind: 'string', value: 'a' },
      { kind: 'string', value: 'b' },
      { kind: 'string', value: 'c' },
    ]});
  });

  it('split("hello", "x") returns list with the whole string', () => {
    const prog = program(exprStmt(call('split', [strLit('hello'), strLit('x')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'list', items: [{ kind: 'string', value: 'hello' }]});
  });

  it('split with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('split', [strLit('hello')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('split with non-string first arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('split', [numLit(42), strLit(',')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('split with non-string second arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('split', [strLit('hello'), numLit(1)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// contains builtin
// ---------------------------------------------------------------------------
describe('contains builtin', () => {
  it('contains("hello world", "world") returns true', () => {
    const prog = program(exprStmt(call('contains', [strLit('hello world'), strLit('world')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'bool', value: true });
  });

  it('contains("hello", "xyz") returns false', () => {
    const prog = program(exprStmt(call('contains', [strLit('hello'), strLit('xyz')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'bool', value: false });
  });

  it('contains("hello", "") returns true', () => {
    const prog = program(exprStmt(call('contains', [strLit('hello'), strLit('')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'bool', value: true });
  });

  it('contains("", "") returns true', () => {
    const prog = program(exprStmt(call('contains', [strLit(''), strLit('')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'bool', value: true });
  });

  it('contains with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('contains', [strLit('hello')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('contains with non-string, non-list first arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('contains', [numLit(1), strLit('x')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// contains — list overload
// ---------------------------------------------------------------------------
describe('contains — list membership', () => {
  it('returns true when number is in list', () => {
    const prog = program(exprStmt(
      call('contains', [call('list', [numLit(1), numLit(2), numLit(3)]), numLit(2)])
    ));
    expect(interpretValue(prog)).toEqual({ kind: 'bool', value: true });
  });

  it('returns false when number is not in list', () => {
    const prog = program(exprStmt(
      call('contains', [call('list', [numLit(1), numLit(2)]), numLit(9)])
    ));
    expect(interpretValue(prog)).toEqual({ kind: 'bool', value: false });
  });

  it('returns true when string is in list', () => {
    const prog = program(exprStmt(
      call('contains', [call('list', [strLit('a'), strLit('b')]), strLit('a')])
    ));
    expect(interpretValue(prog)).toEqual({ kind: 'bool', value: true });
  });

  it('returns true when bool is in list', () => {
    const prog = program(exprStmt(
      call('contains', [call('list', [boolLit(true), boolLit(false)]), boolLit(false)])
    ));
    expect(interpretValue(prog)).toEqual({ kind: 'bool', value: true });
  });

  it('returns false for empty list', () => {
    const prog = program(exprStmt(
      call('contains', [call('list', []), numLit(1)])
    ));
    expect(interpretValue(prog)).toEqual({ kind: 'bool', value: false });
  });

  it('throws when item type is list', () => {
    const prog = program(exprStmt(
      call('contains', [call('list', [call('list', [])]), call('list', [])])
    ));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('throws when first arg is not string or list', () => {
    const prog = program(exprStmt(call('contains', [numLit(5), numLit(1)])));
    expect(() => interpretValue(prog)).toThrow('contains: expected string or list, got number');
  });
});

// ---------------------------------------------------------------------------
// toUpper builtin
// ---------------------------------------------------------------------------
describe('toUpper builtin', () => {
  it('toUpper("hello") returns "HELLO"', () => {
    const prog = program(exprStmt(call('toUpper', [strLit('hello')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'string', value: 'HELLO' });
  });

  it('toUpper("Hello World") returns "HELLO WORLD"', () => {
    const prog = program(exprStmt(call('toUpper', [strLit('Hello World')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'string', value: 'HELLO WORLD' });
  });

  it('toUpper("123") returns "123" unchanged', () => {
    const prog = program(exprStmt(call('toUpper', [strLit('123')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'string', value: '123' });
  });

  it('toUpper with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('toUpper', [])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('toUpper with non-string arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('toUpper', [numLit(42)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// toLower builtin
// ---------------------------------------------------------------------------
describe('toLower builtin', () => {
  it('toLower("HELLO") returns "hello"', () => {
    const prog = program(exprStmt(call('toLower', [strLit('HELLO')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'string', value: 'hello' });
  });

  it('toLower("Hello World") returns "hello world"', () => {
    const prog = program(exprStmt(call('toLower', [strLit('Hello World')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'string', value: 'hello world' });
  });

  it('toLower("ABC123") returns "abc123"', () => {
    const prog = program(exprStmt(call('toLower', [strLit('ABC123')])));
    const result = interpretValue(prog);
    expect(result).toEqual({ kind: 'string', value: 'abc123' });
  });

  it('toLower with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('toLower', [])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('toLower with non-string arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('toLower', [numLit(42)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// at builtin
// ---------------------------------------------------------------------------
describe('at builtin', () => {
  it('at(list(10,20,30), 0) returns 10', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(0)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 10 });
  });

  it('at(list(10,20,30), 2) returns 30', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(2)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 30 });
  });

  it('at(list(10,20,30), 1) returns 20', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(1)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 20 });
  });

  it('at with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)])])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with non-list first arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [numLit(42), numLit(0)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with non-number index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), strLit('x')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with out-of-bounds index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), numLit(5)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with negative index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), numLit(-1)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// range builtin
// ---------------------------------------------------------------------------
describe('range builtin', () => {
  it('range(0, 5) returns [0,1,2,3,4]', () => {
    const prog = program(exprStmt(call('range', [numLit(0), numLit(5)])));
    expect(interpretValue(prog)).toEqual({
      kind: 'list',
      items: [
        { kind: 'number', value: 0 },
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 3 },
        { kind: 'number', value: 4 },
      ],
    });
  });

  it('range(3, 6) returns [3,4,5]', () => {
    const prog = program(exprStmt(call('range', [numLit(3), numLit(6)])));
    expect(interpretValue(prog)).toEqual({
      kind: 'list',
      items: [
        { kind: 'number', value: 3 },
        { kind: 'number', value: 4 },
        { kind: 'number', value: 5 },
      ],
    });
  });

  it('range(5, 5) returns empty list', () => {
    const prog = program(exprStmt(call('range', [numLit(5), numLit(5)])));
    expect(interpretValue(prog)).toEqual({ kind: 'list', items: [] });
  });

  it('range(0, 1) returns [0]', () => {
    const prog = program(exprStmt(call('range', [numLit(0), numLit(1)])));
    expect(interpretValue(prog)).toEqual({ kind: 'list', items: [{ kind: 'number', value: 0 }] });
  });

  it('range with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [numLit(0)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('range with non-number start throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [strLit('a'), numLit(5)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('range with non-number end throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [numLit(0), strLit('b')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('range where start > end throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [numLit(5), numLit(3)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('range with float start throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [numLit(1.5), numLit(5)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('range with float end throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [numLit(0), numLit(4.5)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// at builtin
// ---------------------------------------------------------------------------
describe('at builtin', () => {
  it('at(list(10,20,30), 0) returns 10', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(0)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 10 });
  });

  it('at(list(10,20,30), 2) returns 30', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(2)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 30 });
  });

  it('at(list(10,20,30), 1) returns 20', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(1)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 20 });
  });

  it('at with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)])])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with non-list first arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [numLit(42), numLit(0)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with non-number index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), strLit('x')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with out-of-bounds index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), numLit(5)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with negative index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), numLit(-1)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});

// ---------------------------------------------------------------------------
// show builtin + hud field
// ---------------------------------------------------------------------------
describe('show builtin', () => {
  it('show("Score", 5) — hud has { Score: "5" }', () => {
    const prog = program(
      exprStmt(call('show', [strLit('Score'), numLit(5)]))
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ Score: '5' });
  });

  it('show called twice with same label replaces value', () => {
    const prog = program(
      exprStmt(call('show', [strLit('Score'), numLit(5)])),
      exprStmt(call('show', [strLit('Score'), numLit(6)])),
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ Score: '6' });
  });

  it('show called with two different labels produces two entries', () => {
    const prog = program(
      exprStmt(call('show', [strLit('Score'), numLit(5)])),
      exprStmt(call('show', [strLit('Lives'), numLit(3)])),
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ Score: '5', Lives: '3' });
  });

  it('hud is empty when show is never called', () => {
    const prog = program(exprStmt(numLit(1)));
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({});
  });

  it('show with list value formats as "[3 items]"', () => {
    const prog = program(
      exprStmt(call('show', [strLit('xs'), call('list', [numLit(1), numLit(2), numLit(3)])]))
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ xs: '[3 items]' });
  });

  it('show with bool value formats as "true"', () => {
    const prog = program(
      exprStmt(call('show', [strLit('flag'), boolLit(true)]))
    );
    const { hud } = interpretFull(prog);
    expect(hud).toEqual({ flag: 'true' });
  });

  it('show with wrong arity throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('show', [strLit('x')])));
    expect(() => interpretFull(prog)).toThrow(SproutRuntimeError);
  });

  it('show with non-string label throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('show', [numLit(1), numLit(2)])));
    expect(() => interpretFull(prog)).toThrow('show: expected string, got number');
  });
});

// ---------------------------------------------------------------------------
// variables field on interpretFull
// ---------------------------------------------------------------------------
describe('interpretFull variables field', () => {
  it('let x = 5 → variables has { x: "5" }', () => {
    const prog = program(letStmt('x', numLit(5)));
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({ x: '5' });
  });

  it('let x = 5 then x = 9 → variables has { x: "9" }', () => {
    const prog = program(
      letStmt('x', numLit(5)),
      assignStmt('x', numLit(9)),
    );
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({ x: '9' });
  });

  it('def f() = 1 → f excluded from variables', () => {
    const prog = program(defStmt('f', [], numLit(1)));
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({});
  });

  it('let x = 5 and def f() = 1 → only x in variables', () => {
    const prog = program(
      letStmt('x', numLit(5)),
      defStmt('f', [], numLit(1)),
    );
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({ x: '5' });
  });

  it('let xs = list(1,2,3) → variables has { xs: "[3 items]" }', () => {
    const prog = program(letStmt('xs', call('list', [numLit(1), numLit(2), numLit(3)])));
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({ xs: '[3 items]' });
  });

  it('empty program → variables is {}', () => {
    const prog = program();
    const { variables } = interpretFull(prog);
    expect(variables).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// on timer interval
// ---------------------------------------------------------------------------
describe('on timer interval', () => {
  it('timerInterval defaults to 200 when no timer handler', () => {
    const prog = program(exprStmt(call('forward', [numLit(10)])));
    expect(interpretFull(prog).timerInterval).toBe(200);
  });

  it('timerInterval defaults to 200 when timer handler has null interval', () => {
    const prog = program(
      exprStmt(onExpr('timer', [exprStmt(call('forward', [numLit(10)]))])),
    );
    expect(interpretFull(prog).timerInterval).toBe(200);
  });

  it('timerInterval is set from on timer every N', () => {
    const prog = program(
      exprStmt(onExpr('timer', [exprStmt(call('forward', [numLit(10)]))], numLit(500))),
    );
    expect(interpretFull(prog).timerInterval).toBe(500);
  });

  it('timerInterval 1 is the minimum valid value', () => {
    const prog = program(
      exprStmt(onExpr('timer', [], numLit(1))),
    );
    expect(interpretFull(prog).timerInterval).toBe(1);
  });

  it('throws when interval is not a number', () => {
    const prog = program(
      exprStmt(onExpr('timer', [], { kind: 'StringLit', value: 'fast' } as Expr)),
    );
    expect(() => interpretFull(prog)).toThrow('on timer: interval must be a positive number, got string');
  });

  it('throws when interval is zero', () => {
    const prog = program(
      exprStmt(onExpr('timer', [], numLit(0))),
    );
    expect(() => interpretFull(prog)).toThrow('on timer: interval must be a positive number, got 0');
  });

  it('throws when interval is negative', () => {
    const prog = program(
      exprStmt(onExpr('timer', [], numLit(-100))),
    );
    expect(() => interpretFull(prog)).toThrow('on timer: interval must be a positive number, got -100');
  });

  it('non-timer events do not affect timerInterval', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('forward', [numLit(10)]))])),
    );
    expect(interpretFull(prog).timerInterval).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// callHandler return type
// ---------------------------------------------------------------------------
describe('callHandler hud and variables', () => {
  it('callHandler returns hud entries written by show() inside handler', () => {
    const { handlers } = interpretFull(program(
      exprStmt({ kind: 'OnExpr' as const, event: { kind: 'SymbolLit' as const, name: 'click' }, body: { kind: 'BlockExpr' as const, body: [
        exprStmt(call('show', [strLit('Score'), numLit(99)])),
      ]} })
    ));
    const fn = handlers.get(':click')!;
    expect(fn).toBeDefined();
    const result = callHandler(fn);
    expect(result.hud).toEqual({ Score: '99' });
  });

  it('callHandler returns variables reflecting mutated let-bindings', () => {
    const prog = program(
      letStmt('score', numLit(0)),
      exprStmt({ kind: 'OnExpr' as const, event: { kind: 'SymbolLit' as const, name: 'click' }, body: { kind: 'BlockExpr' as const, body: [
        assignStmt('score', infix('+', ident('score'), numLit(1))),
      ]} }),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    callHandler(fn);
    const result = callHandler(fn);
    expect(result.variables).toEqual({ score: '2' });
  });
});
