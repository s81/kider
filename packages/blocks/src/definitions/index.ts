import { registerStatementBlocks } from './statements.js';
import { registerValueBlocks } from './values.js';
import { registerConditionalBlocks } from './conditionals.js';

let registered = false;

export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  registerStatementBlocks();
  registerValueBlocks();
  registerConditionalBlocks();
}
