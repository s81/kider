import * as Blockly from 'blockly/node';

export function registerMathBlocks(): void {
  Blockly.Blocks['sprout_sin'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('sin');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_cos'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('cos');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_tan'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('tan');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_abs'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('abs');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_sqrt'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('sqrt');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_log'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('log');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_floor'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('floor');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_ceil'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('ceil');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_round'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('round');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_random'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('random');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_pow'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('A').setCheck(null).appendField('pow');
      this.appendValueInput('B').setCheck(null).appendField('exp');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_mod'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('A').setCheck(null).appendField('mod');
      this.appendValueInput('B').setCheck(null);
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_max'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('A').setCheck(null).appendField('max');
      this.appendValueInput('B').setCheck(null).appendField(',');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_min'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('A').setCheck(null).appendField('min');
      this.appendValueInput('B').setCheck(null).appendField(',');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_pi'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('π');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
}
