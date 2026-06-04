import * as Blockly from 'blockly/node';

export function registerShapeBlocks(): void {
  Blockly.Blocks['sprout_circle'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('R').setCheck(null).appendField('circle');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_rect'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('W').setCheck(null).appendField('rect');
      this.appendValueInput('H').setCheck(null).appendField('×');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_ellipse'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('RX').setCheck(null).appendField('ellipse');
      this.appendValueInput('RY').setCheck(null).appendField('×');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_triangle'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('SIZE').setCheck(null).appendField('triangle');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
}
