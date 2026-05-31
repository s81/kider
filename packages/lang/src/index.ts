// Public surface of @sprout/lang

export type {
  // AST nodes
  Program,
  DefStmt,
  ExprStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
  CallExpr,
  BlockExpr,
  InfixExpr,
  RepeatExpr,
  OnExpr,
  // Unions
  Expr,
  Stmt,
  Node,
} from './ast.js';

export type {
  // Runtime values
  SproutNumber,
  SproutString,
  SproutSymbol,
  SproutBool,
  SproutFunction,
  Drawing,
  SproutValue,
  Env,
} from './values.js';

export {
  // Drawing constructors
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  // Drawing singleton constants (zero-arg constructors replaced by constants)
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';

export { interpret, SproutRuntimeError } from './interpreter.js';
