# Runtime Error Line Numbers Design

**Date:** 2026-06-10
**Status:** Approved

## Goal

Runtime errors in text mode point at a line, like parse errors now do:
`Line 12: forward: expected number, got string` instead of just
`forward: expected number, got string`.

## Design

- **ast.ts**: `CallExpr` and `Ident` gain an optional `readonly line?: number`.
  Optional so the block compiler, decompiler, fixtures, and tests don't
  change — blocks-built programs simply have no lines (block-mode errors are
  visually located anyway).
- **parser**: stamps `line` (the token's line) on every CallExpr and Ident it
  builds.
- **interpreter**: `SproutRuntimeError` gains an optional `line`; when set the
  message is prefixed `Line N: `. Attribution:
  - `Ident` lookup failures throw with the ident's line directly.
  - `evalCall` wraps evaluation: a `SproutRuntimeError` escaping **without** a
    line gets re-thrown with the call's line. The innermost call wins (it
    annotates first), which is the most precise location. Errors that already
    carry a line pass through unchanged. Return-flow signals pass through
    untouched.
- **IDE**: no changes — `setError(e.message)` already displays it.

## Test strategy

- lang: hand-built ASTs with `line` set — builtin type error, arity error,
  unbound identifier each report their line; inner call's line beats the
  outer's; line-less ASTs (the blocks path) produce unprefixed messages.
- parser: integration — `interpret(parse(src))` errors mention the right line.
  Existing exact-AST assertions keep passing by shadowing `parse` in the test
  file with a wrapper that strips `line` keys (one-line change; the
  line-number tests use the raw parse).
