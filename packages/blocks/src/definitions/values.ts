import * as Blockly from 'blockly/node';

export function registerValueBlocks(): void {
  Blockly.Blocks['sprout_number'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(0), 'NUM');
      this.setOutput(true, 'Number');
      this.setColour(230);
    },
  };

  Blockly.Blocks['sprout_ident'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('n'), 'NAME');
      this.setOutput(true, null);
      this.setColour(330);
    },
  };

  // Function call that produces a value (e.g., square(), polygon(6, 80) used as expression)
  // Up to 2 positional args; leave ARG0/ARG1 unconnected for zero-arg calls.
  Blockly.Blocks['sprout_call_expr'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('func'), 'CALLEE');
      this.appendValueInput('ARG0').setCheck(null);
      this.appendValueInput('ARG1').setCheck(null);
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_infix'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck('Number');
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([['+', '+'], ['-', '-'], ['*', '*'], ['/', '/']]),
        'OP',
      );
      this.appendValueInput('RIGHT').setCheck('Number');
      this.setOutput(true, 'Number');
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
}
