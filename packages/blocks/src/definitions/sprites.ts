import * as Blockly from 'blockly/node';

const SPRITE_COLOUR = 20;

function nameField(defaultName = 'cat'): Blockly.Field {
  return new Blockly.FieldTextInput(defaultName) as unknown as Blockly.Field;
}

export function registerSpriteBlocks(): void {
  Blockly.Blocks['sprout_sprite'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COSTUME')
        .setCheck(null)
        .appendField('make sprite')
        .appendField(nameField(), 'NAME')
        .appendField('look like');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Create a sprite (or change its costume)');
    },
  };

  Blockly.Blocks['sprout_move_sprite'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DIST')
        .setCheck('Number')
        .appendField('move sprite')
        .appendField(nameField(), 'NAME')
        .appendField('by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Move a sprite forward along its heading');
    },
  };

  Blockly.Blocks['sprout_turn_sprite'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DEG')
        .setCheck('Number')
        .appendField('turn sprite')
        .appendField(nameField(), 'NAME')
        .appendField('by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Turn a sprite clockwise by degrees');
    },
  };

  Blockly.Blocks['sprout_goto_sprite'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X')
        .setCheck('Number')
        .appendField('send sprite')
        .appendField(nameField(), 'NAME')
        .appendField('to x');
      this.appendValueInput('Y').setCheck('Number').appendField('y');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Teleport a sprite to a position');
    },
  };

  Blockly.Blocks['sprout_change_sprite_x'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('AMOUNT')
        .setCheck('Number')
        .appendField('change sprite')
        .appendField(nameField(), 'NAME')
        .appendField('x by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Move a sprite horizontally');
    },
  };

  Blockly.Blocks['sprout_change_sprite_y'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('AMOUNT')
        .setCheck('Number')
        .appendField('change sprite')
        .appendField(nameField(), 'NAME')
        .appendField('y by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Move a sprite vertically (positive = down)');
    },
  };

  Blockly.Blocks['sprout_hide_sprite'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('hide sprite').appendField(nameField(), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Hide a sprite (hidden sprites never touch)');
    },
  };

  Blockly.Blocks['sprout_show_sprite'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('show sprite').appendField(nameField(), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Show a hidden sprite');
    },
  };

  Blockly.Blocks['sprout_remove_sprite'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('remove sprite').appendField(nameField(), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Delete a sprite');
    },
  };

  Blockly.Blocks['sprout_bounce_sprite'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('bounce sprite').appendField(nameField(), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Reflect a sprite off the stage edges');
    },
  };

  Blockly.Blocks['sprout_sprite_x'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('x of sprite').appendField(nameField(), 'NAME');
      this.setOutput(true, 'Number');
      this.setColour(SPRITE_COLOUR);
      this.setTooltip("A sprite's x position");
    },
  };

  Blockly.Blocks['sprout_sprite_y'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('y of sprite').appendField(nameField(), 'NAME');
      this.setOutput(true, 'Number');
      this.setColour(SPRITE_COLOUR);
      this.setTooltip("A sprite's y position");
    },
  };

  Blockly.Blocks['sprout_sprites_touching'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('sprite')
        .appendField(nameField(), 'NAME_A')
        .appendField('touching sprite')
        .appendField(nameField('dog'), 'NAME_B')
        .appendField('?');
      this.setOutput(true, 'Boolean');
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Are two sprites overlapping? (size from their costumes)');
    },
  };
}
