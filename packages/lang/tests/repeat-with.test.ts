import { describe, it, expect } from 'vitest';
import { interpret, interpretValue } from '../src/interpreter.js';
import { serializeExpr } from '../src/serializer.js';
import { mkForward, mkSequence, EMPTY } from '../src/values.js';
import type { Program, Expr, Stmt, RepeatExpr } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const ident = (name: string): Expr => ({ kind: 'Ident', name });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const infix = (op: '+' | '-' | '*' | '/', left: Expr, right: Expr): Expr =>
  ({ kind: 'InfixExpr', op, left, right });
const repeatWith = (count: Expr, item: string | null, bodyStmts: Stmt[]): RepeatExpr =>
  ({ kind: 'RepeatExpr', count, item, body: { kind: 'BlockExpr', body: bodyStmts } });
const program = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

describe('repeat with index — interpreter', () => {
  it('binds index 0..n-1 inside the body', () => {
    // repeat 3 with i do forward(i * 10) end
    // interpret wraps top-level in a sequence; each iteration body is a sequence-of-1
    const prog = program(exprStmt(
      repeatWith(numLit(3), 'i', [
        exprStmt(call('forward', [infix('*', ident('i'), numLit(10))])),
      ])
    ));
    expect(interpret(prog)).toEqual(mkSequence([
      mkSequence([
        mkSequence([mkForward(0)]),
        mkSequence([mkForward(10)]),
        mkSequence([mkForward(20)]),
      ]),
    ]));
  });

  it('single iteration binds i = 0', () => {
    const prog = program(exprStmt(
      repeatWith(numLit(1), 'i', [
        exprStmt(call('forward', [ident('i')])),
      ])
    ));
    expect(interpret(prog)).toEqual(mkSequence([
      mkSequence([mkSequence([mkForward(0)])]),
    ]));
  });

  it('zero iterations returns EMPTY', () => {
    const prog = program(exprStmt(
      repeatWith(numLit(0), 'i', [
        exprStmt(call('forward', [ident('i')])),
      ])
    ));
    expect(interpret(prog)).toEqual(mkSequence([EMPTY]));
  });

  it('index variable is not visible after the loop', () => {
    const prog = program(
      exprStmt(repeatWith(numLit(2), 'i', [
        exprStmt(call('forward', [ident('i')])),
      ])),
      exprStmt(ident('i')),
    );
    expect(() => interpretValue(prog)).toThrow("Unbound identifier: 'i'");
  });

  it('plain repeat (item: null) still works unchanged', () => {
    const prog = program(exprStmt(
      repeatWith(numLit(2), null, [
        exprStmt(call('forward', [numLit(50)])),
      ])
    ));
    expect(interpret(prog)).toEqual(mkSequence([
      mkSequence([
        mkSequence([mkForward(50)]),
        mkSequence([mkForward(50)]),
      ]),
    ]));
  });
});

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

describe('repeat with index — serializer', () => {
  it('item: null serializes without with-clause', () => {
    const expr = repeatWith(numLit(4), null, [
      exprStmt(call('forward', [numLit(100)])),
    ]);
    expect(serializeExpr(expr, 0)).toBe('repeat 4 do\n  forward(100)\nend');
  });

  it("item: 'i' serializes with with-clause", () => {
    const expr = repeatWith(numLit(4), 'i', [
      exprStmt(call('forward', [ident('i')])),
    ]);
    expect(serializeExpr(expr, 0)).toBe('repeat 4 with i do\n  forward(i)\nend');
  });
});
