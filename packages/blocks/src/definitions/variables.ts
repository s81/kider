import * as Blockly from 'blockly/node';

export function registerVariableBlocks(): void {
  Blockly.Blocks['sprout_let'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('INIT')
        .setCheck(null)
        .appendField('let')
        .appendField(new Blockly.FieldTextInput('x') as unknown as Blockly.Field, 'NAME')
        .appendField('=');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };

  Blockly.Blocks['sprout_set'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALUE')
        .setCheck(null)
        .appendField('set')
        .appendField(new Blockly.FieldTextInput('x') as unknown as Blockly.Field, 'NAME')
        .appendField('=');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };

  Blockly.Blocks['sprout_while'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COND').setCheck(null).appendField('while');
      this.appendStatementInput('BODY').appendField('do');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };
}
