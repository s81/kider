import * as Blockly from 'blockly/node';

export function registerConditionalBlocks(): void {
  Blockly.Blocks['sprout_if'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COND').setCheck(null).appendField('if');
      this.appendStatementInput('THEN').appendField('do');
      this.appendStatementInput('ELSE').appendField('else');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_compare'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck(null);
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ['<',  '<'],
          ['>',  '>'],
          ['<=', '<='],
          ['>=', '>='],
          ['==', '=='],
          ['!=', '!='],
        ]) as unknown as Blockly.Field,
        'OP',
      );
      this.appendValueInput('RIGHT').setCheck(null);
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_not'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('OPERAND').setCheck(null).appendField('not');
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_and'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck(null);
      this.appendDummyInput().appendField('and');
      this.appendValueInput('RIGHT').setCheck(null);
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_or'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck(null);
      this.appendDummyInput().appendField('or');
      this.appendValueInput('RIGHT').setCheck(null);
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_bool'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ['true',  'true'],
          ['false', 'false'],
        ]) as unknown as Blockly.Field,
        'VALUE',
      );
      this.setOutput(true, null);
      this.setColour(210);
    },
  };
}
