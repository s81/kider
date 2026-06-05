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
  ForEachExpr,
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
  SproutList,
  Drawing,
  SproutValue,
  Env,
} from './values.js';

export {
  // List constructor
  mkList,
  // Drawing constructors
  mkForward,
  mkTurn,
  mkSequence,
  mkBeside,
  mkAbove,
  mkScale,
  mkColor,
  mkPenWidth,
  mkCircle,
  mkRect,
  mkEllipse,
  mkTriangle,
  mkPolygon,
  mkText,
  mkBackground,
  mkClearCanvas,
  mkStamp,
  // Drawing singleton constants (zero-arg constructors replaced by constants)
  PEN_UP,
  PEN_DOWN,
  EMPTY,
} from './values.js';

export {
  interpret,
  interpretFull,
  interpretValue,
  interpretWithInputs,
  interpretFullWithInputs,
  collectInputNames,
  callHandler,
  SproutRuntimeError,
} from './interpreter.js';

export { serialize, serializeExpr, serializeStmt } from './serializer.js';

export type { CanvasCommand } from './renderer.js';
export { render, measure } from './renderer.js';
