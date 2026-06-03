// Public surface of @sprout/lang

export type {
  // AST nodes
  Program,
  DefStmt,
  ExprStmt,
  LetStmt,
  AssignStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
  CallExpr,
  BlockExpr,
  InfixExpr,
  UnaryExpr,
  RepeatExpr,
  OnExpr,
  IfExpr,
  WhileExpr,
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
  SproutVar,
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
  mkColor,
  mkPenWidth,
  // Drawing singleton constants (zero-arg constructors replaced by constants)
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';

export { interpret, interpretFull, callHandler, SproutRuntimeError } from './interpreter.js';

export { serialize, serializeExpr, serializeStmt } from './serializer.js';

export type { CanvasCommand } from './renderer.js';
export { render, measure } from './renderer.js';
