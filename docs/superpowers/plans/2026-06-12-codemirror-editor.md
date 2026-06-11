# CodeMirror Editor Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain `<textarea>` in `TextPanel.tsx` with a CodeMirror 6 editor that provides syntax highlighting and autocomplete for Sprout keywords, builtins, and user-defined names.

**Architecture:** A new `sprout-language.ts` module exports a `StreamLanguage` tokenizer and a `CompletionSource` function. `TextPanel.tsx` mounts a `EditorView` in a `useEffect`, wires the `updateListener` to `onChange`, and a second `useEffect` syncs externally-set `text` prop changes. The red error div is unchanged.

**Tech Stack:** CodeMirror 6 (`codemirror`, `@codemirror/language`, `@codemirror/autocomplete`), React, TypeScript, Vitest.

---

## File Map

| File | Change |
|---|---|
| `apps/ide/package.json` | Add `codemirror`, `@codemirror/autocomplete`, `@codemirror/language` |
| `apps/ide/src/sprout-language.ts` | New: language tokenizer + autocomplete completions |
| `apps/ide/src/TextPanel.tsx` | Replace `<textarea>` with CodeMirror `EditorView` |
| `apps/ide/tests/sprout-language.test.ts` | New: tests for constants and completions |

---

### Task 1: Install CodeMirror dependencies

**Files:**
- Modify: `apps/ide/package.json`

- [ ] **Step 1: Edit `apps/ide/package.json` to add the three packages**

In the `"dependencies"` object, add:

```json
"codemirror": "^6.0.1",
"@codemirror/autocomplete": "^6.18.6",
"@codemirror/language": "^6.10.8"
```

The full dependencies block becomes:

```json
"dependencies": {
  "@sprout/blocks": "workspace:*",
  "@sprout/lang": "workspace:*",
  "@sprout/parser": "workspace:*",
  "blockly": "^10.4.3",
  "codemirror": "^6.0.1",
  "@codemirror/autocomplete": "^6.18.6",
  "@codemirror/language": "^6.10.8",
  "react": "^19.1.0",
  "react-dom": "^19.1.0"
}
```

- [ ] **Step 2: Install packages**

```bash
npm install
```

Expected: No errors. `node_modules/codemirror` and `node_modules/@codemirror/language` appear.

- [ ] **Step 3: Commit**

```bash
git add apps/ide/package.json
git commit -m "chore(ide): add CodeMirror 6 dependencies"
```

---

### Task 2: Create `sprout-language.ts`

**Files:**
- Create: `apps/ide/src/sprout-language.ts`

This file exports two constants and two language artifacts:
- `SPROUT_KEYWORDS` — all language keywords
- `SPROUT_BUILTINS` — all builtin function names (hardcoded from the interpreter's `BUILTINS` map)
- `sproutLanguage` — a CodeMirror `LanguageSupport` for syntax highlighting
- `sproutCompletions` — a CodeMirror `CompletionSource` for autocomplete

- [ ] **Step 1: Create the file**

Create `apps/ide/src/sprout-language.ts` with the following content:

```ts
import { StreamLanguage, LanguageSupport } from '@codemirror/language';
import type { CompletionContext, CompletionSource } from '@codemirror/autocomplete';

// ---------------------------------------------------------------------------
// Keywords and builtins
// ---------------------------------------------------------------------------

export const SPROUT_KEYWORDS: readonly string[] = [
  'repeat', 'with', 'while', 'if', 'else', 'do', 'end',
  'let', 'set', 'loop', 'forever', 'for', 'each', 'in',
  'def', 'return', 'on', 'timer', 'every', 'fill', 'not',
  'and', 'or', 'true', 'false',
];

export const SPROUT_BUILTINS: readonly string[] = [
  // Motion
  'forward', 'turn', 'arc', 'goto', 'home', 'stamp',
  'hideTurtle', 'showTurtle', 'getX', 'getY', 'getHeading',
  // Pen
  'penUp', 'penDown', 'color', 'randomColor', 'background',
  'clearCanvas', 'penWidth',
  // Shapes
  'circle', 'rect', 'ellipse', 'triangle', 'polygon', 'text',
  'beside', 'above', 'scale',
  // Sprites
  'sprite', 'moveSprite', 'turnSprite', 'gotoSprite',
  'changeSpriteX', 'changeSpriteY', 'spriteX', 'spriteY',
  'spritesTouching', 'hideSprite', 'showSprite', 'removeSprite',
  'bounceSprite', 'cloneSprite',
  // Control
  'stopTimer', 'wait', 'beep', 'playNote',
  // Input
  'keyDown', 'mouseX', 'mouseY', 'textInput', 'input',
  'random', 'touching', 'distance',
  // Display
  'show', 'puts',
  // Math
  'sin', 'cos', 'tan', 'abs', 'sqrt', 'pow', 'mod',
  'log', 'floor', 'ceil', 'round', 'max', 'min', 'pi',
  // Strings
  'join', 'length', 'split', 'contains', 'toUpper', 'toLower',
  // Lists
  'list', 'range', 'at', 'get', 'first', 'last', 'pick',
  'indexOf', 'slice', 'size', 'isEmpty', 'push', 'pop',
  'concat', 'reverse', 'sort', 'map', 'filter', 'reduce',
];

const SPROUT_SYMBOLS: readonly string[] = [
  ':red', ':orange', ':yellow', ':green', ':blue', ':purple',
  ':white', ':black', ':gray', ':pink', ':cyan',
  ':left', ':right', ':up', ':down', ':space', ':enter', ':timer',
];

// ---------------------------------------------------------------------------
// StreamLanguage tokenizer for syntax highlighting
// ---------------------------------------------------------------------------

const KEYWORD_SET = new Set(SPROUT_KEYWORDS);

const sproutStreamLanguage = StreamLanguage.define<object>({
  token(stream) {
    // Comment
    if (stream.match(/^#.*/)) return 'comment';
    // String literal
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
    // Number (integer or decimal)
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';
    // Symbol literal (:name)
    if (stream.match(/^:[a-zA-Z_]\w*/)) return 'atom';
    // Identifier or keyword
    const ident = stream.match(/^[a-zA-Z_]\w*/);
    if (ident) {
      const word = Array.isArray(ident) ? ident[0] : ident;
      if (KEYWORD_SET.has(word as string)) return 'keyword';
      return 'variableName';
    }
    // Skip whitespace and operators one character at a time
    stream.next();
    return null;
  },
  name: 'sprout',
});

export const sproutLanguage = new LanguageSupport(sproutStreamLanguage);

// ---------------------------------------------------------------------------
// Autocomplete completion source
// ---------------------------------------------------------------------------

export const sproutCompletions: CompletionSource = (context: CompletionContext) => {
  const word = context.matchBefore(/[\w:]+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const typed = word.text;

  // Symbol completions: after ':'
  if (typed.startsWith(':')) {
    return {
      from: word.from,
      options: SPROUT_SYMBOLS.map(s => ({ label: s, type: 'constant' })),
    };
  }

  // Scan current document for user-defined names: let <name> and def <name>
  const docText = context.state.doc.toString();
  const userNames: string[] = [];
  for (const match of docText.matchAll(/(?:let|def)\s+([a-zA-Z_]\w*)/g)) {
    if (match[1] && !userNames.includes(match[1])) {
      userNames.push(match[1]);
    }
  }

  return {
    from: word.from,
    options: [
      ...SPROUT_BUILTINS.map(b => ({ label: b, type: 'function' })),
      ...SPROUT_KEYWORDS.map(k => ({ label: k, type: 'keyword' })),
      ...userNames.map(n => ({ label: n, type: 'variable' })),
    ],
  };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck 2>&1 | head -20
```

Expected: No errors for `sprout-language.ts`. (TextPanel.tsx may still complain since we haven't changed it yet — that's fine.)

- [ ] **Step 3: Commit**

```bash
git add apps/ide/src/sprout-language.ts
git commit -m "feat(ide): Sprout language definition for CodeMirror (tokenizer + autocomplete)"
```

---

### Task 3: Tests for `sprout-language.ts`

**Files:**
- Create: `apps/ide/tests/sprout-language.test.ts`

These tests do NOT instantiate an `EditorView` (no DOM required). They only test the exported constants and the completion function by constructing a minimal `EditorState`.

- [ ] **Step 1: Create the test file**

Create `apps/ide/tests/sprout-language.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import {
  SPROUT_BUILTINS,
  SPROUT_KEYWORDS,
  sproutCompletions,
} from '../src/sprout-language.js';

describe('SPROUT_BUILTINS', () => {
  it('is non-empty', () => {
    expect(SPROUT_BUILTINS.length).toBeGreaterThan(0);
  });

  it('contains core motion builtins', () => {
    expect(SPROUT_BUILTINS).toContain('forward');
    expect(SPROUT_BUILTINS).toContain('circle');
    expect(SPROUT_BUILTINS).toContain('sprite');
  });

  it('contains sprite builtins added in recent sessions', () => {
    expect(SPROUT_BUILTINS).toContain('bounceSprite');
    expect(SPROUT_BUILTINS).toContain('cloneSprite');
  });
});

describe('SPROUT_KEYWORDS', () => {
  it('contains loop and forever', () => {
    expect(SPROUT_KEYWORDS).toContain('loop');
    expect(SPROUT_KEYWORDS).toContain('forever');
  });

  it('contains core keywords', () => {
    expect(SPROUT_KEYWORDS).toContain('repeat');
    expect(SPROUT_KEYWORDS).toContain('def');
    expect(SPROUT_KEYWORDS).toContain('if');
  });
});

// ---------------------------------------------------------------------------
// Helpers — build a CompletionContext without a real EditorView
// ---------------------------------------------------------------------------

function makeContext(doc: string, pos: number, explicit = true): CompletionContext {
  const state = EditorState.create({ doc });
  return new CompletionContext(state, pos, explicit);
}

describe('sproutCompletions', () => {
  it('returns builtin options when typing a partial function name', () => {
    // Cursor is after "forw" (position 4)
    const ctx = makeContext('forw', 4, true);
    const result = sproutCompletions(ctx);
    expect(result).not.toBeNull();
    expect(result!.options.some(o => o.label === 'forward')).toBe(true);
  });

  it('returns keyword options', () => {
    const ctx = makeContext('rep', 3, true);
    const result = sproutCompletions(ctx);
    expect(result).not.toBeNull();
    expect(result!.options.some(o => o.label === 'repeat')).toBe(true);
  });

  it('returns symbol options when text starts with :', () => {
    const ctx = makeContext(':re', 3, true);
    const result = sproutCompletions(ctx);
    expect(result).not.toBeNull();
    expect(result!.options.every(o => o.label.startsWith(':'))).toBe(true);
    expect(result!.options.some(o => o.label === ':red')).toBe(true);
  });

  it('includes user-defined variable from let declaration in document', () => {
    const doc = 'let myBall = 0\nmyB';
    const ctx = makeContext(doc, doc.length, true);
    const result = sproutCompletions(ctx);
    expect(result).not.toBeNull();
    expect(result!.options.some(o => o.label === 'myBall')).toBe(true);
  });

  it('returns null for empty non-explicit context', () => {
    const ctx = makeContext('', 0, false);
    const result = sproutCompletions(ctx);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — confirm passing**

```bash
npm test 2>&1 | tail -15
```

Expected: All `sprout-language` tests pass. Total test count increases.

- [ ] **Step 3: Commit**

```bash
git add apps/ide/tests/sprout-language.test.ts
git commit -m "test(ide): sprout-language constants and completion source"
```

---

### Task 4: Replace `<textarea>` with CodeMirror in `TextPanel.tsx`

**Files:**
- Modify: `apps/ide/src/TextPanel.tsx`

This is the core UI change. The `editable` branch swaps from `<textarea>` to an `EditorView` mounted in a `<div>`. The `read-only` branch (the `<pre>`) is untouched.

- [ ] **Step 1: Replace the entire file**

Write `apps/ide/src/TextPanel.tsx` with the following content:

```tsx
import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { autocompletion } from '@codemirror/autocomplete';
import { sproutLanguage, sproutCompletions } from './sprout-language.js';

const SHARED_PRE_STYLE: React.CSSProperties = {
  flex: '1 1 0',
  background: '#1e1e1e',
  color: '#d4d4d4',
  padding: 12,
  margin: 0,
  fontFamily: '"Fira Code", "Consolas", monospace',
  fontSize: 13,
  lineHeight: 1.5,
  borderRadius: 4,
  minHeight: 120,
};

const EDITOR_THEME = EditorView.theme({
  '&': {
    background: '#1e1e1e',
    color: '#d4d4d4',
    borderRadius: '4px',
    outline: '2px solid #2563eb',
    flex: '1 1 0',
    minHeight: '120px',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily: '"Fira Code", "Consolas", monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    padding: '12px',
  },
  '.cm-gutters': {
    background: '#1e1e1e',
    color: '#555',
    borderRight: '1px solid #333',
  },
  '.cm-activeLineGutter': { background: '#2a2a2a' },
  '.cm-activeLine': { background: '#2a2a2a' },
  '.cm-selectionBackground, .cm-content ::selection': {
    background: '#264f78 !important',
  },
  '.cm-focused .cm-selectionBackground': { background: '#264f78' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#d4d4d4' },
  // Token colours
  '.cm-keyword': { color: '#569cd6' },
  '.cm-variableName': { color: '#9cdcfe' },
  '.cm-atom': { color: '#ce9178' },
  '.cm-number': { color: '#b5cea8' },
  '.cm-string': { color: '#ce9178' },
  '.cm-comment': { color: '#6a9955', fontStyle: 'italic' },
});

interface Props {
  text: string;
  editable?: boolean;
  onChange?: (text: string) => void;
  error?: string | null;
}

export function TextPanel({ text, editable = false, onChange, error = null }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Mount the editor once
  useEffect(() => {
    if (!editable || !divRef.current) return;

    const view = new EditorView({
      doc: text,
      extensions: [
        basicSetup,
        sproutLanguage,
        autocompletion({ override: [sproutCompletions] }),
        EDITOR_THEME,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChange?.(update.state.doc.toString());
          }
        }),
      ],
      parent: divRef.current,
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentional empty deps: mount once, keep stable onChange via closure capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync externally-changed text (loading example, URL share, blocks→text switch)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== text) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: text },
      });
    }
  }, [text]);

  if (editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
        <div
          ref={divRef}
          style={{ flex: '1 1 0', minHeight: 120, overflow: 'auto', borderRadius: 4 }}
        />
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
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <pre
      style={{
        ...SHARED_PRE_STYLE,
        overflow: 'auto',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {text || '// drag blocks to start'}
    </pre>
  );
}
```

- [ ] **Step 2: Run all tests — confirm nothing broken**

```bash
npm test 2>&1 | tail -15
```

Expected: All tests pass. (The `TextPanel` component itself has no automated tests, but the `examples.test.ts` and other tests exercise the language pipeline and will surface any regressions.)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run typecheck 2>&1 | head -20
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/ide/src/TextPanel.tsx
git commit -m "feat(ide): replace textarea with CodeMirror 6 (syntax highlighting + autocomplete)"
```
