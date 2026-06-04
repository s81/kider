# URL Sharing Design

**Date:** 2026-06-04  
**Status:** Approved

## Goal

Add a "Share" button to the IDE that encodes the current program into the URL hash so users can share a link that restores their work. Works for both text mode and blocks mode.

## User experience

1. User writes a program (text or blocks mode).
2. User clicks **↗ Share**.
3. The URL hash is updated to `#share=<base64>` and the full URL is copied to the clipboard.
4. The button briefly shows **✓ Copied!** for 2 seconds.
5. Recipient opens the URL → their IDE loads the program and mode automatically.
6. The hash is cleared from the URL after loading (so subsequent saves to localStorage work normally).

## URL format

```
https://example.com/#share=<base64>
```

The base64 payload is a Unicode-safe base64 encoding of `JSON.stringify(SaveState)`, where `SaveState` is the existing type from `storage.ts`:
- Text mode: `{ mode: 'text', text: string }`
- Blocks mode: `{ mode: 'blocks', blocks: string, text: string }`

## Architecture

### `apps/ide/src/storage.ts`

Two new exported functions:

**`encodeShare(save: SaveState): string`** — encodes a SaveState to a base64 string. Uses `encodeURIComponent` + `btoa` trick for Unicode safety:

```typescript
export function encodeShare(save: SaveState): string {
  const json = JSON.stringify(save);
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
}
```

**`decodeShare(hash: string): SaveState | null`** — decodes a `#share=...` hash string back to a SaveState, or returns null if absent/malformed:

```typescript
export function decodeShare(hash: string): SaveState | null {
  if (!hash.startsWith('#share=')) return null;
  try {
    const json = decodeURIComponent(
      atob(hash.slice('#share='.length))
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return parseSave(json);
  } catch {
    return null;
  }
}
```

### `apps/ide/src/App.tsx`

**New imports:** `encodeShare`, `decodeShare` from `./storage.js`.

**New state:** `const [shareConfirm, setShareConfirm] = useState(false)` — drives the "✓ Copied!" button feedback.

**`handleShare` function:**
```typescript
function handleShare() {
  let save: SaveState;
  if (sourceMode === 'blocks' && wsRef.current) {
    const blocksJson = JSON.stringify(Blockly.serialization.workspaces.save(wsRef.current));
    save = buildBlocksSave(blocksJson, programText);
  } else {
    save = buildTextSave(editorText);
  }
  const encoded = encodeShare(save);
  const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
  navigator.clipboard.writeText(url).then(() => {
    setShareConfirm(true);
    setTimeout(() => setShareConfirm(false), 2000);
  });
}
```

**URL restore on mount** — new `useEffect` (runs once, after existing effects):
```typescript
useEffect(() => {
  const saved = decodeShare(window.location.hash);
  if (!saved) return;
  // Clear hash from URL so it doesn't persist into localStorage saves
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (saved.mode === 'text') {
    setEditorText(saved.text);
    setSourceMode('editor');
  }
  // blocks mode is restored in onWorkspaceReady (which fires before this effect)
}, []);
```

**`onWorkspaceReady` update** — check URL share before localStorage (child effects run before parent effects, so `onWorkspaceReady` fires before the mount useEffect above):
```typescript
onWorkspaceReady={ws => {
  wsRef.current = ws;
  const share = decodeShare(window.location.hash);
  if (share?.mode === 'blocks') {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    try {
      Blockly.serialization.workspaces.load(
        JSON.parse(share.blocks) as Record<string, unknown>,
        ws,
        { recordUndo: false },
      );
    } catch { /* ignore corrupt share */ }
    return;
  }
  // Fall back to localStorage
  const raw = localStorage.getItem('sprout_save');
  if (!raw) return;
  const saved = parseSave(raw);
  if (!saved || saved.mode !== 'blocks') return;
  try {
    Blockly.serialization.workspaces.load(
      JSON.parse(saved.blocks) as Record<string, unknown>,
      ws,
      { recordUndo: false },
    );
  } catch { /* ignore */ }
}}
```

**Share button UI** — added to the Export/Import row:
```tsx
<button onClick={handleShare} style={{ /* same style as Export/Import */ }}>
  {shareConfirm ? '✓ Copied!' : '↗ Share'}
</button>
```

## Load order guarantee

React runs child `useEffect`s before parent `useEffect`s. `BlockWorkspace`'s `useEffect` (which calls `onWorkspaceReady`) runs before App.tsx's mount `useEffect`. This means:
- **Blocks share**: detected and consumed in `onWorkspaceReady`, hash cleared
- **Text share**: ignored in `onWorkspaceReady` (wrong mode), hash still present when App mount effect runs

## Testing

### `apps/ide/tests/storage.test.ts` — `describe('encodeShare / decodeShare')`

- `encodeShare` + `decodeShare` round-trips a text save
- `encodeShare` + `decodeShare` round-trips a blocks save
- `encodeShare` handles Unicode text (e.g. emoji in text field)
- `decodeShare('')` → null
- `decodeShare('#other=abc')` → null (wrong prefix)
- `decodeShare('#share=!!!invalid')` → null (malformed base64)
- `decodeShare('#share=' + encodeShare({ mode: 'text', text: '' }))` → `{ mode: 'text', text: '' }` (empty text)

## Files Changed

| File | Change |
|---|---|
| `apps/ide/src/storage.ts` | Add `encodeShare` and `decodeShare` |
| `apps/ide/tests/storage.test.ts` | Add `describe('encodeShare / decodeShare')` |
| `apps/ide/src/App.tsx` | Add Share button, `handleShare`, `shareConfirm` state, mount restore effect, update `onWorkspaceReady` |

## Out of Scope

- URL shortening / server-side storage
- Compression of the payload
- Sharing blocks and text independently (shares current mode's state)
- Social share metadata (Open Graph, etc.)
