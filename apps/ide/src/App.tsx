import { useRef, useState } from 'react';
import type * as Blockly from 'blockly';
import { compileWorkspace } from '@sprout/blocks';
import {
  interpretFull,
  callHandler,
  render,
  mkSequence,
  SproutRuntimeError,
} from '@sprout/lang';
import type { CanvasCommand, Drawing, SproutFunction } from '@sprout/lang';
import { BlockWorkspace } from './BlockWorkspace.js';
import { TextPanel } from './TextPanel.js';
import { Stage } from './Stage.js';

export function App() {
  const wsRef = useRef<Blockly.Workspace | null>(null);
  const [programText, setProgramText] = useState('');
  const [commands, setCommands] = useState<CanvasCommand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [stepsPerFrame, setStepsPerFrame] = useState(3);

  // Accumulated drawing state for click handler compositing
  const accDrawingRef = useRef<Drawing | null>(null);
  const [handlers, setHandlers] = useState<Map<string, SproutFunction>>(new Map());

  function handleRun() {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      setError(null);
      const program = compileWorkspace(ws);
      const { drawing, handlers: h } = interpretFull(program);
      accDrawingRef.current = drawing;
      setHandlers(h);
      setCommands(render(drawing));
    } catch (e) {
      setError(e instanceof SproutRuntimeError ? e.message : String(e));
      setCommands([]);
      setHandlers(new Map());
      accDrawingRef.current = null;
    }
  }

  function handleCanvasClick() {
    const clickFn = handlers.get(':click');
    if (!clickFn || accDrawingRef.current === null) return;
    try {
      const delta = callHandler(clickFn);
      const next = mkSequence([accDrawingRef.current, delta]);
      accDrawingRef.current = next;
      setCommands(render(next));
    } catch (e) {
      setError(e instanceof SproutRuntimeError ? e.message : String(e));
    }
  }

  const hasClickHandler = handlers.has(':click');

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'sans-serif' }}>
      {/* Left: Blockly workspace */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <BlockWorkspace
          onTextChange={setProgramText}
          onWorkspaceReady={ws => { wsRef.current = ws; }}
        />
      </div>

      {/* Right: controls + text panel + stage */}
      <div
        style={{
          width: 524,
          display: 'flex',
          flexDirection: 'column',
          padding: 8,
          gap: 8,
          background: '#f8fafc',
          borderLeft: '1px solid #e2e8f0',
        }}
      >
        <button
          onClick={handleRun}
          style={{
            padding: '8px 0',
            fontSize: 15,
            fontWeight: 600,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ▶ Run
        </button>

        {/* Animation controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={animated}
              onChange={e => setAnimated(e.target.checked)}
            />
            Animate
          </label>
          {animated && (
            <>
              <span>Speed:</span>
              <input
                type="range"
                min={1}
                max={20}
                value={stepsPerFrame}
                onChange={e => setStepsPerFrame(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ minWidth: 20, textAlign: 'right' }}>{stepsPerFrame}</span>
            </>
          )}
        </div>

        {hasClickHandler && (
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            Click the canvas to fire the :click handler
          </div>
        )}

        <TextPanel text={programText} />

        <Stage
          commands={commands}
          animated={animated}
          stepsPerFrame={stepsPerFrame}
          onClick={hasClickHandler ? handleCanvasClick : undefined}
        />

        {error && (
          <pre
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 8,
              borderRadius: 4,
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </pre>
        )}
      </div>
    </div>
  );
}
