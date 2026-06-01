import * as Blockly from 'blockly/node';
import { describe, it, expect, afterAll } from 'vitest';

describe('blockly headless', () => {
  afterAll(() => { delete Blockly.Blocks['test_noop']; });

  it('can create a workspace and a block without DOM', () => {
    const ws = new Blockly.Workspace();
    Blockly.Blocks['test_noop'] = { init() { /* empty */ } };
    const block = ws.newBlock('test_noop');
    expect(block).toBeDefined();
    ws.dispose();
  });
});
