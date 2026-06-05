// AST node discriminated union types for the Sprout language.
// The AST is built by the block compiler (never by a text parser) and
// walked by the interpreter and the read-only display serializer.

// ---------------------------------------------------------------------------
// Literal nodes
// ---------------------------------------------------------------------------

export interface NumberLit {
  readonly kind: 'NumberLit';
  readonly value: number;
}

export interface StringLit {
  readonly kind: 'StringLit';
  readonly value: string;
}

/** Symbol literal — written as `:name` in display text */
export interface SymbolLit {
  readonly kind: 'SymbolLit';
  readonly name: string;
}

export interface BoolLit {
  readonly kind: 'BoolLit';
  readonly value: boolean;
}

// ---------------------------------------------------------------------------
// Reference / identifier
// ---------------------------------------------------------------------------

export interface Ident {
  readonly kind: 'Ident';
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Compound expressions
// ---------------------------------------------------------------------------

/** Binary arithmetic, comparison, or boolean expression */
export interface InfixExpr {
  readonly kind: 'InfixExpr';
  readonly op: '+' | '-' | '*' | '/' | '<' | '>' | '<=' | '>=' | '==' | '!=' | 'and' | 'or';
  readonly left: Expr;
  readonly right: Expr;
}

/** Prefix unary expression — currently only `not` */
export interface UnaryExpr {
  readonly kind: 'UnaryExpr';
  readonly op: 'not';
  readonly operand: Expr;
}

/**
 * Function call.
 * `block` holds an optional `do...end` body (higher-order blocks such as
 * `repeat` or user-defined functions that accept a block argument).
 */
export interface CallExpr {
  readonly kind: 'CallExpr';
  readonly callee: string;
  readonly args: readonly Expr[];
  readonly block: BlockExpr | null;
}

/** `do ... end` block — a sequence of statements used as a value */
export interface BlockExpr {
  readonly kind: 'BlockExpr';
  readonly body: readonly Stmt[];
}

/** `repeat <count> do ... end` */
export interface RepeatExpr {
  readonly kind: 'RepeatExpr';
  readonly count: Expr;
  readonly body: BlockExpr;
}

/** Event handler: `on :<event> do ... end` */
export interface OnExpr {
  readonly kind: 'OnExpr';
  // Full SymbolLit node (not just the name string) to preserve source fidelity.
  // Interpreter should use event.name for the string key.
  readonly event: SymbolLit;
  readonly body: BlockExpr;
}

/** `if <cond> do ... [else ...] end` */
export interface IfExpr {
  readonly kind: 'IfExpr';
  readonly cond: Expr;
  readonly then: BlockExpr;
  readonly else: BlockExpr | null;
}

/** `while <cond> do ... end` */
export interface WhileExpr {
  readonly kind: 'WhileExpr';
  readonly cond: Expr;
  readonly body: BlockExpr;
}

/** `for each <item> in <list> do ... end` */
export interface ForEachExpr {
  readonly kind: 'ForEachExpr';
  readonly item: string;
  readonly list: Expr;
  readonly body: BlockExpr;
}

// ---------------------------------------------------------------------------
// Expr union
// ---------------------------------------------------------------------------

export type Expr =
  | NumberLit
  | StringLit
  | SymbolLit
  | BoolLit
  | Ident
  | InfixExpr
  | UnaryExpr
  | CallExpr
  | BlockExpr
  | RepeatExpr
  | OnExpr
  | IfExpr
  | WhileExpr
  | ForEachExpr;

// ---------------------------------------------------------------------------
// Statement nodes
// ---------------------------------------------------------------------------

/** Function definition: `def name(params) = body` */
export interface DefStmt {
  readonly kind: 'DefStmt';
  readonly name: string;
  readonly params: readonly string[];
  readonly body: Expr;
}

/** An expression used as a statement (e.g. `forward(100)`) */
export interface ExprStmt {
  readonly kind: 'ExprStmt';
  readonly expr: Expr;
}

/** `let name = expr` — declares a mutable variable */
export interface LetStmt {
  readonly kind: 'LetStmt';
  readonly name: string;
  readonly init: Expr;
}

/** `set name = expr` — assigns to an existing mutable variable */
export interface AssignStmt {
  readonly kind: 'AssignStmt';
  readonly name: string;
  readonly value: Expr;
}

/** `return expr` — exits the enclosing function with a value */
export interface ReturnStmt {
  readonly kind: 'ReturnStmt';
  readonly value: Expr;
}

// ---------------------------------------------------------------------------
// Stmt union
// ---------------------------------------------------------------------------

export type Stmt = DefStmt | ExprStmt | LetStmt | AssignStmt | ReturnStmt;

// ---------------------------------------------------------------------------
// Top-level program
// ---------------------------------------------------------------------------

export interface Program {
  readonly kind: 'Program';
  readonly stmts: readonly Stmt[];
}

// ---------------------------------------------------------------------------
// Node — the complete union of everything the interpreter may encounter
// ---------------------------------------------------------------------------

export type Node = Program | Stmt | Expr;
