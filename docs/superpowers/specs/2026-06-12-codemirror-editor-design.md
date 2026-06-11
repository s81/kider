# CodeMirror Editor Upgrade Design

## Goal

Replace the plain `<textarea>` in the Sprout IDE text editor with CodeMirror 6, gaining syntax highlighting, proper undo/redo, and autocomplete for builtin names, keywords, user variables, and `:symbol` literals.

## Architecture

All changes are confined to `apps/ide`. Two files change: `TextPanel.tsx` (swap textarea for CodeMirror) and a new `sprout-language.ts` (language definition + completions). Three CodeMirror packages are added as dependencies.

---

## Dependencies

Add to `apps/ide/package.json` dependencies:

```json
"codemirror": "^6.0.1",
"@codemirror/autocomplete": "^6.18.6",
"@codemirror/language": "^6.10.8"
```

`codemirror` (the bundled package) ships `basicSetup`, `EditorView`, `EditorState`, `keymap`, and the one-dark theme. `@codemirror/language` provides `StreamLanguage` for the custom tokenizer. `@codemirror/autocomplete` provides the completion popup.

---

## New File: `apps/ide/src/sprout-language.ts`

### Syntax highlighting — `sproutLanguage`

A `StreamLanguage` tokenizer. Returns a CodeMirror token class for each character sequence:

| Input | Token class |
|---|---|
| `# ...` to end of line | `comment` |
| `"..."` string literal | `string` |
| `0`–`9` digit sequence (with optional `.`) | `number` |
| `:identifier` | `atom` (symbol literal) |
| Keyword (`repeat`, `while`, `if`, `else`, `do`, `end`, `let`, `set`, `loop`, `forever`, `for`, `each`, `in`, `def`, `return`, `on`, `timer`, `every`) | `keyword` |
| Any other identifier | `variableName` |
| Anything else | advance one char, return `null` |

### Autocomplete — `sproutCompletions`

A `CompletionSource` function. Logic:

1. Match the word immediately before the cursor using `/[\w:]+/`.
2. If no match (or match is zero-length and `explicit` is false), return `null`.
3. If the matched text starts with `:`, return symbol/color completions:
   - All `:name` atoms used in existing examples and builtins: `:red`, `:orange`, `:yellow`, `:green`, `:blue`, `:purple`, `:white`, `:black`, `:gray`, `:pink`, `:cyan`, `:left`, `:right`, `:up`, `:down`, `:space`, `:enter`, `:timer`.
   - Type: `'constant'`.
4. Otherwise return:
   - All builtin function names from `SPROUT_BUILTINS` — type `'function'`.
   - All keywords — type `'keyword'`.
   - User-defined names scanned from the current document: all identifiers after `let ` and `def ` — type `'variable'`.
5. Filter: only include options whose `label` starts with the current word (case-sensitive).

### Exported constants

```ts
export const SPROUT_KEYWORDS: readonly string[]   // all keyword strings
export const SPROUT_BUILTINS: readonly string[]   // all builtin function names
export const sproutLanguage: LanguageSupport       // CodeMirror language extension
export const sproutCompletions: CompletionSource   // completion source function
```

`SPROUT_BUILTINS` is a hardcoded array listing every function in the interpreter's `BUILTINS` map. It is the single source of truth for completions; tests verify it is non-empty and contains spot-checked names.

---

## Modified File: `apps/ide/src/TextPanel.tsx`

### Editable mode

Replace the `<textarea>` with a `<div ref={divRef}>` that hosts an `EditorView`:

```tsx
useEffect(() => {
  const view = new EditorView({
    doc: text,
    extensions: [
      basicSetup,
      sproutLanguage,
      autocompletion({ override: [sproutCompletions] }),
      EditorView.theme({ ... }),   // dark theme matching existing colours
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChange?.(update.state.doc.toString());
      }),
    ],
    parent: divRef.current!,
  });
  viewRef.current = view;
  return () => view.destroy();
}, []);   // mount once
```

Sync externally-changed `text` prop (e.g. loading an example):

```tsx
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
```

### Read-only mode

Unchanged — still renders a `<pre>` for the blocks-mode code preview.

### Error display

Unchanged — the red error `<div>` below the editor is kept as-is.

### Theme

Custom `EditorView.theme` matching the existing textarea appearance:

```ts
{
  '&': { background: '#1e1e1e', color: '#d4d4d4', borderRadius: '4px' },
  '.cm-content': { fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '13px', lineHeight: '1.5' },
  '.cm-gutters': { background: '#1e1e1e', borderRight: '1px solid #333' },
  '.cm-activeLine': { background: '#2a2a2a' },
  '.cm-selectionBackground, ::selection': { background: '#264f78 !important' },
}
```

---

## Testing

No automated tests for the CodeMirror component itself (it's a third-party UI library; DOM testing is out of scope). Tests for the language definition:

**`apps/ide/tests/sprout-language.test.ts`** — new file:
- `SPROUT_BUILTINS` is non-empty
- `SPROUT_BUILTINS` contains spot-check names: `'forward'`, `'circle'`, `'sprite'`, `'bounceSprite'`, `'cloneSprite'`
- `SPROUT_KEYWORDS` contains `'loop'`, `'forever'`, `'repeat'`, `'def'`
- `sproutCompletions` returns builtin options when given a partial word context
- `sproutCompletions` returns symbol options when context starts with `:`
- `sproutCompletions` includes user-defined variable name from `let x = 5` in the document

These tests import only the exported constants and the completion function — no DOM, no CodeMirror view instantiation.
