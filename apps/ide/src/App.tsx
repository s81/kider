import { useState, useCallback } from 'react';
import BlockWorkspace from './BlockWorkspace.js';
import TextPanel from './TextPanel.js';
import Stage from './Stage.js';
import type { Program } from '@sprout/lang';
import { serialize } from '@sprout/lang';

export default function App() {
  const [program, setProgram] = useState<Program | null>(null);
  const [text, setText] = useState('');

  const handleProgramChange = useCallback((p: Program | null) => {
    setProgram(p);
    setText(p ? serialize(p) : '');
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Block canvas — takes up the majority of width */}
      <div style={{ flex: '1 1 0', minWidth: 0, borderRight: '1px solid #ddd' }}>
        <BlockWorkspace onProgramChange={handleProgramChange} />
      </div>

      {/* Text panel */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid #ddd' }}>
        <TextPanel text={text} />
      </div>

      {/* Turtle stage */}
      <div style={{ width: 440, flexShrink: 0 }}>
        <Stage program={program} />
      </div>
    </div>
  );
}
