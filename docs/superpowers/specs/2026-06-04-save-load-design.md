# Save / Load Design

**Date:** 2026-06-04  
**Status:** Approved

## Goal

Add persistence to the Sprout IDE: auto-save to localStorage on every change, restore on page load, plus file export (download `.sprout`) and file import (upload).

## Storage Format

**localStorage key:** `sprout_save`  
**Value:** JSON matching this discriminated union:

```typescript
type SaveState =
  | { mode: 'blocks'; xml: string; text: string }
  | { mode: 'text';   text: string }
```

- Blocks mode saves Blockly workspace XML (for faithful restore) and the text representation (for display/export).
- Text mode saves only the editor text.
- File export always uses the text field (human-readable, mode-independent).

## Auto-Save

A `useEffect` in `App.tsx` watches `[sourceMode, programText, editorText]`:

- **Blocks mode:** calls `Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws))` to capture fresh XML, writes `{ mode: 'blocks', xml, text: programText }` to localStorage.
- **Text mode:** writes `{ mode: 'text', text: editorText }` to localStorage.

No debounce — localStorage writes are synchronous and cheap at this scale.

## Restore on Page Load

Restore is split by mode due to Blockly's async injection:

- **Text mode restore:** `useEffect([], [])` in `App.tsx` reads `sprout_save` on mount. If `saved.mode === 'text'`, calls `setEditorText(saved.text)` + `setSourceMode('editor')`. If `saved.mode === 'blocks'`, does nothing (handled below).
- **Blocks mode restore:** handled inside `onWorkspaceReady` (the callback fired when Blockly finishes injecting and `wsRef.current` becomes available). Reads `sprout_save`. If `saved.mode === 'blocks'`, calls `Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(saved.xml), ws)`.

If the save key is absent or the JSON is malformed, restore is silently skipped.

## File Export

`handleExport` in `App.tsx`:

1. Gets current text: `programText` (blocks mode) or `editorText` (text mode).
2. Creates `new Blob([text], { type: 'text/plain' })`.
3. Creates a temporary `<a>` with `download="program.sprout"` and `href = URL.createObjectURL(blob)`.
4. Appends to body, clicks, removes, revokes URL.

## File Import

A hidden `<input type="file" accept=".sprout,.txt">` element in `App.tsx` JSX. `handleImport` programmatically clicks it. The `onChange` handler:

1. Reads `e.target.files[0]` with `FileReader.readAsText`.
2. On load: calls `setEditorText(result)` + `setSourceMode('editor')`.
3. Resets the input value so the same file can be re-imported.

Parse errors surface when the user hits Run — no special import-time validation needed.

## UI

Two compact secondary buttons in the right panel, below the Run button in the same row as the Blocks/Text tabs:

```
[ ↓ Export ]  [ ↑ Import ]
```

Placed after the Blocks/Text tab row, before the animation controls.

## Architecture: New File

Extract serialization into `apps/ide/src/storage.ts` to keep App.tsx clean and enable unit testing:

```typescript
export type SaveState =
  | { mode: 'blocks'; xml: string; text: string }
  | { mode: 'text';   text: string }

export function parseSave(json: string): SaveState | null
export function buildBlocksSave(xml: string, text: string): SaveState
export function buildTextSave(text: string): SaveState
```

- `parseSave` — safe JSON parse; returns `null` for invalid JSON or missing required fields.
- `buildBlocksSave` / `buildTextSave` — construct the save object (pure, testable).

## Testing

### `apps/ide/tests/storage.test.ts`

Unit tests for the pure serialization helpers:

- `parseSave` returns `null` for invalid JSON
- `parseSave` returns `null` for JSON missing `mode` field
- `parseSave` returns `null` for blocks save missing `xml` or `text`
- `parseSave` round-trips a valid blocks save: `{ mode: 'blocks', xml: '<xml/>', text: 'forward(100)' }`
- `parseSave` round-trips a valid text save: `{ mode: 'text', text: 'forward(100)' }`
- `buildBlocksSave(xml, text)` returns correct shape
- `buildTextSave(text)` returns correct shape

React wiring (`useEffect`, `FileReader`, DOM click trigger, Blockly XML restore) is verified manually.

## Files Changed

| File | Change |
|---|---|
| `apps/ide/src/storage.ts` | New — `SaveState` type, `parseSave`, `buildBlocksSave`, `buildTextSave` |
| `apps/ide/tests/storage.test.ts` | New — 7 unit tests |
| `apps/ide/src/App.tsx` | Auto-save useEffect; restore in mount effect and `onWorkspaceReady`; `handleExport`; `handleImport`; hidden file input; Export/Import buttons |

## Out of Scope

- Multiple named save slots
- Cloud/remote persistence
- Undo history persistence
- Import into blocks mode (file import always restores into text mode)
- Save confirmation dialog or "unsaved changes" warning
