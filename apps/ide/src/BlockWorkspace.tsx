import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { registerAllBlocks, generateText } from '@sprout/blocks';

const TOOLBOX: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'flyoutToolbox',
  contents: [
    { kind: 'block', type: 'sprout_forward' },
    { kind: 'block', type: 'sprout_turn' },
    { kind: 'block', type: 'sprout_pen_up' },
    { kind: 'block', type: 'sprout_pen_down' },
    { kind: 'block', type: 'sprout_repeat' },
    { kind: 'block', type: 'sprout_def' },
    { kind: 'block', type: 'sprout_call_stmt' },
    { kind: 'block', type: 'sprout_beside' },
    { kind: 'block', type: 'sprout_above' },
    { kind: 'block', type: 'sprout_scale' },
    { kind: 'block', type: 'sprout_on_event' },
    { kind: 'block', type: 'sprout_number' },
    { kind: 'block', type: 'sprout_ident' },
    { kind: 'block', type: 'sprout_infix' },
    { kind: 'block', type: 'sprout_call_expr' },
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
      onTextChange(generateText(ws));
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
