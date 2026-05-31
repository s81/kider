// Runtime value types for the Sprout interpreter.
// All values are immutable algebraic data types — there is no mutation in the
// language.  A `Drawing` is a first-class VALUE, not a side effect.

import type { Expr } from './ast.js';

// ---------------------------------------------------------------------------
// Environment — binds names to values
// ---------------------------------------------------------------------------

/** The interpreter's lexical environment */
export type Env = ReadonlyMap<string, SproutValue>;

// ---------------------------------------------------------------------------
// Scalar / function values
// ---------------------------------------------------------------------------

export interface SproutNumber {
  readonly kind: 'number';
  readonly value: number;
}

export interface SproutString {
  readonly kind: 'string';
  readonly value: string;
}

export interface SproutSymbol {
  readonly kind: 'symbol';
  readonly name: string;
}

export interface SproutBool {
  readonly kind: 'bool';
  readonly value: boolean;
}

/**
 * A pure closure.  `env` captures the lexical environment at the point the
 * function was defined; `body` is the AST node that produces its return value.
 * Uses `import type { Expr }` to avoid a circular-module dependency at runtime.
 */
export interface SproutFunction {
  readonly kind: 'function';
  readonly params: readonly string[];
  readonly body: Expr;
  readonly env: Env;
}

// ---------------------------------------------------------------------------
// Drawing — algebraic type
//
// `forward`  / `turn` are primitive turtle moves.
// `penUp`    / `penDown` lift / lower the pen.
// `sequence` composes a list of drawings end-to-end (like a semigroup append).
// `beside`   places two drawings horizontally adjacent.
// `above`    places two drawings vertically adjacent.
// `scale`    uniformly scales a drawing.
// `empty`    is the identity element for composition.
// ---------------------------------------------------------------------------

export type Drawing =
  | { readonly kind: 'forward';  readonly distance: number }
  | { readonly kind: 'turn';     readonly degrees: number }
  | { readonly kind: 'penUp' }
  | { readonly kind: 'penDown' }
  | { readonly kind: 'sequence'; readonly steps: readonly Drawing[] }
  | { readonly kind: 'beside';   readonly left: Drawing; readonly right: Drawing }
  | { readonly kind: 'above';    readonly top: Drawing; readonly bottom: Drawing }
  | { readonly kind: 'scale';    readonly factor: number; readonly drawing: Drawing }
  | { readonly kind: 'empty' };

// ---------------------------------------------------------------------------
// SproutValue — top-level value union
// ---------------------------------------------------------------------------

// INVARIANT: Drawing.kind values ('forward','turn','penUp','penDown','sequence',
// 'beside','above','scale','empty') must never match SproutNumber/String/Symbol/Bool/Function kinds.
export type SproutValue =
  | SproutNumber
  | SproutString
  | SproutSymbol
  | SproutBool
  | SproutFunction
  | Drawing;

// ---------------------------------------------------------------------------
// Drawing constructor helpers
// Keeps construction sites readable and avoids repetitive object literals.
// ---------------------------------------------------------------------------

export const mkForward = (distance: number): Drawing =>
  ({ kind: 'forward', distance });

export const mkTurn = (degrees: number): Drawing =>
  ({ kind: 'turn', degrees });

export const PEN_UP: Drawing = { kind: 'penUp' };

export const PEN_DOWN: Drawing = { kind: 'penDown' };

export const mkSequence = (steps: readonly Drawing[]): Drawing =>
  ({ kind: 'sequence', steps });

export const mkBeside = (left: Drawing, right: Drawing): Drawing =>
  ({ kind: 'beside', left, right });

export const mkAbove = (top: Drawing, bottom: Drawing): Drawing =>
  ({ kind: 'above', top, bottom });

export const mkScale = (factor: number, drawing: Drawing): Drawing =>
  ({ kind: 'scale', factor, drawing });

export const EMPTY: Drawing = { kind: 'empty' };
