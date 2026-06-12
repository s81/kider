import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { activeLineField, setActiveLine } from '../src/run-line-highlight.js';

function decoCount(state: EditorState): number {
  const set = state.field(activeLineField);
  let n = 0;
  set.between(0, state.doc.length, () => { n++; });
  return n;
}

function firstDecoRange(state: EditorState): { from: number; to: number } | null {
  const set = state.field(activeLineField);
  let found: { from: number; to: number } | null = null;
  set.between(0, state.doc.length, (from, to) => {
    if (found === null) found = { from, to };
  });
  return found;
}

describe('activeLineField + setActiveLine', () => {
  it('starts with no decorations', () => {
    const state = EditorState.create({ doc: 'circle(20)\nforward(50)\n', extensions: [activeLineField] });
    expect(decoCount(state)).toBe(0);
  });

  it('setActiveLine(2) places a line decoration on line 2', () => {
    const initial = EditorState.create({ doc: 'circle(20)\nforward(50)\n', extensions: [activeLineField] });
    const tr = initial.update({ effects: setActiveLine.of(2) });
    const next = tr.state;
    expect(decoCount(next)).toBe(1);
    const range = firstDecoRange(next)!;
    const line2 = next.doc.line(2);
    expect(range.from).toBe(line2.from);
  });

  it('setActiveLine(null) clears the decoration', () => {
    const initial = EditorState.create({ doc: 'a\nb\n', extensions: [activeLineField] });
    const lit = initial.update({ effects: setActiveLine.of(1) }).state;
    expect(decoCount(lit)).toBe(1);
    const cleared = lit.update({ effects: setActiveLine.of(null) }).state;
    expect(decoCount(cleared)).toBe(0);
  });

  it('clamps an out-of-range line to the document bounds', () => {
    const state = EditorState.create({ doc: 'a\nb\n', extensions: [activeLineField] });
    const high = state.update({ effects: setActiveLine.of(99) }).state;
    expect(decoCount(high)).toBe(1);
    const low = state.update({ effects: setActiveLine.of(0) }).state;
    expect(decoCount(low)).toBe(1);
  });
});
