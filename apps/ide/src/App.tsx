import { useEffect, useRef, useState } from 'react';
import type * as Blockly from 'blockly';
import { compileWorkspace } from '@sprout/blocks';
import {
  interpretFull,
  callHandler,
  render,
  mkSequence,
  SproutRuntimeError,
} from '@sprout/lang';
import { parse, ParseError } from '@sprout/parser';
import type { CanvasCommand, Drawing, SproutFunction } from '@sprout/lang';
import { BlockWorkspace } from './BlockWorkspace.js';
import { TextPanel } from './TextPanel.js';
import { Stage } from './Stage.js';

type SourceMode = 'blocks' | 'editor';

export function App() {
  const wsRef = useRef<Blockly.Workspace | null>(null);
  const [programText, setProgramText] = useState('');
  const [editorText, setEditorText] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('blocks');
  const [commands, setCommands] = useState<CanvasCommand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);
  const [stepsPerFrame, setStepsPerFrame] = useState(3);
  const [editorParseError, setEditorParseError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (sourceMode !== 'editor') {
      setEditorParseError(null);
      return;
    }
    try {
      parse(editorText);
      setEditorParseError(null);
    } catch (e) {
      if (e instanceof ParseError) {
        setEditorParseError(e.message);
      } else {
        throw e;
      }
    }
  }, [editorText, sourceMode]);

  const accDrawingRef = useRef<Drawing | null>(null);
  const [handlers, setHandlers] = useState<Map<string, SproutFunction>>(new Map());

  function handleRun() {
    try {
      setError(null);
      let program;
      if (sourceMode === 'blocks') {
        const ws = wsRef.current;
        if (!ws) return;
        program = compileWorkspace(ws);
      } else {
        program = parse(editorText);
      }
      const { drawing, handlers: h } = interpretFull(program);
      accDrawingRef.current = drawing;
      setHandlers(h);
      setCommands(render(drawing));
    } catch (e) {
      if (e instanceof SproutRuntimeError || e instanceof ParseError) {
        setError(e.message);
      } else {
        setError(String(e));
      }
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

  function handleSwitchToEditor() {
    setEditorText(programText);
    setSourceMode('editor');
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

      {/* Right panel */}
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

        {/* Source mode tabs */}
        <div style={{ display: 'flex', gap: 4, fontSize: 13 }}>
          <button
            onClick={() => setSourceMode('blocks')}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: sourceMode === 'blocks' ? '#2563eb' : '#fff',
              color: sourceMode === 'blocks' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: sourceMode === 'blocks' ? 600 : 400,
            }}
          >
            Blocks
          </button>
          <button
            onClick={handleSwitchToEditor}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: sourceMode === 'editor' ? '#2563eb' : '#fff',
              color: sourceMode === 'editor' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: sourceMode === 'editor' ? 600 : 400,
            }}
          >
            Text
          </button>
        </div>

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

        <TextPanel
          text={sourceMode === 'blocks' ? programText : editorText}
          editable={sourceMode === 'editor'}
          onChange={setEditorText}
          error={sourceMode === 'editor' ? editorParseError : null}
        />

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
