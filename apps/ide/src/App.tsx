import { useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { BlockWorkspace } from './BlockWorkspace';

export function App() {
  const wsRef = useRef<Blockly.Workspace | null>(null);
  const [programText, setProgramText] = useState('');
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <BlockWorkspace
          onTextChange={setProgramText}
          onWorkspaceReady={ws => { wsRef.current = ws; }}
        />
      </div>
      <pre style={{ width: 400, padding: 8, whiteSpace: 'pre-wrap' }}>
        {programText || '// drag blocks to start'}
      </pre>
    </div>
  );
}
