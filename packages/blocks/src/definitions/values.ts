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
        new Blockly.FieldDropdown([['+', '+'], ['-', '-'], ['*', '*'], ['/', '/']]) as unknown as Blockly.Field,
        'OP',
      );
      this.appendValueInput('RIGHT').setCheck('Number');
      this.setOutput(true, 'Number');
      this.setInputsInline(true);
      this.setColour(230);
    },
  };

  Blockly.Blocks['sprout_string'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('"')
        .appendField(new Blockly.FieldTextInput('hello'), 'VALUE')
        .appendField('"');
      this.setOutput(true, 'String');
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_join'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('join');
      this.appendValueInput('A').setCheck(null);
      this.appendValueInput('B').setCheck(null);
      this.setOutput(true, 'String');
      this.setInputsInline(true);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_length'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('STR').setCheck('String').appendField('length of');
      this.setOutput(true, 'Number');
      this.setInputsInline(true);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_split'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('STR').setCheck('String').appendField('split');
      this.appendValueInput('SEP').setCheck('String').appendField('by');
      this.setOutput(true, 'Array');
      this.setInputsInline(true);
      this.setColour(160);
      this.setTooltip('Split a string into a list by separator');
    },
  };

  Blockly.Blocks['sprout_contains'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('STR').setCheck('String').appendField('contains');
      this.appendValueInput('SUB').setCheck('String').appendField('in');
      this.setOutput(true, 'Boolean');
      this.setInputsInline(true);
      this.setColour(160);
      this.setTooltip('Check if a string contains a substring');
    },
  };

  Blockly.Blocks['sprout_to_upper'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('STR').setCheck('String').appendField('toUpper');
      this.setOutput(true, 'String');
      this.setInputsInline(true);
      this.setColour(160);
      this.setTooltip('Convert string to uppercase');
    },
  };

  Blockly.Blocks['sprout_to_lower'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('STR').setCheck('String').appendField('toLower');
      this.setOutput(true, 'String');
      this.setInputsInline(true);
      this.setColour(160);
      this.setTooltip('Convert string to lowercase');
    },
  };

  Blockly.Blocks['sprout_input'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('input')
        .appendField(new Blockly.FieldTextInput('name'), 'NAME');
      this.setOutput(true, 'Number');
      this.setColour(45);
    },
  };

  Blockly.Blocks['sprout_mouse_x'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('mouseX');
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('Current mouse X position');
    },
  };

  Blockly.Blocks['sprout_mouse_y'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('mouseY');
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('Current mouse Y position');
    },
  };

  Blockly.Blocks['sprout_list'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('list');
      this.appendValueInput('VALUE_0').setCheck(null);
      this.appendValueInput('VALUE_1').setCheck(null);
      this.appendValueInput('VALUE_2').setCheck(null);
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(180);
    },
  };

  Blockly.Blocks['sprout_push'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LIST').setCheck(null).appendField('push');
      this.appendValueInput('VAL').setCheck(null).appendField('+');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(180);
    },
  };

  Blockly.Blocks['sprout_get'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LIST').setCheck(null).appendField('get');
      this.appendValueInput('INDEX').setCheck('Number').appendField('at');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(180);
    },
  };

  Blockly.Blocks['sprout_size'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LIST').setCheck(null).appendField('size of');
      this.setOutput(true, 'Number');
      this.setInputsInline(true);
      this.setColour(180);
    },
  };

  Blockly.Blocks['sprout_is_empty'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LIST').setCheck(null).appendField('is');
      this.appendDummyInput().appendField('empty?');
      this.setOutput(true, 'Boolean');
      this.setInputsInline(true);
      this.setColour(180);
    },
  };

  Blockly.Blocks['sprout_map'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LIST').setCheck(null).appendField('map');
      this.appendValueInput('FN').setCheck(null).appendField('with');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(260);
      this.setTooltip('Apply a function to each item in a list');
    },
  };

  Blockly.Blocks['sprout_filter'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LIST').setCheck(null).appendField('filter');
      this.appendValueInput('FN').setCheck(null).appendField('where');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(260);
      this.setTooltip('Keep items from a list where function returns true');
    },
  };

  Blockly.Blocks['sprout_reduce'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LIST').setCheck(null).appendField('reduce');
      this.appendValueInput('FN').setCheck(null).appendField('with');
      this.appendValueInput('INIT').setCheck(null).appendField('start');
      this.setOutput(true, null);
      this.setColour(260);
      this.setTooltip('Fold a list into a single value');
    },
  };

  Blockly.Blocks['sprout_stamp'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('stamp');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(290);
    },
  };

  Blockly.Blocks['sprout_random'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('MIN').setCheck('Number').appendField('random from');
      this.appendValueInput('MAX').setCheck('Number').appendField('to');
      this.setOutput(true, 'Number');
      this.setColour(230);
      this.setTooltip('Random number between min and max (inclusive)');
    },
  };
}
