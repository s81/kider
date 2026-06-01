import * as Blockly from 'blockly/node';

export function registerStatementBlocks(): void {
  Blockly.Blocks['sprout_forward'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DISTANCE').setCheck('Number').appendField('forward');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_turn'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DEGREES').setCheck('Number').appendField('turn');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_pen_up'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('pen up');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_pen_down'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('pen down');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_puts'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALUE').appendField('puts');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_repeat'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COUNT').setCheck('Number').appendField('repeat');
      this.appendStatementInput('BODY').appendField('do');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
    },
  };

  Blockly.Blocks['sprout_on_event'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('on')
        .appendField(
          new Blockly.FieldDropdown([
            ['click', 'click'],
            ['load', 'load'],
            ['keydown', 'keydown'],
          ]),
          'EVENT',
        );
      this.appendStatementInput('BODY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(65);
    },
  };

  // def name(param0, param1, param2) — up to 3 params (empty string = absent)
  Blockly.Blocks['sprout_def'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('def')
        .appendField(new Blockly.FieldTextInput('myFunc'), 'NAME');
      this.appendDummyInput()
        .appendField('params:')
        .appendField(new Blockly.FieldTextInput(''), 'PARAM0')
        .appendField(new Blockly.FieldTextInput(''), 'PARAM1')
        .appendField(new Blockly.FieldTextInput(''), 'PARAM2');
      this.appendStatementInput('BODY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
    },
  };

  // Generic function call as statement: callee(arg0, arg1) — up to 2 args
  Blockly.Blocks['sprout_call_stmt'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('func'), 'CALLEE');
      this.appendValueInput('ARG0').setCheck(null);
      this.appendValueInput('ARG1').setCheck(null);
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
    },
  };

  // beside(left, right) as a top-level statement
  Blockly.Blocks['sprout_beside'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck(null).appendField('beside(');
      this.appendValueInput('RIGHT').setCheck(null).appendField(',');
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };

  // above(top, bottom) as a top-level statement
  Blockly.Blocks['sprout_above'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TOP').setCheck(null).appendField('above(');
      this.appendValueInput('BOTTOM').setCheck(null).appendField(',');
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };

  // scale(factor, drawing) as a top-level statement
  Blockly.Blocks['sprout_scale'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('FACTOR').setCheck('Number').appendField('scale(');
      this.appendValueInput('DRAWING').setCheck(null).appendField(',');
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };
}
