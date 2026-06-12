# Editor Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three text-editor enhancements to the Sprout IDE — live syntax squiggles, click-a-runtime-error-to-jump-to-its-line, and a `Ctrl/Cmd-Enter` run shortcut.

**Architecture:** All logic is factored into pure functions tested headlessly with `EditorState.create` (the existing `apps/ide/tests/sprout-language.test.ts` pattern — vitest runs in the node environment, no jsdom). CodeMirror/React wiring stays thin and is verified manually. No interpreter, parser, or language changes — `ParseError` and `SproutRuntimeError` already carry a 1-based `line`.

**Tech Stack:** TypeScript, React 19, CodeMirror 6 (`@codemirror/lint`, `@codemirror/view`, `@codemirror/state`), Vitest.

**Design spec:** `docs/superpowers/specs/2026-06-12-editor-polish-design.md`

## File Structure

- **Create** `apps/ide/src/sprout-lint.ts` — `stripLinePrefix`, `sproutDiagnostics`, `sproutLinter` (Feature A).
- **Create** `apps/ide/src/editor-utils.ts` — `lineToPos` (Feature B), `makeRunCommand` (Feature C).
- **Create** `apps/ide/tests/sprout-lint.test.ts`, `apps/ide/tests/editor-utils.test.ts`.
- **Modify** `apps/ide/package.json` — declare `@codemirror/lint`, `@codemirror/view`.
- **Modify** `apps/ide/src/TextPanel.tsx` — add linter, `onRun` keymap + hint, `forwardRef`/`jumpToLine` handle.
- **Modify** `apps/ide/src/App.tsx` — pass `onRun`, restructure runtime-error state, render the clickable jump banner.

---

### Task 1: Declare new CodeMirror dependencies

**Files:**
- Modify: `apps/ide/package.json`

`@codemirror/lint` and `@codemirror/view` are already in the dependency tree (transitive deps of `codemirror`); we only need to declare them directly so we can import from them.

- [ ] **Step 1: Add the two dependencies**

In `apps/ide/package.json`, add the two entries to `dependencies` (keep the list alphabetical):

```json
  "dependencies": {
    "@codemirror/autocomplete": "^6.18.6",
    "@codemirror/language": "^6.10.8",
    "@codemirror/lint": "^6.8.5",
    "@codemirror/state": "^6.5.2",
    "@codemirror/view": "^6.36.8",
    "@sprout/blocks": "workspace:*",
    "@sprout/lang": "workspace:*",
    "@sprout/parser": "workspace:*",
    "blockly": "^10.4.3",
    "codemirror": "^6.0.1",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: completes without error; lockfile updates to record the two direct deps.

- [ ] **Step 3: Commit**

```bash
git add apps/ide/package.json pnpm-lock.yaml
git commit -m "chore(ide): declare @codemirror/lint and @codemirror/view deps"
```

---

### Task 2: Feature A — syntax-error diagnostics (pure logic)

**Files:**
- Create: `apps/ide/src/sprout-lint.ts`
- Test: `apps/ide/tests/sprout-lint.test.ts`

`sproutDiagnostics` parses the document and, on a `ParseError`, returns one line-level `error` diagnostic. `stripLinePrefix` removes the redundant `"Line N: "` from the message (the squiggle already marks the line). `sproutLinter` wraps `sproutDiagnostics` as a CodeMirror extension.

- [ ] **Step 1: Write the failing test**

Create `apps/ide/tests/sprout-lint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { sproutDiagnostics, stripLinePrefix } from '../src/sprout-lint.js';

const state = (doc: string) => EditorState.create({ doc });

describe('stripLinePrefix', () => {
  it('removes a leading "Line N: " prefix', () => {
    expect(stripLinePrefix('Line 4: boom')).toBe('boom');
  });
  it('leaves an unprefixed message unchanged', () => {
    expect(stripLinePrefix('boom')).toBe('boom');
  });
});

describe('sproutDiagnostics', () => {
  it('returns [] for an empty document', () => {
    expect(sproutDiagnostics(state(''))).toEqual([]);
  });
  it('returns [] for a whitespace-only document', () => {
    expect(sproutDiagnostics(state('   \n  '))).toEqual([]);
  });
  it('returns [] for a valid program', () => {
    expect(sproutDiagnostics(state('forward(100)\nturn(90)'))).toEqual([]);
  });
  it('flags a syntax error with exactly one error diagnostic', () => {
    const ds = sproutDiagnostics(state('forward('));
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe('error');
  });
  it('spans the whole error line', () => {
    const doc = 'circle(10)\nforward(';   // error attributed to line 2 (EOF line)
    const ds = sproutDiagnostics(state(doc));
    const line2 = state(doc).doc.line(2);
    expect(ds[0].from).toBe(line2.from);
    expect(ds[0].to).toBe(line2.to);
  });
  it('strips the "Line N:" prefix from the message', () => {
    const ds = sproutDiagnostics(state('forward('));
    expect(ds[0].message).not.toMatch(/^Line \d+:/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- sprout-lint`
Expected: FAIL — `../src/sprout-lint.js` does not exist.

- [ ] **Step 3: Implement `sprout-lint.ts`**

Create `apps/ide/src/sprout-lint.ts`:

```ts
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
    const target = e.line ?? state.doc.lines;             // fall back to the last line
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- sprout-lint`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add apps/ide/src/sprout-lint.ts apps/ide/tests/sprout-lint.test.ts
git commit -m "feat(ide): sprout syntax-error diagnostics (line-level)"
```

---

### Task 3: Feature A — wire the linter into the editor

**Files:**
- Modify: `apps/ide/src/TextPanel.tsx`

Add `sproutLinter` to the editor's extension list. No new unit test (pure wiring; the logic is covered by Task 2). Verified by typecheck + manual.

- [ ] **Step 1: Import the linter**

In `apps/ide/src/TextPanel.tsx`, add an import after the `sprout-language` import:

```ts
import { sproutLanguage, sproutCompletions } from './sprout-language.js';
import { sproutLinter } from './sprout-lint.js';
```

- [ ] **Step 2: Add the linter to the extensions array**

In the `new EditorView({ ... extensions: [...] })` call, add `sproutLinter` right after the `autocompletion(...)` line:

```ts
      extensions: [
        basicSetup,
        sproutLanguage,
        autocompletion({ override: [sproutCompletions] }),
        sproutLinter,
        EDITOR_THEME,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ],
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @sprout/ide typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/ide/src/TextPanel.tsx
git commit -m "feat(ide): show live syntax squiggles in the text editor"
```

---

### Task 4: editor-utils — line offset + run-command helpers (pure logic)

**Files:**
- Create: `apps/ide/src/editor-utils.ts`
- Test: `apps/ide/tests/editor-utils.test.ts`

`lineToPos` maps a 1-based line to a clamped document offset (Feature B). `makeRunCommand` builds the keymap command that invokes the latest `onRun` (Feature C).

- [ ] **Step 1: Write the failing test**

Create `apps/ide/tests/editor-utils.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- editor-utils`
Expected: FAIL — `../src/editor-utils.js` does not exist.

- [ ] **Step 3: Implement `editor-utils.ts`**

Create `apps/ide/src/editor-utils.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- editor-utils`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/ide/src/editor-utils.ts apps/ide/tests/editor-utils.test.ts
git commit -m "feat(ide): editor-utils — lineToPos and makeRunCommand helpers"
```

---

### Task 5: Feature C — inline Run (Ctrl/Cmd-Enter)

**Files:**
- Modify: `apps/ide/src/TextPanel.tsx`
- Modify: `apps/ide/src/App.tsx`

Add an `onRun` prop, a high-precedence `Mod-Enter` keymap, and a shortcut hint. App passes `handleRun`.

- [ ] **Step 1: Add imports to `TextPanel.tsx`**

At the top of `apps/ide/src/TextPanel.tsx`, add `keymap`, `Prec`, and `makeRunCommand`:

```ts
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
import { sproutLanguage, sproutCompletions } from './sprout-language.js';
import { sproutLinter } from './sprout-lint.js';
import { makeRunCommand } from './editor-utils.js';
```

- [ ] **Step 2: Add the `onRun` prop and its ref**

Add `onRun` to `Props`:

```ts
interface Props {
  text: string;
  editable?: boolean;
  onChange?: (text: string) => void;
  error?: string | null;
  onRun?: () => void;
}
```

Destructure it in the component signature (`{ text, editable = false, onChange, error = null, onRun }`) and add a ref next to `onChangeRef`:

```ts
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
```

- [ ] **Step 3: Add the keymap to the extensions array**

Add the keymap as the first extension (highest precedence, so it beats the default newline binding):

```ts
      extensions: [
        Prec.highest(keymap.of([
          { key: 'Mod-Enter', run: makeRunCommand(() => onRunRef.current) },
        ])),
        basicSetup,
        sproutLanguage,
        autocompletion({ override: [sproutCompletions] }),
        sproutLinter,
        EDITOR_THEME,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ],
```

- [ ] **Step 4: Add the shortcut hint under the editor**

In the `if (editable)` return block, add a hint line after the editor `<div>` and before the `{error && (...)}` block:

```tsx
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
        <div
          ref={divRef}
          style={{ flex: '1 1 0', minHeight: 120, overflow: 'auto', borderRadius: 4 }}
        />
        <div style={{ fontSize: 11, color: '#94a3b8' }}>Press Ctrl/⌘+Enter to run</div>
        {error && (
```

- [ ] **Step 5: Pass `onRun` from App**

In `apps/ide/src/App.tsx`, update the `<TextPanel>` usage to pass `onRun`:

```tsx
        <TextPanel
          text={sourceMode === 'blocks' ? programText : editorText}
          editable={sourceMode === 'editor'}
          onChange={setEditorText}
          error={sourceMode === 'editor' ? editorParseError : null}
          onRun={handleRun}
        />
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @sprout/ide typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/ide/src/TextPanel.tsx apps/ide/src/App.tsx
git commit -m "feat(ide): Ctrl/Cmd-Enter runs the program from the editor"
```

---

### Task 6: Feature B — click runtime error to jump to its line

**Files:**
- Modify: `apps/ide/src/TextPanel.tsx`
- Modify: `apps/ide/src/App.tsx`

Expose an imperative `jumpToLine` handle on `TextPanel`; restructure App's runtime-error state to carry the line; render the bottom error banner as a clickable jump button when a line is known and the editor is showing.

- [ ] **Step 1: Add the `EditorHandle` and imports to `TextPanel.tsx`**

Update the React import to include `forwardRef` and `useImperativeHandle`, and import `lineToPos`:

```ts
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
```

```ts
import { makeRunCommand } from './editor-utils.js';
import { lineToPos } from './editor-utils.js';
```

(Or combine into one line: `import { lineToPos, makeRunCommand } from './editor-utils.js';`)

Add the handle interface above `interface Props`:

```ts
export interface EditorHandle {
  jumpToLine(line: number): void;
}
```

- [ ] **Step 2: Convert `TextPanel` to `forwardRef` and add the handle**

Change the component declaration from:

```tsx
export function TextPanel({ text, editable = false, onChange, error = null, onRun }: Props) {
```

to:

```tsx
export const TextPanel = forwardRef<EditorHandle, Props>(function TextPanel(
  { text, editable = false, onChange, error = null, onRun }: Props,
  ref,
) {
```

Add the imperative handle right after the `onRunRef` lines:

```ts
  useImperativeHandle(ref, () => ({
    jumpToLine(line: number) {
      const view = viewRef.current;
      if (!view) return;
      const pos = lineToPos(view.state, line);
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    },
  }), []);
```

At the very end of the component, change the closing `}` of `function TextPanel(...)` to close the `forwardRef` call. The file currently ends:

```tsx
  return (
    <pre ...>
      {text || '// drag blocks to start'}
    </pre>
  );
}
```

Change the final `}` to `});`:

```tsx
  return (
    <pre ...>
      {text || '// drag blocks to start'}
    </pre>
  );
});
```

- [ ] **Step 3: Typecheck TextPanel changes**

Run: `pnpm --filter @sprout/ide typecheck`
Expected: errors only in `App.tsx` (it still treats `error` as a string and passes no `ref`); `TextPanel.tsx` itself is clean. Proceed to wire App.

- [ ] **Step 4: Restructure App's runtime-error state**

In `apps/ide/src/App.tsx`:

**(a)** Update the `TextPanel` import to also import the handle type:

```ts
import { TextPanel, type EditorHandle } from './TextPanel.js';
```

**(b)** Add the `RunError` type and `toRunError` helper above the `App` component (after the imports, before `export function App()`):

```ts
type RunError = { message: string; line: number | null };

function toRunError(e: unknown): RunError {
  if (e instanceof SproutRuntimeError || e instanceof ParseError) {
    return { message: e.message, line: e.line ?? null };
  }
  return { message: String(e), line: null };
}
```

**(c)** Change the error state declaration:

```ts
  const [error, setError] = useState<RunError | null>(null);
```

**(d)** Add an editor ref next to the other refs (e.g. after `const fileInputRef = useRef<HTMLInputElement>(null);`):

```ts
  const editorRef = useRef<EditorHandle>(null);
```

- [ ] **Step 5: Update the four error-setting call sites**

Replace each runtime-error `setError(...)` with the structured helper (the two `setError(null)` resets stay as-is):

In the keydown handler:
```ts
      try {
        applyHandlerDelta(callHandler(fn));
      } catch (err) {
        setError(toRunError(err));
      }
```

In the timer `setInterval` callback:
```ts
          } catch (e) {
            setError(toRunError(e));
            if (timerRef.current !== null) {
```

In the `handleRun` catch block, replace the whole `if/else`:
```ts
    } catch (e) {
      setError(toRunError(e));
      setCommands([]);
      setHandlers(new Map());
      handlersRef.current = new Map();
      accDrawingRef.current = null;
      setSprites([]);
    }
```

In `handleCanvasClick`:
```ts
    } catch (e) {
      setError(toRunError(e));
    }
```

- [ ] **Step 6: Pass the ref and render the clickable banner**

Add `ref={editorRef}` to the `<TextPanel>` element:

```tsx
        <TextPanel
          ref={editorRef}
          text={sourceMode === 'blocks' ? programText : editorText}
          editable={sourceMode === 'editor'}
          onChange={setEditorText}
          error={sourceMode === 'editor' ? editorParseError : null}
          onRun={handleRun}
        />
```

Replace the bottom error block (`{error && (<pre ...>{error}</pre>)}`) with:

```tsx
        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 8,
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            <div>{error.message}</div>
            {error.line != null && sourceMode === 'editor' && (
              <button
                onClick={() => editorRef.current?.jumpToLine(error.line!)}
                style={{
                  marginTop: 4,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#2563eb',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Line {error.line} · click to go there
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 7: Typecheck and run the full suite**

Run: `pnpm --filter @sprout/ide typecheck`
Expected: no errors.

Run: `npm test`
Expected: all tests pass (the previous 1019 plus the new `sprout-lint` and `editor-utils` suites).

- [ ] **Step 8: Commit**

```bash
git add apps/ide/src/TextPanel.tsx apps/ide/src/App.tsx
git commit -m "feat(ide): click a runtime error to jump to its line in the editor"
```

---

### Task 7: Manual verification

**Files:** none (manual QA of the running app).

Unit tests cover the pure logic; these steps confirm the CodeMirror/React wiring. Run the dev server and check each feature.

- [ ] **Step 1: Start the app**

Run: `pnpm --filter @sprout/ide dev`
Open the printed local URL and switch to the **Text** tab.

- [ ] **Step 2: Syntax squiggles (Feature A)**

Type `forward(` on a line. Expected: a red wavy underline appears under that line within a moment; hovering shows the parser message (without a leading "Line N:"). The existing red message box also shows the error. Complete the line to `forward(100)` — the squiggle disappears.

- [ ] **Step 3: Inline Run (Feature C)**

Type a valid program (e.g. `circle(50)`), then press `Ctrl+Enter` (or `Cmd+Enter` on macOS). Expected: the program runs (the stage updates) and no newline is inserted in the editor. The hint "Press Ctrl/⌘+Enter to run" is visible under the editor.

- [ ] **Step 4: Click-to-jump (Feature B)**

Type a program whose third line makes a runtime type error, e.g.:
```
circle(50)
turn(90)
forward("x")
```
Click **▶ Run**. Expected: the bottom error banner shows the message plus a blue underlined "Line 3 · click to go there". Click it — the editor focuses and the cursor moves to line 3.

- [ ] **Step 5: Blocks-mode regression check**

Switch to the **Blocks** tab, drag a couple of blocks, and click Run. Expected: no jump link appears for any error (blocks ASTs have no line), and the editor (read-only generated code) behaves as before.

---

## Self-Review

**Spec coverage:**
- ✅ Feature A (live squiggles) — Task 2 (logic) + Task 3 (wiring).
- ✅ Feature B (click-to-jump) — Task 4 (`lineToPos`) + Task 6 (handle + structured error + banner).
- ✅ Feature C (inline Run) — Task 4 (`makeRunCommand`) + Task 5 (keymap + hint + pass-through).
- ✅ Dependencies — Task 1.
- ✅ Verification — Task 6 Step 7 (automated) + Task 7 (manual).
- ✅ Out of scope (running-line highlight, column precision) — not planned, matching the spec.

**Placeholder scan:** none — every code step shows complete content.

**Type consistency:**
- `sproutDiagnostics(state: EditorState): Diagnostic[]` — used by `sproutLinter` (Task 2) ✓.
- `lineToPos(state, line): number` — defined Task 4, consumed by `jumpToLine` (Task 6) ✓.
- `makeRunCommand(() => onRunRef.current)` — `getOnRun` returns `(() => void) | undefined`; `onRunRef.current` is `(() => void) | undefined` ✓.
- `EditorHandle { jumpToLine(line: number): void }` — exported by TextPanel (Task 6 Step 1), imported as a type and used as `useRef<EditorHandle>(null)` in App (Task 6 Step 4) ✓.
- `RunError { message: string; line: number | null }` — `error` state type; banner reads `error.message` and `error.line` (Task 6) ✓.
- `toRunError(e: unknown): RunError` — used at all four catch sites (Task 6 Step 5) ✓.
- `ParseError`/`SproutRuntimeError` already imported in `App.tsx` (lines 14, 16) — `toRunError` reuses them, no new imports needed ✓.
