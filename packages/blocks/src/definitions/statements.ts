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

  Blockly.Blocks['sprout_arc'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('RADIUS').setCheck('Number').appendField('arc radius');
      this.appendValueInput('ANGLE').setCheck('Number').appendField('angle');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('Draw a circular arc');
    },
  };

  Blockly.Blocks['sprout_goto'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck('Number').appendField('goto x');
      this.appendValueInput('Y').setCheck('Number').appendField('y');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('Teleport turtle to absolute position (x, y)');
    },
  };

  Blockly.Blocks['sprout_home'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('home');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip('Return turtle to origin (0, 0) with heading north');
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

  Blockly.Blocks['sprout_color'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('color')
        .appendField(
          new Blockly.FieldDropdown([
            ['red',    'red'],
            ['blue',   'blue'],
            ['green',  'green'],
            ['orange', 'orange'],
            ['purple', 'purple'],
            ['black',  'black'],
            ['yellow', 'yellow'],
            ['pink',   'pink'],
          ]) as unknown as Blockly.Field,
          'COLOR',
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
    },
  };

  Blockly.Blocks['sprout_pen_width'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('WIDTH').setCheck('Number').appendField('pen width');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
    },
  };

  Blockly.Blocks['sprout_random_color'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('random color')
        .appendField(
          new Blockly.FieldDropdown([
            ['palette', 'palette'],
            ['any',     'any'],
          ]) as unknown as Blockly.Field,
          'MODE',
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
    },
  };

  Blockly.Blocks['sprout_background'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('background')
        .appendField(
          new Blockly.FieldDropdown([
            ['white',  'white'],
            ['black',  'black'],
            ['red',    'red'],
            ['blue',   'blue'],
            ['green',  'green'],
            ['orange', 'orange'],
            ['purple', 'purple'],
            ['yellow', 'yellow'],
            ['pink',   'pink'],
          ]) as unknown as Blockly.Field,
          'COLOR',
        );
      this.setTooltip('Sets the canvas background color. In text mode, hex strings like "#ff4400" are also accepted.');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
    },
  };

  Blockly.Blocks['sprout_clear_canvas'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('clear canvas');
      this.setTooltip('Wipes the canvas and resets the turtle to the center.');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
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

  Blockly.Blocks['sprout_repeat_with'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COUNT').setCheck('Number').appendField('repeat');
      this.appendDummyInput()
        .appendField('with')
        .appendField(new Blockly.FieldTextInput('i') as unknown as Blockly.Field, 'VAR');
      this.appendStatementInput('BODY').appendField('do');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setInputsInline(true);
      this.setColour(120);
      this.setTooltip('Repeat with a counting variable: 0, 1, 2, ...');
    },
  };

  Blockly.Blocks['sprout_repeat_index'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput('i') as unknown as Blockly.Field, 'VAR')
        .appendField('(index)');
      this.setOutput(true, 'Number');
      this.setColour(120);
      this.setTooltip('The counting variable from a "repeat with" loop');
    },
  };

  Blockly.Blocks['sprout_on_event'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('on')
        .appendField(
          new Blockly.FieldDropdown([
            ['click',  'click'],
            ['load',   'load'],
            ['left',   'left'],
            ['right',  'right'],
            ['up',     'up'],
            ['down',   'down'],
            ['space',  'space'],
          ]) as unknown as Blockly.Field,
          'EVENT',
        );
      this.appendStatementInput('BODY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(65);
    },
  };

  Blockly.Blocks['sprout_on_timer'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('on timer every')
        .appendField(new Blockly.FieldNumber(200, 1) as unknown as Blockly.Field, 'INTERVAL')
        .appendField('ms');
      this.appendStatementInput('BODY').appendField('do');
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

  Blockly.Blocks['sprout_return'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALUE')
        .appendField('return');
      this.setPreviousStatement(true, null);
      // No setNextStatement — nothing should follow a return.
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

  Blockly.Blocks['sprout_show'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LABEL').setCheck('String').appendField('show label');
      this.appendValueInput('VALUE').setCheck(null).appendField('value');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('Show a value on the canvas HUD');
    },
  };

  Blockly.Blocks['sprout_wait'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('SECS')
        .setCheck('Number')
        .appendField('wait');
      this.appendDummyInput().appendField('seconds');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
    },
  };

  Blockly.Blocks['sprout_beep'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('beep');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('Play a short beep');
    },
  };

  Blockly.Blocks['sprout_play_note'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('play note')
        .appendField(
          new Blockly.FieldDropdown([
            ['C4', 'C4'],
            ['D4', 'D4'],
            ['E4', 'E4'],
            ['F4', 'F4'],
            ['G4', 'G4'],
            ['A4', 'A4'],
            ['B4', 'B4'],
            ['C5', 'C5'],
          ]) as unknown as Blockly.Field,
          'NOTE',
        );
      this.appendValueInput('SECS').setCheck('Number').appendField('for');
      this.appendDummyInput().appendField('seconds');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip('Play a musical note for a duration');
    },
  };
}
