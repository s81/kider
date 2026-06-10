# Share-to-Blocks Design

**Date:** 2026-06-10
**Status:** Approved

## Goal

A kid who receives a shared link should land in blocks mode with a tinkerable
program, not a wall of text. Blocks-mode shares already restore as blocks
(Blockly JSON); this extends the same experience to **text** shares using the
decompiler shipped earlier today.

## Behavior

- **Text share links** (`#share=` with a text save): try parse → decompile →
  blocks mode. On `DecompileError`/parse failure, fall back to the current
  behavior (text editor). Comments in the shared text are dropped in block
  view — acceptable for a received copy; the sender's original is untouched.
- **File imports stay text-mode** (unchanged): converting a user's own file
  would silently drop comments and normalize formatting if they re-export.
  Deliberate non-goal.
- **Examples** already do this (previous feature); their loader is refactored
  onto the same helper.

## Implementation

- `apps/ide/src/loadProgram.ts` — `tryLoadAsBlocks(ws, text): boolean`:
  parse, clear workspace, decompile, then initSvg/render each block when the
  workspace is rendered (guarded so headless workspaces in tests work).
  Returns false (and re-clears) on any failure.
- `App.tsx`: the text-share mount effect tries `tryLoadAsBlocks(wsRef.current,
  saved.text)` first (the workspace exists by then — child effects run before
  parent effects); `handleLoadExample` is refactored onto the helper.

## Testing

- `apps/ide/tests/loadProgram.test.ts` (headless workspace): a valid program
  returns true and the workspace compiles back to the same program; invalid
  text returns false and leaves the workspace empty; a non-block-representable
  program (3-arg unknown call) returns false.
