import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { registerAllBlocks, generateText } from '@sprout/blocks';

const TOOLBOX: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Motion', colour: '210',
      contents: [
        { kind: 'block', type: 'sprout_forward' },
        { kind: 'block', type: 'sprout_turn' },
        { kind: 'block', type: 'sprout_arc' },
        { kind: 'block', type: 'sprout_goto' },
        { kind: 'block', type: 'sprout_home' },
        { kind: 'block', type: 'sprout_get_x' },
        { kind: 'block', type: 'sprout_get_y' },
        { kind: 'block', type: 'sprout_get_heading' },
        { kind: 'block', type: 'sprout_stamp' },
        { kind: 'block', type: 'sprout_hide_turtle' },
        { kind: 'block', type: 'sprout_show_turtle' },
      ],
    },
    {
      kind: 'category', name: 'Pen', colour: '240',
      contents: [
        { kind: 'block', type: 'sprout_pen_up' },
        { kind: 'block', type: 'sprout_pen_down' },
        { kind: 'block', type: 'sprout_color' },
        { kind: 'block', type: 'sprout_random_color' },
        { kind: 'block', type: 'sprout_background' },
        { kind: 'block', type: 'sprout_clear_canvas' },
        { kind: 'block', type: 'sprout_pen_width' },
      ],
    },
    {
      kind: 'category', name: 'Sprites', colour: '20',
      contents: [
        { kind: 'block', type: 'sprout_sprite' },
        { kind: 'block', type: 'sprout_move_sprite' },
        { kind: 'block', type: 'sprout_turn_sprite' },
        { kind: 'block', type: 'sprout_goto_sprite' },
        { kind: 'block', type: 'sprout_change_sprite_x' },
        { kind: 'block', type: 'sprout_change_sprite_y' },
        { kind: 'block', type: 'sprout_bounce_sprite' },
        { kind: 'block', type: 'sprout_clone_sprite' },
        { kind: 'block', type: 'sprout_sprite_x' },
        { kind: 'block', type: 'sprout_sprite_y' },
        { kind: 'block', type: 'sprout_sprites_touching' },
        { kind: 'block', type: 'sprout_hide_sprite' },
        { kind: 'block', type: 'sprout_show_sprite' },
        { kind: 'block', type: 'sprout_remove_sprite' },
      ],
    },
    {
      kind: 'category', name: 'Control', colour: '120',
      contents: [
        { kind: 'block', type: 'sprout_loop_forever' },
        { kind: 'block', type: 'sprout_repeat' },
        { kind: 'block', type: 'sprout_repeat_with' },
        { kind: 'block', type: 'sprout_repeat_index' },
        { kind: 'block', type: 'sprout_if' },
        { kind: 'block', type: 'sprout_while' },
        { kind: 'block', type: 'sprout_for_each' },
        { kind: 'block', type: 'sprout_wait' },
        { kind: 'block', type: 'sprout_beep' },
        { kind: 'block', type: 'sprout_play_note' },
        { kind: 'block', type: 'sprout_on_event' },
        { kind: 'block', type: 'sprout_on_timer' },
        { kind: 'block', type: 'sprout_stop_timer' },
      ],
    },
    {
      kind: 'category', name: 'Variables', colour: '330',
      contents: [
        { kind: 'block', type: 'sprout_let' },
        { kind: 'block', type: 'sprout_set' },
      ],
    },
    {
      kind: 'category', name: 'Functions', colour: '290',
      contents: [
        { kind: 'block', type: 'sprout_def' },
        { kind: 'block', type: 'sprout_call_stmt' },
        { kind: 'block', type: 'sprout_return' },
      ],
    },
    {
      kind: 'category', name: 'Shapes', colour: '160',
      contents: [
        { kind: 'block', type: 'sprout_circle' },
        { kind: 'block', type: 'sprout_rect' },
        { kind: 'block', type: 'sprout_ellipse' },
        { kind: 'block', type: 'sprout_triangle' },
        { kind: 'block', type: 'sprout_polygon' },
        { kind: 'block', type: 'sprout_fill' },
        { kind: 'block', type: 'sprout_text' },
      ],
    },
    {
      kind: 'category', name: 'Composition', colour: '180',
      contents: [
        { kind: 'block', type: 'sprout_beside' },
        { kind: 'block', type: 'sprout_above' },
        { kind: 'block', type: 'sprout_scale' },
      ],
    },
    {
      kind: 'category', name: 'Lists', colour: '260',
      contents: [
        { kind: 'block', type: 'sprout_list' },
        { kind: 'block', type: 'sprout_range' },
        { kind: 'block', type: 'sprout_at' },
        { kind: 'block', type: 'sprout_get' },
        { kind: 'block', type: 'sprout_first' },
        { kind: 'block', type: 'sprout_last' },
        { kind: 'block', type: 'sprout_pick' },
        { kind: 'block', type: 'sprout_index_of' },
        { kind: 'block', type: 'sprout_slice' },
        { kind: 'block', type: 'sprout_size' },
        { kind: 'block', type: 'sprout_is_empty' },
        { kind: 'block', type: 'sprout_contains' },
        { kind: 'block', type: 'sprout_push' },
        { kind: 'block', type: 'sprout_pop' },
        { kind: 'block', type: 'sprout_concat' },
        { kind: 'block', type: 'sprout_reverse' },
        { kind: 'block', type: 'sprout_sort' },
        { kind: 'block', type: 'sprout_map' },
        { kind: 'block', type: 'sprout_filter' },
        { kind: 'block', type: 'sprout_reduce' },
      ],
    },
    {
      kind: 'category', name: 'Text', colour: '185',
      contents: [
        { kind: 'block', type: 'sprout_string' },
        { kind: 'block', type: 'sprout_join' },
        { kind: 'block', type: 'sprout_length' },
      ],
    },
    {
      kind: 'category', name: 'Values', colour: '0',
      contents: [
        { kind: 'block', type: 'sprout_number' },
        { kind: 'block', type: 'sprout_input' },
        { kind: 'block', type: 'sprout_text_input' },
        { kind: 'block', type: 'sprout_mouse_x' },
        { kind: 'block', type: 'sprout_mouse_y' },
        { kind: 'block', type: 'sprout_key_down' },
        { kind: 'block', type: 'sprout_bool' },
        { kind: 'block', type: 'sprout_ident' },
        { kind: 'block', type: 'sprout_infix' },
        { kind: 'block', type: 'sprout_compare' },
        { kind: 'block', type: 'sprout_not' },
        { kind: 'block', type: 'sprout_and' },
        { kind: 'block', type: 'sprout_or' },
        { kind: 'block', type: 'sprout_call_expr' },
      ],
    },
    {
      kind: 'category', name: 'Math', colour: '230',
      contents: [
        { kind: 'block', type: 'sprout_sin' },
        { kind: 'block', type: 'sprout_cos' },
        { kind: 'block', type: 'sprout_tan' },
        { kind: 'block', type: 'sprout_abs' },
        { kind: 'block', type: 'sprout_sqrt' },
        { kind: 'block', type: 'sprout_pow' },
        { kind: 'block', type: 'sprout_mod' },
        { kind: 'block', type: 'sprout_log' },
        { kind: 'block', type: 'sprout_floor' },
        { kind: 'block', type: 'sprout_ceil' },
        { kind: 'block', type: 'sprout_round' },
        { kind: 'block', type: 'sprout_max' },
        { kind: 'block', type: 'sprout_min' },
        { kind: 'block', type: 'sprout_random' },
        { kind: 'block', type: 'sprout_pi' },
        { kind: 'block', type: 'sprout_distance' },
        { kind: 'block', type: 'sprout_touching' },
      ],
    },
    {
      kind: 'category', name: 'Display', colour: '30',
      contents: [
        { kind: 'block', type: 'sprout_show' },
        { kind: 'block', type: 'sprout_puts' },
      ],
    },
  ],
};

interface Props {
  onTextChange: (text: string) => void;
  onWorkspaceReady: (ws: Blockly.Workspace) => void;
}

export function BlockWorkspace({ onTextChange, onWorkspaceReady }: Props) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerAllBlocks();
    const ws = Blockly.inject(divRef.current!, { toolbox: TOOLBOX });

    const listener = (e: Blockly.Events.Abstract) => {
      if (e.isUiEvent) return;
      try {
        onTextChange(generateText(ws));
      } catch {
        // Workspace is partially assembled (e.g. required input not yet connected); skip update.
      }
    };
    ws.addChangeListener(listener);
    onWorkspaceReady(ws);

    return () => {
      ws.removeChangeListener(listener);
      ws.dispose();
    };
    // Callbacks are stable refs from App — intentional empty dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
}
