import { describe, it, expect } from 'vitest';
import { interpret, interpretFull, callHandler, SproutRuntimeError } from '../src/interpreter.js';
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
  PEN_UP,
  PEN_DOWN,
} from '../src/values.js';
import type { Program, Expr, Stmt, InfixExpr, LetStmt, AssignStmt, WhileExpr } from '../src/ast.js';

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

const program = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

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
const onExpr = (eventName: string, bodyStmts: Stmt[]): Expr => ({
  kind: 'OnExpr',
  event: { kind: 'SymbolLit', name: eventName },
  body: { kind: 'BlockExpr', body: bodyStmts },
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
    const delta = callHandler(fn);
    expect(delta).toEqual(mkSequence([mkForward(30)]));
  });

  it('returns EMPTY when handler body produces no drawing', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('puts', [numLit(1)]))])),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    const delta = callHandler(fn);
    expect(delta).toEqual(mkSequence([EMPTY]));
  });

  it('handler closure captures variables defined before the on-expr', () => {
    const prog = program(
      defStmt('step', [], call('forward', [numLit(5)])),
      exprStmt(onExpr('click', [exprStmt(call('step', []))])),
    );
    const { handlers } = interpretFull(prog);
    const fn = handlers.get(':click')!;
    const delta = callHandler(fn);
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
  it('random(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('random', [numLit(0)])]))))).toEqual(mkSequence([mkForward(0)]));
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
  });
  it('rect throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('rect', [numLit(100)]))))).toThrow(SproutRuntimeError);
  });
  it('ellipse throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('ellipse', [numLit(10)]))))).toThrow(SproutRuntimeError);
  });
  it('triangle throws with 0 args', () => {
    expect(() => interpret(program(exprStmt(call('triangle', []))))).toThrow(SproutRuntimeError);
  });
});
