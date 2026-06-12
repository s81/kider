import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { lineToPos, makeRunCommand } from '../src/editor-utils.js';

const doc5 = 'a\nbb\nccc\ndddd\neeeee'; // five lines

describe('lineToPos', () => {
  it('maps line 1 to offset 0', () => {
    expect(lineToPos(EditorState.create({ doc: doc5 }), 1)).toBe(0);
  });
  it('maps line 3 to the start offset of line 3', () => {
    const state = EditorState.create({ doc: doc5 });
    expect(lineToPos(state, 3)).toBe(state.doc.line(3).from);
  });
  it('clamps a line below 1 to line 1', () => {
    expect(lineToPos(EditorState.create({ doc: doc5 }), 0)).toBe(0);
  });
  it('clamps an out-of-range line to the last line', () => {
    const state = EditorState.create({ doc: doc5 });
    expect(lineToPos(state, 999)).toBe(state.doc.line(5).from);
  });
});

describe('makeRunCommand', () => {
  it('calls the current onRun and returns true', () => {
    const fn = vi.fn();
    const cmd = makeRunCommand(() => fn);
    expect(cmd()).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('returns true and does not throw when onRun is undefined', () => {
    const cmd = makeRunCommand(() => undefined);
    expect(cmd()).toBe(true);
  });
});
