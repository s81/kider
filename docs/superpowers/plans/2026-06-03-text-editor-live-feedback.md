# Text Editor Live Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show parse errors inline below the text editor as the user types, clearing when the text is valid.

**Architecture:** `TextPanel` gains an optional `error` prop that renders a red error box below the textarea. `App.tsx` adds a `useEffect` that parses `editorText` on every change and stores the error message (or null) in a new `editorParseError` state, which is passed to `TextPanel`.

**Tech Stack:** React, TypeScript, `@sprout/parser` (`parse`, `ParseError`)

---

## File Map

| File | Change |
|---|---|
| `apps/ide/src/TextPanel.tsx` | Add optional `error: string \| null` prop; render error box below textarea |
| `apps/ide/src/App.tsx` | Add `editorParseError` state + `useEffect`; pass `error` to `TextPanel` |

---

### Task 1: Add `error` prop to `TextPanel`

**Files:**
- Modify: `apps/ide/src/TextPanel.tsx`

**Background:**

Current `TextPanel.tsx` in full (read it before editing):

```typescript
const SHARED_STYLE: React.CSSProperties = {
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

interface Props {
  text: string;
  editable?: boolean;
  onChange?: (text: string) => void;
}

export function TextPanel({ text, editable = false, onChange }: Props) {
  if (editable) {
    return (
      <textarea
        value={text}
        onChange={e => onChange?.(e.target.value)}
        spellCheck={false}
        style={{
          ...SHARED_STYLE,
          resize: 'none',
          border: 'none',
          outline: '2px solid #2563eb',
          cursor: 'text',
          userSelect: 'text',
        }}
      />
    );
  }

  return (
    <pre
      style={{
        ...SHARED_STYLE,
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

- [ ] **Step 1: Replace `TextPanel.tsx` with the updated version**

```typescript
const SHARED_STYLE: React.CSSProperties = {
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

interface Props {
  text: string;
  editable?: boolean;
  onChange?: (text: string) => void;
  error?: string | null;
}

export function TextPanel({ text, editable = false, onChange, error = null }: Props) {
  if (editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <textarea
          value={text}
          onChange={e => onChange?.(e.target.value)}
          spellCheck={false}
          style={{
            ...SHARED_STYLE,
            resize: 'none',
            border: 'none',
            outline: '2px solid #2563eb',
            cursor: 'text',
            userSelect: 'text',
          }}
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
        ...SHARED_STYLE,
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

- [ ] **Step 2: Typecheck**

```
pnpm typecheck
```

Expected: no errors. (`App.tsx` doesn't pass `error` yet — that's fine, the prop is optional.)

- [ ] **Step 3: Run tests**

```
pnpm test
```

Expected: 284 tests pass (no change in count — TextPanel has no unit tests).

- [ ] **Step 4: Commit**

```
git add apps/ide/src/TextPanel.tsx
git commit -m "feat(ide): add error prop to TextPanel for inline parse error display"
```

---

### Task 2: Wire live parse feedback in `App.tsx`

**Files:**
- Modify: `apps/ide/src/App.tsx`

**Background:**

`App.tsx` already imports `parse` and `ParseError` from `@sprout/parser` (lines 11–12 of the current file). The existing state variables are:

```typescript
const [programText, setProgramText] = useState('');
const [editorText, setEditorText] = useState('');
const [sourceMode, setSourceMode] = useState<SourceMode>('blocks');
const [commands, setCommands] = useState<CanvasCommand[]>([]);
const [error, setError] = useState<string | null>(null);
const [animated, setAnimated] = useState(false);
const [stepsPerFrame, setStepsPerFrame] = useState(3);
```

`TextPanel` is rendered at line 181 as:
```tsx
<TextPanel
  text={sourceMode === 'blocks' ? programText : editorText}
  editable={sourceMode === 'editor'}
  onChange={setEditorText}
/>
```

You need to:
1. Add `useEffect` import (add to the existing `import { useRef, useState } from 'react'` line)
2. Add `editorParseError` state
3. Add a `useEffect` that parses `editorText` when it or `sourceMode` changes
4. Pass `error={sourceMode === 'editor' ? editorParseError : null}` to `TextPanel`

- [ ] **Step 1: Add `useEffect` to the React import**

Change line 1 from:
```typescript
import { useRef, useState } from 'react';
```
to:
```typescript
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: Add `editorParseError` state after the existing state declarations**

After the line `const [stepsPerFrame, setStepsPerFrame] = useState(3);`, add:

```typescript
const [editorParseError, setEditorParseError] = useState<string | null>(null);
```

- [ ] **Step 3: Add `useEffect` for live parse feedback**

After the `editorParseError` state declaration, add:

```typescript
useEffect(() => {
  if (sourceMode !== 'editor') {
    setEditorParseError(null);
    return;
  }
  try {
    parse(editorText);
    setEditorParseError(null);
  } catch (e) {
    if (e instanceof ParseError) {
      setEditorParseError(e.message);
    }
  }
}, [editorText, sourceMode]);
```

- [ ] **Step 4: Pass `error` prop to `TextPanel`**

Change the `TextPanel` usage from:
```tsx
<TextPanel
  text={sourceMode === 'blocks' ? programText : editorText}
  editable={sourceMode === 'editor'}
  onChange={setEditorText}
/>
```
to:
```tsx
<TextPanel
  text={sourceMode === 'blocks' ? programText : editorText}
  editable={sourceMode === 'editor'}
  onChange={setEditorText}
  error={sourceMode === 'editor' ? editorParseError : null}
/>
```

- [ ] **Step 5: Typecheck**

```
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Run tests**

```
pnpm test
```

Expected: 284 tests pass.

- [ ] **Step 7: Commit**

```
git add apps/ide/src/App.tsx
git commit -m "feat(ide): show live parse errors in text editor as user types"
```

---

## Done

After both tasks, switching to the Text tab and typing invalid Sprout code shows a red error box below the editor instantly. Fixing the code clears the error. Switching back to Blocks clears any stale error.
