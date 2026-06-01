import * as Blockly from 'blockly/node';
import { describe, it, expect } from 'vitest';

describe('blockly headless', () => {
  it('can create a workspace and a block without DOM', () => {
    const ws = new Blockly.Workspace();
    // Register a minimal block so newBlock doesn't throw
    Blockly.Blocks['test_noop'] = { init() { /* empty */ } };
    const block = ws.newBlock('test_noop');
    expect(block).toBeDefined();
    ws.dispose();
  });
});
