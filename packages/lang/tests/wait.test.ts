import { describe, it, expect } from 'vitest';
import { interpret, SproutRuntimeError } from '../src/interpreter.js';
import { render } from '../src/renderer.js';
import { mkWait } from '../src/values.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

// ---------------------------------------------------------------------------
// AST builder helpers
// ---------------------------------------------------------------------------

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

// ---------------------------------------------------------------------------
// Interpreter tests
// ---------------------------------------------------------------------------

// Helper to unwrap a single-element sequence from interpret's result
function unwrapSingle(drawing: ReturnType<typeof interpret>) {
  if (drawing.kind === 'sequence' && drawing.steps.length === 1) return drawing.steps[0];
  return drawing;
}

describe('wait builtin — interpreter', () => {
  it('wait(1) returns { kind: "wait", seconds: 1 }', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('wait', [numLit(1)])))));
    expect(result).toEqual({ kind: 'wait', seconds: 1 });
  });

  it('wait(0) is valid and returns { kind: "wait", seconds: 0 }', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('wait', [numLit(0)])))));
    expect(result).toEqual({ kind: 'wait', seconds: 0 });
  });

  it('wait(2.5) returns { kind: "wait", seconds: 2.5 }', () => {
    const result = unwrapSingle(interpret(prog(exprStmt(call('wait', [numLit(2.5)])))));
    expect(result).toEqual({ kind: 'wait', seconds: 2.5 });
  });

  it('wait(-1) throws SproutRuntimeError', () => {
    expect(() =>
      interpret(prog(exprStmt(call('wait', [numLit(-1)]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(prog(exprStmt(call('wait', [numLit(-1)]))))
    ).toThrow('wait: seconds must be non-negative');
  });

  it('wait() with 0 args throws SproutRuntimeError', () => {
    expect(() =>
      interpret(prog(exprStmt(call('wait', []))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(prog(exprStmt(call('wait', []))))
    ).toThrow('wait expects 1 argument');
  });

  it('wait(1, 2) with 2 args throws SproutRuntimeError', () => {
    expect(() =>
      interpret(prog(exprStmt(call('wait', [numLit(1), numLit(2)]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(prog(exprStmt(call('wait', [numLit(1), numLit(2)]))))
    ).toThrow('wait expects 1 argument');
  });
});

// ---------------------------------------------------------------------------
// Renderer tests
// ---------------------------------------------------------------------------

describe('wait — renderer', () => {
  it('render of wait(1) Drawing produces { kind: "wait", durationMs: 1000 }', () => {
    const waitDrawing = mkWait(1);
    const cmds = render(waitDrawing);
    expect(cmds).toEqual([{ kind: 'wait', durationMs: 1000 }]);
  });

  it('render of wait(2.5) Drawing produces durationMs: 2500', () => {
    const cmds = render(mkWait(2.5));
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({ kind: 'wait', durationMs: 2500 });
  });

  it('render of sequence [forward(50), wait(2), forward(50)] has wait in the middle', () => {
    const drawing = interpret(prog(
      exprStmt(call('forward', [numLit(50)])),
      exprStmt(call('wait', [numLit(2)])),
      exprStmt(call('forward', [numLit(50)])),
    ));
    const cmds = render(drawing);
    // Should contain: lineTo (from forward 50), wait, then lineTo (from second forward 50)
    const waitCmds = cmds.filter(c => c.kind === 'wait');
    expect(waitCmds).toHaveLength(1);
    expect(waitCmds[0]).toEqual({ kind: 'wait', durationMs: 2000 });
    // The wait should appear between the two lineTo commands
    const waitIdx = cmds.findIndex(c => c.kind === 'wait');
    expect(waitIdx).toBeGreaterThan(0);
    expect(waitIdx).toBeLessThan(cmds.length - 1);
  });
});

// ---------------------------------------------------------------------------
// buildPlayback tests (inline implementation to avoid browser-dep issues)
// ---------------------------------------------------------------------------

type CanvasCommand = { kind: 'wait'; durationMs: number } | { kind: 'lineTo'; x: number; y: number } | { kind: string };

type PlaybackSegment =
  | { kind: 'draw'; upTo: number }
  | { kind: 'wait'; durationMs: number };

function buildPlayback(commands: CanvasCommand[]): PlaybackSegment[] {
  const segments: PlaybackSegment[] = [];
  let drawEnd = -1;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (cmd.kind === 'wait') {
      if (drawEnd >= 0) segments.push({ kind: 'draw', upTo: drawEnd });
      segments.push({ kind: 'wait', durationMs: (cmd as { kind: 'wait'; durationMs: number }).durationMs });
      drawEnd = -1;
    } else {
      drawEnd = i;
    }
  }
  if (drawEnd >= 0) segments.push({ kind: 'draw', upTo: drawEnd });
  return segments;
}

const drawCmd = (i: number): CanvasCommand => ({ kind: 'lineTo', x: i, y: i });
const waitCmd = (ms: number): CanvasCommand => ({ kind: 'wait', durationMs: ms });

describe('buildPlayback', () => {
  it('no wait commands → single draw segment covering all commands', () => {
    const cmds = [drawCmd(0), drawCmd(1), drawCmd(2)];
    const segments = buildPlayback(cmds);
    expect(segments).toEqual([{ kind: 'draw', upTo: 2 }]);
  });

  it('empty commands → empty segments', () => {
    expect(buildPlayback([])).toEqual([]);
  });

  it('wait in middle → [draw, wait, draw]', () => {
    const cmds = [drawCmd(0), drawCmd(1), waitCmd(1000), drawCmd(3), drawCmd(4)];
    const segments = buildPlayback(cmds);
    expect(segments).toEqual([
      { kind: 'draw', upTo: 1 },
      { kind: 'wait', durationMs: 1000 },
      { kind: 'draw', upTo: 4 },
    ]);
  });

  it('wait at start → [wait, draw]', () => {
    const cmds = [waitCmd(500), drawCmd(1), drawCmd(2)];
    const segments = buildPlayback(cmds);
    expect(segments).toEqual([
      { kind: 'wait', durationMs: 500 },
      { kind: 'draw', upTo: 2 },
    ]);
  });

  it('wait at end → [draw, wait]', () => {
    const cmds = [drawCmd(0), drawCmd(1), waitCmd(2000)];
    const segments = buildPlayback(cmds);
    expect(segments).toEqual([
      { kind: 'draw', upTo: 1 },
      { kind: 'wait', durationMs: 2000 },
    ]);
  });

  it('consecutive waits → each becomes its own segment, no empty draw between them', () => {
    const cmds = [waitCmd(100), waitCmd(200), waitCmd(300)];
    const segments = buildPlayback(cmds);
    expect(segments).toEqual([
      { kind: 'wait', durationMs: 100 },
      { kind: 'wait', durationMs: 200 },
      { kind: 'wait', durationMs: 300 },
    ]);
  });

  it('draw then consecutive waits → [draw, wait, wait]', () => {
    const cmds = [drawCmd(0), waitCmd(100), waitCmd(200)];
    const segments = buildPlayback(cmds);
    expect(segments).toEqual([
      { kind: 'draw', upTo: 0 },
      { kind: 'wait', durationMs: 100 },
      { kind: 'wait', durationMs: 200 },
    ]);
  });

  it('single draw command → single draw segment', () => {
    const cmds = [drawCmd(0)];
    const segments = buildPlayback(cmds);
    expect(segments).toEqual([{ kind: 'draw', upTo: 0 }]);
  });

  it('single wait command → single wait segment', () => {
    const cmds = [waitCmd(1500)];
    const segments = buildPlayback(cmds);
    expect(segments).toEqual([{ kind: 'wait', durationMs: 1500 }]);
  });
});
