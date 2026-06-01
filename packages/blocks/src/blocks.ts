// Block type definitions for the Sprout language.
// Call registerBlocks() once before creating any Sprout workspace.

import * as Blockly from 'blockly';

let registered = false;

export function registerBlocks(): void {
  if (registered) return;
  registered = true;

  Blockly.defineBlocksWithJsonArray([
    // -----------------------------------------------------------------------
    // Value blocks — produce an expression, plug into value inputs
    // -----------------------------------------------------------------------

    {
      type: 'sprout_number',
      message0: '%1',
      args0: [{ type: 'field_number', name: 'VALUE', value: 0 }],
      output: null,
      colour: 230,
    },

    {
      type: 'sprout_ident',
      message0: '%1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'x' }],
      output: null,
      colour: 230,
    },

    {
      type: 'sprout_infix',
      message0: '%1 %2 %3',
      args0: [
        { type: 'input_value', name: 'LEFT', check: null },
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['+', '+'],
            ['-', '-'],
            ['*', '*'],
            ['/', '/'],
          ],
        },
        { type: 'input_value', name: 'RIGHT', check: null },
      ],
      inputsInline: true,
      output: null,
      colour: 230,
    },

    // Composition value blocks
    {
      type: 'sprout_beside',
      message0: 'beside %1 %2',
      args0: [
        { type: 'input_value', name: 'LEFT', check: null },
        { type: 'input_value', name: 'RIGHT', check: null },
      ],
      inputsInline: true,
      output: null,
      colour: 120,
    },

    {
      type: 'sprout_above',
      message0: 'above %1 %2',
      args0: [
        { type: 'input_value', name: 'TOP', check: null },
        { type: 'input_value', name: 'BOTTOM', check: null },
      ],
      inputsInline: true,
      output: null,
      colour: 120,
    },

    {
      type: 'sprout_scale',
      message0: 'scale %1 %2',
      args0: [
        { type: 'input_value', name: 'FACTOR', check: null },
        { type: 'input_value', name: 'DRAWING', check: null },
      ],
      inputsInline: true,
      output: null,
      colour: 120,
    },

    // Zero-to-three-arg function call used as an expression value
    {
      type: 'sprout_call_value',
      message0: '%1 %2 %3 %4',
      args0: [
        { type: 'field_input', name: 'CALLEE', text: 'f' },
        { type: 'input_value', name: 'ARG0', check: null },
        { type: 'input_value', name: 'ARG1', check: null },
        { type: 'input_value', name: 'ARG2', check: null },
      ],
      inputsInline: true,
      output: null,
      colour: 120,
    },

    // -----------------------------------------------------------------------
    // Statement blocks — stackable, have prev/next connections
    // -----------------------------------------------------------------------

    {
      type: 'sprout_forward',
      message0: 'forward %1',
      args0: [{ type: 'input_value', name: 'DISTANCE', check: null }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 160,
    },

    {
      type: 'sprout_turn',
      message0: 'turn %1',
      args0: [{ type: 'input_value', name: 'DEGREES', check: null }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 160,
    },

    {
      type: 'sprout_pen_up',
      message0: 'pen up',
      previousStatement: null,
      nextStatement: null,
      colour: 160,
    },

    {
      type: 'sprout_pen_down',
      message0: 'pen down',
      previousStatement: null,
      nextStatement: null,
      colour: 160,
    },

    {
      type: 'sprout_repeat',
      message0: 'repeat %1 do %2',
      args0: [
        { type: 'input_value', name: 'COUNT', check: null },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 200,
    },

    {
      type: 'sprout_on',
      message0: 'on :%1 do %2',
      args0: [
        { type: 'field_input', name: 'EVENT', text: 'click' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 340,
    },

    // def name(params) ... end
    // PARAMS field: comma-separated names; leave empty for zero-param functions.
    {
      type: 'sprout_def',
      message0: 'def %1 (%2) %3',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'f' },
        { type: 'field_input', name: 'PARAMS', text: '' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 270,
    },

    // Zero-to-three-arg function call used as a statement
    {
      type: 'sprout_call_stmt',
      message0: '%1 %2 %3 %4',
      args0: [
        { type: 'field_input', name: 'CALLEE', text: 'f' },
        { type: 'input_value', name: 'ARG0', check: null },
        { type: 'input_value', name: 'ARG1', check: null },
        { type: 'input_value', name: 'ARG2', check: null },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 120,
    },

    // Wraps a value block (e.g. beside, above, scale) as a top-level statement.
    {
      type: 'sprout_expr_stmt',
      message0: '%1',
      args0: [{ type: 'input_value', name: 'EXPR', check: null }],
      previousStatement: null,
      nextStatement: null,
      colour: 0,
    },
  ]);
}
