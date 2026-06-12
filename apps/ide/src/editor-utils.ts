import type { EditorState } from '@codemirror/state';

/** Document offset of the start of a 1-based line, clamped to the document's range. */
export function lineToPos(state: EditorState, line: number): number {
  const clamped = Math.min(Math.max(line, 1), state.doc.lines);
  return state.doc.line(clamped).from;
}

/**
 * Build a CodeMirror keymap command that runs the latest onRun callback.
 * `getOnRun` reads a ref so the command never goes stale. Returns true to
 * consume the key event (suppressing the default newline insert).
 */
export function makeRunCommand(getOnRun: () => (() => void) | undefined) {
  return (): boolean => {
    getOnRun()?.();
    return true;
  };
}
