# Text Editor Live Feedback Design

**Date:** 2026-06-03
**Status:** Approved

## Goal

Show parse errors inline in the text editor as the user types, without requiring a Run click. The canvas only updates on Run — live feedback is parse-only.

## Context

The text editor already exists: `TextPanel` renders a `<textarea>` in editor mode, `App.tsx` has Blocks/Text tabs, and `parse()` is already wired to the Run button. What's missing is feedback between keystrokes and Run.

## Architecture

Two files change. No new files.

### `App.tsx`

Add `editorParseError: string | null` state (initially `null`).

Add a `useEffect` on `[editorText, sourceMode]`:
- If `sourceMode !== 'editor'`, clear `editorParseError` and return
- Try `parse(editorText)`; on success, clear `editorParseError`
- On `ParseError`, set `editorParseError` to the error message

Pass `editorParseError` to `TextPanel` as a new `error` prop.

### `TextPanel.tsx`

Add optional `error: string | null` prop (defaults to `null`).

In the editable branch, when `error` is non-null, render a `<div>` immediately below the `<textarea>`:

```
background: #fef2f2
color: #dc2626
padding: 8px
border-radius: 4px
font-size: 12px
white-space: pre-wrap
```

The textarea's blue outline (`outline: 2px solid #2563eb`) is unchanged regardless of error state.

## Data Flow

```
user types
  → setEditorText(newText)
  → useEffect fires
  → parse(editorText)
      success → setEditorParseError(null)
      ParseError → setEditorParseError(e.message)
  → TextPanel re-renders with error prop
```

## Behaviour Details

- Error clears the moment the text parses cleanly — no dismiss button
- `editorParseError` is cleared when switching back to Blocks mode (stale errors don't linger)
- Runtime errors from Run (`error` state) are separate and unchanged
- Parsing runs on every keystroke — no debounce needed (parsing is fast)
- Empty editor (`editorText === ''`) parses as empty program — no error shown

## Files Changed

| File | Change |
|---|---|
| `apps/ide/src/App.tsx` | Add `editorParseError` state + `useEffect` to parse on text change |
| `apps/ide/src/TextPanel.tsx` | Add optional `error` prop; render error box below textarea |

## Out of Scope

- Syntax highlighting
- Auto-run on valid parse
- Error location markers (line/column gutter indicators)
- Debouncing
