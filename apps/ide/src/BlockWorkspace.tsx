import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { registerBlocks, compileWorkspace } from '@sprout/blocks';
import type { Program } from '@sprout/lang';

registerBlocks();

const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Drawing',
      colour: '160',
      contents: [
        {
          kind: 'block',
          type: 'sprout_forward',
          inputs: { DISTANCE: { shadow: { type: 'sprout_number', fields: { VALUE: 100 } } } },
        },
        {
          kind: 'block',
          type: 'sprout_turn',
          inputs: { DEGREES: { shadow: { type: 'sprout_number', fields: { VALUE: 90 } } } },
        },
        { kind: 'block', type: 'sprout_pen_up' },
        { kind: 'block', type: 'sprout_pen_down' },
      ],
    },
    {
      kind: 'category',
      name: 'Layout',
      colour: '120',
      contents: [
        { kind: 'block', type: 'sprout_beside' },
        { kind: 'block', type: 'sprout_above' },
        {
          kind: 'block',
          type: 'sprout_scale',
          inputs: { FACTOR: { shadow: { type: 'sprout_number', fields: { VALUE: 2 } } } },
        },
        { kind: 'block', type: 'sprout_expr_stmt' },
      ],
    },
    {
      kind: 'category',
      name: 'Control',
      colour: '200',
      contents: [
        {
          kind: 'block',
          type: 'sprout_repeat',
          inputs: { COUNT: { shadow: { type: 'sprout_number', fields: { VALUE: 4 } } } },
        },
        { kind: 'block', type: 'sprout_on' },
        { kind: 'block', type: 'sprout_def' },
      ],
    },
    {
      kind: 'category',
      name: 'Functions',
      colour: '270',
      contents: [
        { kind: 'block', type: 'sprout_call_stmt' },
        { kind: 'block', type: 'sprout_call_value' },
      ],
    },
    {
      kind: 'category',
      name: 'Values',
      colour: '230',
      contents: [
        { kind: 'block', type: 'sprout_number' },
        { kind: 'block', type: 'sprout_ident' },
        { kind: 'block', type: 'sprout_infix' },
      ],
    },
  ],
};

interface Props {
  onProgramChange: (program: Program | null) => void;
}

export default function BlockWorkspace({ onProgramChange }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);

  useEffect(() => {
    if (!divRef.current) return;

    const workspace = Blockly.inject(divRef.current, {
      toolbox: TOOLBOX,
      trashcan: true,
      scrollbars: true,
      zoom: { controls: true, startScale: 0.9 },
      grid: { spacing: 20, length: 3, colour: '#ddd', snap: true },
    });
    wsRef.current = workspace;

    function handleChange(event: Blockly.Events.Abstract) {
      // Skip UI-only events that don't affect the program structure
      if (
        event.type === Blockly.Events.VIEWPORT_CHANGE ||
        event.type === Blockly.Events.SELECTED ||
        event.type === Blockly.Events.CLICK ||
        event.type === Blockly.Events.THEME_CHANGE
      ) {
        return;
      }
      try {
        onProgramChange(compileWorkspace(workspace));
      } catch {
        onProgramChange(null);
      }
    }

    workspace.addChangeListener(handleChange);

    return () => {
      workspace.removeChangeListener(handleChange);
      workspace.dispose();
      wsRef.current = null;
    };
  }, [onProgramChange]);

  return (
    <div
      ref={divRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
