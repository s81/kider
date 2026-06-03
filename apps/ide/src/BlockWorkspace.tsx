import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { registerAllBlocks, generateText } from '@sprout/blocks';

const TOOLBOX: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'flyoutToolbox',
  contents: [
    // Motion
    { kind: 'block', type: 'sprout_forward' },
    { kind: 'block', type: 'sprout_turn' },
    // Pen
    { kind: 'block', type: 'sprout_pen_up' },
    { kind: 'block', type: 'sprout_pen_down' },
    { kind: 'block', type: 'sprout_color' },
    { kind: 'block', type: 'sprout_pen_width' },
    // Control
    { kind: 'block', type: 'sprout_repeat' },
    { kind: 'block', type: 'sprout_if' },
    { kind: 'block', type: 'sprout_while' },
    { kind: 'block', type: 'sprout_on_event' },
    // Variables
    { kind: 'block', type: 'sprout_let' },
    { kind: 'block', type: 'sprout_set' },
    // Functions
    { kind: 'block', type: 'sprout_def' },
    { kind: 'block', type: 'sprout_call_stmt' },
    // Composition
    { kind: 'block', type: 'sprout_beside' },
    { kind: 'block', type: 'sprout_above' },
    { kind: 'block', type: 'sprout_scale' },
    // Values
    { kind: 'block', type: 'sprout_number' },
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
    onWorkspaceReady(ws);

    const listener = (e: Blockly.Events.Abstract) => {
      if (e.isUiEvent) return;
      try {
        onTextChange(generateText(ws));
      } catch {
        // Workspace is partially assembled (e.g. required input not yet connected); skip update.
      }
    };
    ws.addChangeListener(listener);

    return () => {
      ws.removeChangeListener(listener);
      ws.dispose();
    };
    // Callbacks are stable refs from App — intentional empty dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
}
