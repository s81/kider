import { registerStatementBlocks } from './statements.js';
import { registerValueBlocks } from './values.js';
import { registerConditionalBlocks } from './conditionals.js';
import { registerVariableBlocks } from './variables.js';
import { registerMathBlocks } from './math.js';
import { registerShapeBlocks } from './shapes.js';
import { registerSpriteBlocks } from './sprites.js';

let registered = false;

export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  registerStatementBlocks();
  registerValueBlocks();
  registerConditionalBlocks();
  registerVariableBlocks();
  registerMathBlocks();
  registerShapeBlocks();
  registerSpriteBlocks();
}
