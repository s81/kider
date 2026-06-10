import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { registerAllBlocks, generateText } from '@sprout/blocks';

const TOOLBOX: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'flyoutToolbox',
  contents: [
    // Motion
    { kind: 'block', type: 'sprout_forward' },
    { kind: 'block', type: 'sprout_turn' },
    { kind: 'block', type: 'sprout_arc' },
    { kind: 'block', type: 'sprout_goto' },
    { kind: 'block', type: 'sprout_home' },
    { kind: 'block', type: 'sprout_get_x' },
    { kind: 'block', type: 'sprout_get_y' },
    { kind: 'block', type: 'sprout_get_heading' },
    { kind: 'block', type: 'sprout_stamp' },
    // Pen
    { kind: 'block', type: 'sprout_pen_up' },
    { kind: 'block', type: 'sprout_pen_down' },
    { kind: 'block', type: 'sprout_color' },
    { kind: 'block', type: 'sprout_random_color' },
    { kind: 'block', type: 'sprout_background' },
    { kind: 'block', type: 'sprout_clear_canvas' },
    { kind: 'block', type: 'sprout_pen_width' },
    // Control
    { kind: 'block', type: 'sprout_repeat' },
    { kind: 'block', type: 'sprout_repeat_with' },
    { kind: 'block', type: 'sprout_repeat_index' },
    { kind: 'block', type: 'sprout_if' },
    { kind: 'block', type: 'sprout_while' },
    { kind: 'block', type: 'sprout_for_each' },
    { kind: 'block', type: 'sprout_wait' },
    { kind: 'block', type: 'sprout_on_event' },
    { kind: 'block', type: 'sprout_on_timer' },
    // Variables
    { kind: 'block', type: 'sprout_let' },
    { kind: 'block', type: 'sprout_set' },
    // Functions
    { kind: 'block', type: 'sprout_def' },
    { kind: 'block', type: 'sprout_call_stmt' },
    { kind: 'block', type: 'sprout_return' },
    // Composition
    { kind: 'block', type: 'sprout_beside' },
    { kind: 'block', type: 'sprout_above' },
    { kind: 'block', type: 'sprout_scale' },
    // Lists — Create
    { kind: 'block', type: 'sprout_list' },
    { kind: 'block', type: 'sprout_range' },
    // Lists — Access
    { kind: 'block', type: 'sprout_at' },
    { kind: 'block', type: 'sprout_get' },
    { kind: 'block', type: 'sprout_first' },
    { kind: 'block', type: 'sprout_last' },
    { kind: 'block', type: 'sprout_index_of' },
    { kind: 'block', type: 'sprout_slice' },
    // Lists — Query
    { kind: 'block', type: 'sprout_size' },
    { kind: 'block', type: 'sprout_is_empty' },
    { kind: 'block', type: 'sprout_contains' },
    // Lists — Modify
    { kind: 'block', type: 'sprout_push' },
    { kind: 'block', type: 'sprout_pop' },
    { kind: 'block', type: 'sprout_concat' },
    { kind: 'block', type: 'sprout_reverse' },
    { kind: 'block', type: 'sprout_sort' },
    // Lists — Transform
    { kind: 'block', type: 'sprout_map' },
    { kind: 'block', type: 'sprout_filter' },
    { kind: 'block', type: 'sprout_reduce' },
    // Text
    { kind: 'block', type: 'sprout_string' },
    { kind: 'block', type: 'sprout_join' },
    { kind: 'block', type: 'sprout_length' },
    // Values
    { kind: 'block', type: 'sprout_number' },
    { kind: 'block', type: 'sprout_input' },
    { kind: 'block', type: 'sprout_mouse_x' },
    { kind: 'block', type: 'sprout_mouse_y' },
    { kind: 'block', type: 'sprout_bool' },
    { kind: 'block', type: 'sprout_ident' },
    { kind: 'block', type: 'sprout_infix' },
    { kind: 'block', type: 'sprout_compare' },
    { kind: 'block', type: 'sprout_not' },
    { kind: 'block', type: 'sprout_and' },
    { kind: 'block', type: 'sprout_or' },
    { kind: 'block', type: 'sprout_call_expr' },
    // Math
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
    // Shapes
    { kind: 'block', type: 'sprout_circle' },
    { kind: 'block', type: 'sprout_rect' },
    { kind: 'block', type: 'sprout_ellipse' },
    { kind: 'block', type: 'sprout_triangle' },
    { kind: 'block', type: 'sprout_polygon' },
    { kind: 'block', type: 'sprout_text' },
    // Display
    { kind: 'block', type: 'sprout_show' },
    // Output
    { kind: 'block', type: 'sprout_puts' },
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
