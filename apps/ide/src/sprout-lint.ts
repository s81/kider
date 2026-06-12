import type { EditorState } from '@codemirror/state';
import { linter, type Diagnostic } from '@codemirror/lint';
import { parse, ParseError } from '@sprout/parser';

/** Drop a leading "Line N: " so the hover text isn't redundant with the squiggle. */
export function stripLinePrefix(message: string): string {
  return message.replace(/^Line \d+:\s*/, '');
}

/**
 * Parse the document and, on a ParseError, return one line-level error diagnostic.
 * Pure and DOM-free so it can be tested headlessly via EditorState.create.
 */
export function sproutDiagnostics(state: EditorState): Diagnostic[] {
  const text = state.doc.toString();
  if (!text.trim()) return [];
  try {
    parse(text);
    return [];
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    const target = e.line ?? state.doc.lines; // fall back to the last line
    const clamped = Math.min(Math.max(target, 1), state.doc.lines);
    const line = state.doc.line(clamped);
    return [{
      from: line.from,
      to: line.to,
      severity: 'error',
      message: stripLinePrefix(e.message),
    }];
  }
}

/** CodeMirror extension: underline the line with a syntax error as the user types. */
export const sproutLinter = linter(view => sproutDiagnostics(view.state));
