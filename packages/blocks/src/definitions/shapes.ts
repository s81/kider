import * as Blockly from 'blockly/node';

export function registerShapeBlocks(): void {
  Blockly.Blocks['sprout_circle'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('R').setCheck('Number').appendField('circle');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_rect'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('W').setCheck('Number').appendField('rect');
      this.appendValueInput('H').setCheck('Number').appendField('×');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_ellipse'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('RX').setCheck('Number').appendField('ellipse');
      this.appendValueInput('RY').setCheck('Number').appendField('×');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_triangle'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('SIZE').setCheck('Number').appendField('triangle');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
  Blockly.Blocks['sprout_polygon'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('N').setCheck('Number').appendField('polygon');
      this.appendValueInput('SIZE').setCheck('Number').appendField('×');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };
}
