# URL Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Share button to the IDE that encodes the current program into a URL hash so users can share a link that restores their work.

**Architecture:** Two new helpers (`encodeShare`/`decodeShare`) added to `storage.ts` handle the base64-encoded URL format. `App.tsx` gains a Share button and a mount `useEffect` that restores from URL on load; the existing `onWorkspaceReady` callback is updated to check URL share before localStorage for blocks mode.

**Tech Stack:** TypeScript, React, Vitest, pnpm monorepo (`@sprout/ide`)

---

## File Map

| File | Change |
|---|---|
| `apps/ide/src/storage.ts` | Add `encodeShare` and `decodeShare` exports |
| `apps/ide/tests/storage.test.ts` | Add `describe('encodeShare / decodeShare')` with 7 tests |
| `apps/ide/src/App.tsx` | Add `shareConfirm` state, `handleShare`, mount restore effect, update `onWorkspaceReady`, add Share button |

---

### Task 1: `encodeShare` / `decodeShare` in `storage.ts`

**Files:**
- Modify: `apps/ide/src/storage.ts`
- Test: `apps/ide/tests/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/ide/tests/storage.test.ts` (add `encodeShare` and `decodeShare` to the existing import line first):

```typescript
import { describe, it, expect } from 'vitest';
import { parseSave, buildBlocksSave, buildTextSave, encodeShare, decodeShare } from '../src/storage.js';
```

Then append after the existing `describe` blocks:

```typescript
describe('encodeShare / decodeShare', () => {
  it('round-trips a text save', () => {
    const save = buildTextSave('forward(100)');
    expect(decodeShare('#share=' + encodeShare(save))).toEqual(save);
  });

  it('round-trips a blocks save', () => {
    const save = buildBlocksSave('{"blocks":{}}', 'forward(100)');
    expect(decodeShare('#share=' + encodeShare(save))).toEqual(save);
  });

  it('round-trips text containing Unicode (emoji)', () => {
    const save = buildTextSave('text("hello 🌈", 20)');
    expect(decodeShare('#share=' + encodeShare(save))).toEqual(save);
  });

  it('decodeShare returns null for empty string', () => {
    expect(decodeShare('')).toBeNull();
  });

  it('decodeShare returns null for wrong prefix', () => {
    expect(decodeShare('#other=abc')).toBeNull();
  });

  it('decodeShare returns null for malformed base64', () => {
    expect(decodeShare('#share=!!!')).toBeNull();
  });

  it('decodeShare returns null for valid base64 but invalid save JSON', () => {
    // btoa('{"mode":"unknown"}') — valid base64 but unknown mode
    const badPayload = btoa('{"mode":"unknown"}');
    expect(decodeShare('#share=' + badPayload)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\apps\ide && bun test tests/storage.test.ts
```

Expected: FAIL — `encodeShare` and `decodeShare` are not exported.

- [ ] **Step 3: Add `encodeShare` and `decodeShare` to `storage.ts`**

Append to `apps/ide/src/storage.ts`:

```typescript
export function encodeShare(save: SaveState): string {
  const json = JSON.stringify(save);
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
}

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

- [ ] **Step 4: Run tests to verify they pass**

```
cd D:\Projects\kider\apps\ide && bun test tests/storage.test.ts
```

Expected: All storage tests PASS (10 existing + 7 new).

- [ ] **Step 5: Commit**

```
git add apps/ide/src/storage.ts apps/ide/tests/storage.test.ts
git commit -m "feat(ide): add encodeShare/decodeShare to storage"
```

---

### Task 2: Share button and URL restore in `App.tsx`

**Files:**
- Modify: `apps/ide/src/App.tsx`

This task has no separate failing test — the storage helpers are tested in Task 1, and App.tsx is a React component not covered by unit tests. Verify manually that the Share button appears and the URL round-trip works after implementation.

- [ ] **Step 1: Update the import from `./storage.js`**

In `apps/ide/src/App.tsx`, line 13 currently reads:

```typescript
import { parseSave, buildBlocksSave, buildTextSave } from './storage.js';
```

Change it to:

```typescript
import { parseSave, buildBlocksSave, buildTextSave, encodeShare, decodeShare } from './storage.js';
import type { SaveState } from './storage.js';
```

- [ ] **Step 2: Add `shareConfirm` state**

In `apps/ide/src/App.tsx`, after the existing state declarations (around line 29, after `setEditorParseError`), add:

```typescript
  const [shareConfirm, setShareConfirm] = useState(false);
```

- [ ] **Step 3: Add `handleShare` function**

After `handleFileChange` (around line 147), add:

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

- [ ] **Step 4: Add mount useEffect for URL restore**

After the existing localStorage text-restore `useEffect` (the one that checks `sprout_save` and calls `setEditorText`/`setSourceMode`, around lines 61–68), add:

```typescript
  useEffect(() => {
    const saved = decodeShare(window.location.hash);
    if (!saved) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (saved.mode === 'text') {
      setEditorText(saved.text);
      setSourceMode('editor');
    }
    // blocks mode is handled in onWorkspaceReady (child effects run before parent effects)
  }, []);
```

- [ ] **Step 5: Update `onWorkspaceReady` to check URL share first**

In the JSX (around line 159), replace the existing `onWorkspaceReady` callback:

```typescript
          onWorkspaceReady={ws => {
            wsRef.current = ws;
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
            } catch {
              // Silently ignore corrupt save data
            }
          }}
```

With:

```typescript
          onWorkspaceReady={ws => {
            wsRef.current = ws;
            // URL share takes priority over localStorage (child effects run before parent effects,
            // so this fires before the mount useEffect that clears the hash for text shares)
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
            } catch {
              // Silently ignore corrupt save data
            }
          }}
```

- [ ] **Step 6: Add Share button to the UI**

In the JSX, find the Export/Import `<div>` (around line 237–275). Add the Share button after Import:

```tsx
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              padding: '4px 0',
              fontSize: 13,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            ↓ Export
          </button>
          <button
            onClick={handleImport}
            style={{
              flex: 1,
              padding: '4px 0',
              fontSize: 13,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            ↑ Import
          </button>
          <button
            onClick={handleShare}
            style={{
              flex: 1,
              padding: '4px 0',
              fontSize: 13,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              color: shareConfirm ? '#16a34a' : '#334155',
            }}
          >
            {shareConfirm ? '✓ Copied!' : '↗ Share'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sprout,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
```

- [ ] **Step 7: Run the full test suite**

```
cd D:\Projects\kider && bun test
```

Expected: All tests PASS (393+ tests, 0 failures).

- [ ] **Step 8: Commit**

```
git add apps/ide/src/App.tsx
git commit -m "feat(ide): add Share button with URL hash encoding"
```
