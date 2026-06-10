# Parse Error Line Numbers Design

**Date:** 2026-06-10
**Status:** Approved

## Goal

Text-mode parse errors currently read "Unexpected token: MINUS" or
"Expected 'do', got 'if'" with no location. Now that text mode carries
examples, shares, and the editor, kids need to know **where** to look:
`Line 7: Expected 'do', got 'if'`.

## Design

- **lexer.ts**: every `Token` gains a `line` field (1-based). The tokenizer
  tracks the current line — incremented on newlines in whitespace, and by the
  newline count inside string literals (strings can span lines today; keep
  that behavior, attribute the token to its opening line). The EOF token
  carries the last line. "Unexpected character" errors switch from character
  position to line for consistency.
- **ParseError**: gains an optional `line` property; when present the message
  is prefixed `Line N: `. All `throw new ParseError` sites in the parser pass
  the current token's line.
- **IDE**: no changes — the editor's parse-error banner shows
  `error.message`, which now includes the line.
- Runtime errors (`SproutRuntimeError`) are out of scope: the AST carries no
  positions; that would be a separate, larger change.

## Testing

- Tokens carry correct lines across newlines, comments, and multi-line
  strings.
- `parse('forward(\n@')`-style errors mention the right line; a missing `end`
  reports the line of EOF; `Expected 'do'` errors point at the offending line.
- Existing error-message assertions (`toThrow('...')`) keep passing because
  `toThrow` does substring matching on the unprefixed portion.
