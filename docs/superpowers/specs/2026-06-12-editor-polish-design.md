# Editor Polish — Design Spec

**Date:** 2026-06-12
**Status:** Approved, ready for implementation planning

## Goal

Three independent enhancements to the Sprout text editor (`apps/ide/src/TextPanel.tsx`, CodeMirror 6):

- **A. Live syntax squiggles** — red underline on the line with a syntax error, as you type.
- **B. Click runtime error → jump to line** — a runtime-error banner that, when it carries a line, jumps the cursor there on click.
- **C. Inline Run** — `Ctrl/Cmd-Enter` in the editor runs the program.

**No interpreter, parser, or language changes.** All the line plumbing required already exists:
- `ParseError` (`packages/parser/src/lexer.ts:25`) carries a 1-based `line: number | undefined`.
- `SproutRuntimeError` (`packages/lang/src/interpreter.ts:74`) carries a 1-based `line: number | undefined` (text mode only).

## Tech stack

TypeScript, React 19, CodeMirror 6, Vitest. Tests run in the **node** environment (no jsdom — see `vitest.config.ts`), so all new logic is factored into pure functions exercised headlessly with `EditorState.create({ doc })`, matching the existing `apps/ide/tests/sprout-language.test.ts` pattern.

## Dependencies

Add to `apps/ide/package.json` `dependencies` (both already resolved transitively via `codemirror`, so `pnpm install` only adds direct declarations):

- `@codemirror/lint` — `linter`, `Diagnostic`, used for squiggles.
- `@codemirror/view` — `keymap`, used for the run shortcut.

`@codemirror/state` (for `EditorState`, `Prec`) is already a direct dependency.

---

## Feature A — Live syntax squiggles

### Behavior
While typing in the text editor, the line containing a syntax error gets a red wavy underline; hovering shows the parser's message. The existing persistent red message box (driven by App's `editorParseError`) **stays** — squiggle gives precise location, box gives always-visible text. Both are kid-friendly together.

Precision is **line-level**, not column-level: the lexer tracks line but not column. Column precision is a future enhancement, explicitly out of scope.

### Implementation
New file `apps/ide/src/sprout-lint.ts`:

```ts
import { EditorState } from '@codemirror/state';
import { linter, type Diagnostic } from '@codemirror/lint';
import { parse, ParseError } from '@sprout/parser';

/** Pure, headless-testable: parse the doc and return a line-level diagnostic on ParseError. */
export function sproutDiagnostics(state: EditorState): Diagnostic[] {
  const text = state.doc.toString();
  if (!text.trim()) return [];
  try {
    parse(text);
    return [];
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    const lineNo = e.line ?? state.doc.lines;          // fall back to last line
    const clamped = Math.min(Math.max(lineNo, 1), state.doc.lines);
    const line = state.doc.line(clamped);
    return [{
      from: line.from,
      to: line.to,
      severity: 'error',
      message: stripLinePrefix(e.message),             // drop redundant "Line N: "
    }];
  }
}

export const sproutLinter = linter(view => sproutDiagnostics(view.state));
```

- `stripLinePrefix` removes a leading `"Line N: "` so the hover text isn't redundant with the squiggle's location. Pure, separately testable.
- Add `sproutLinter` to TextPanel's `extensions` array.

### Why a self-contained linter (not prop-threading)
Keeps parsing-for-squiggles co-located with the editor and idiomatic to CodeMirror. App's existing parse effect stays untouched. Cost is one extra parse per keystroke on a kid-sized program — negligible.

### Tests (`apps/ide/tests/sprout-lint.test.ts`, headless)
- empty / whitespace doc → `[]`
- valid program → `[]`
- `forward(` (unterminated call) → exactly one `severity: 'error'` diagnostic; `from`/`to` equal the bounds of the error line
- multi-line doc with the error on line 3 → diagnostic `from`/`to` fall within line 3
- diagnostic `message` has no `"Line N:"` prefix
- `stripLinePrefix('Line 4: boom')` → `'boom'`; `stripLinePrefix('boom')` → `'boom'`

---

## Feature B — Click runtime error → jump to line

### Behavior
After a Run that throws a runtime error carrying a line (text mode only), the bottom error banner renders as a clickable "Line N · click to go there". Clicking moves the cursor to that line's start, scrolls it into view, and focuses the editor. **Click-only** — no auto-jump (auto-jumping would yank the cursor away mid-edit). In blocks mode the banner is plain text (block ASTs carry no line).

### Implementation
**App.tsx:**
- Change `error` state from `string | null` to `RunError | null`:
  ```ts
  type RunError = { message: string; line: number | null };
  ```
- Add a helper to DRY the catch sites:
  ```ts
  function toRunError(e: unknown): RunError {
    if (e instanceof SproutRuntimeError || e instanceof ParseError)
      return { message: e.message, line: e.line ?? null };
    return { message: String(e), line: null };
  }
  ```
- Update the four error-setting sites to `setError(toRunError(e))`: key handler (`App.tsx:170`), timer callback (`:303`), `handleRun` catch (`:314`), canvas click (`:333`). The two `setError(null)` resets (`:54`, `:269`) are unchanged.
- Hold an `editorRef` (`useRef<EditorHandle>(null)`) passed to `TextPanel`.
- Render the bottom banner (`App.tsx:707-721`): when `error.line != null && sourceMode === 'editor'`, render a clickable element ("`Line {error.line} · click to go there`") calling `editorRef.current?.jumpToLine(error.line)`; otherwise render `error.message` as plain text as today.

**TextPanel.tsx:**
- Convert to `forwardRef` and expose via `useImperativeHandle`:
  ```ts
  export interface EditorHandle { jumpToLine(line: number): void; }
  ```
- `jumpToLine` uses the pure mapping helper, then dispatches:
  ```ts
  const pos = lineToPos(view.state, line);
  view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
  view.focus();
  ```
- Pure helper in a new `apps/ide/src/editor-utils.ts`:
  ```ts
  /** Document offset of the start of a 1-based line, clamped to the doc's range. */
  export function lineToPos(state: EditorState, line: number): number {
    const clamped = Math.min(Math.max(line, 1), state.doc.lines);
    return state.doc.line(clamped).from;
  }
  ```

### Tests (`apps/ide/tests/editor-utils.test.ts`)
- `lineToPos`: line 1 → 0; line 3 of a known 5-line doc → the expected offset; line 0 → 0 (clamps to line 1); line 999 → start of the last line.

---

## Feature C — Inline Run (Ctrl/Cmd-Enter)

### Behavior
Pressing `Ctrl+Enter` (`Cmd+Enter` on Mac) while the editor is focused runs the program and suppresses the newline. A muted hint under the editor reads "Press Ctrl/⌘+Enter to run".

### Implementation
**TextPanel.tsx:**
- New prop `onRun?: () => void`, held in `onRunRef` (same pattern as `onChangeRef`) so the editor doesn't remount when the callback identity changes.
- Add a high-precedence keymap to the extensions so it fires before CodeMirror's default newline insert:
  ```ts
  import { keymap } from '@codemirror/view';
  import { Prec } from '@codemirror/state';

  Prec.highest(keymap.of([{
    key: 'Mod-Enter',
    run: () => { onRunRef.current?.(); return true; },
  }]))
  ```
- Render a small muted hint line under the editor in editable mode.

**App.tsx:** pass `onRun={handleRun}` to `TextPanel`.

### Tests
- Factor the command as a tiny pure factory, alongside `lineToPos` in `apps/ide/src/editor-utils.ts`:
  ```ts
  export function makeRunCommand(getOnRun: () => (() => void) | undefined) {
    return () => { getOnRun()?.(); return true; };
  }
  ```
  Test (in `apps/ide/tests/editor-utils.test.ts`): invoking the returned command calls the callback and returns `true`; with no callback it still returns `true` and does not throw. (Actual keymap wiring is manual-verified.)

---

## Out of scope (deferred)

- **Running-line highlight during animation** — requires threading source lines through interpreter → canvas commands → playback; the eager-eval + command-replay architecture has no "current line" to show. Separate future project.
- **Column-precise squiggles** — needs lexer column tracking.

## Verification

- `npm test` green, including new pure-function suites: A → `apps/ide/tests/sprout-lint.test.ts`; B + C → `apps/ide/tests/editor-utils.test.ts`.
- `pnpm --filter @sprout/ide typecheck` clean.
- Manual pass in the running app:
  1. Type `forward(` → red squiggle on that line + message box.
  2. Run a program that throws on a specific line (e.g. `forward("x")` in text mode) → banner shows "Line N · click to go there"; clicking moves the cursor there.
  3. Press `Ctrl/Cmd-Enter` → program runs, no newline inserted.

## Self-review

- **Placeholders:** none.
- **Consistency:** error-state type change (B) is the only cross-cutting edit; A and C are additive. All three share the headless-pure-function test approach.
- **Scope:** single implementation plan; three small, independent tasks plus a dependency-declaration step.
- **Ambiguity:** "running line" deliberately excluded; squiggle precision fixed at line-level; jump is click-only. All resolved.
