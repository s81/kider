import * as Blockly from 'blockly/node';
import { serialize } from '@sprout/lang';
import { compileWorkspace } from './compiler.js';

export function generateText(ws: Blockly.Workspace): string {
  const program = compileWorkspace(ws);
  return serialize(program);
}
