import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { compileWorkspace } from '@sprout/blocks';
import {
  interpretFullWithInputs,
  collectInputNames,
  callHandler,
  render,
  mkSequence,
  SproutRuntimeError,
} from '@sprout/lang';
import { parse, ParseError } from '@sprout/parser';
import type { CanvasCommand, Drawing, SproutFunction } from '@sprout/lang';
import { parseSave, buildBlocksSave, buildTextSave, encodeShare, decodeShare } from './storage.js';
import type { SaveState } from './storage.js';
import { BlockWorkspace } from './BlockWorkspace.js';
import { TextPanel } from './TextPanel.js';
import { Stage } from './Stage.js';

type SourceMode = 'blocks' | 'editor';

const TIMER_INTERVAL_MS = 200;

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
  const [shareConfirm, setShareConfirm] = useState(false);
  const [inputNames, setInputNames] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, number>>({});

  useEffect(() => {
    // Clear any stale runtime error from a previous Run when the user edits.
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

  useEffect(() => {
    try {
      const text = sourceMode === 'blocks' ? programText : editorText;
      if (!text.trim()) { setInputNames([]); return; }
      const prog = parse(text);
      const names = collectInputNames(prog);
      setInputNames(names);
      setInputValues(prev => {
        const next: Record<string, number> = {};
        for (const name of names) next[name] = prev[name] ?? 0;
        return next;
      });
    } catch {
      // Parse error — leave inputNames unchanged
    }
  }, [programText, editorText, sourceMode]);

  useEffect(() => {
    const ws = wsRef.current;
    if (sourceMode === 'blocks') {
      if (!ws) return;
      const blocks = JSON.stringify(Blockly.serialization.workspaces.save(ws));
      localStorage.setItem('sprout_save', JSON.stringify(buildBlocksSave(blocks, programText)));
    } else {
      localStorage.setItem('sprout_save', JSON.stringify(buildTextSave(editorText)));
    }
  }, [sourceMode, programText, editorText]);

  useEffect(() => {
    const raw = localStorage.getItem('sprout_save');
    if (!raw) return;
    const saved = parseSave(raw);
    if (!saved || saved.mode !== 'text') return;
    setEditorText(saved.text);
    setSourceMode('editor');
  }, []);

  useEffect(() => {
    const saved = decodeShare(window.location.hash);
    if (!saved) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (saved.mode === 'text') {
      setEditorText(saved.text);
      setSourceMode('editor');
    }
    // blocks mode is handled in onWorkspaceReady (child effects run before parent effects)
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const accDrawingRef = useRef<Drawing | null>(null);
  const [handlers, setHandlers] = useState<Map<string, SproutFunction>>(new Map());
  const handlersRef = useRef<Map<string, SproutFunction>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const KEY_MAP: Record<string, string> = {
      ArrowLeft:  ':left',
      ArrowRight: ':right',
      ArrowUp:    ':up',
      ArrowDown:  ':down',
      ' ':        ':space',
    };
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const handlerKey = KEY_MAP[e.key];
      if (!handlerKey) return;
      const fn = handlersRef.current.get(handlerKey);
      if (!fn || accDrawingRef.current === null) return;
      e.preventDefault();
      try {
        const delta = callHandler(fn);
        applyHandlerDelta(delta);
      } catch (err) {
        setError(err instanceof SproutRuntimeError ? err.message : String(err));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  function applyHandlerDelta(delta: Drawing) {
    const deltaCommands = render(delta);
    const usesClear = deltaCommands.some(c => c.kind === 'clearCanvas');
    if (usesClear) {
      accDrawingRef.current = delta;
      setCommands(deltaCommands);
    } else {
      const next = mkSequence([accDrawingRef.current!, delta]);
      accDrawingRef.current = next;
      setCommands(render(next));
    }
  }

  function handleRun() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
      const inputMap = new Map(
        Object.entries(inputValues).map(([k, v]) => [k, v] as [string, number])
      );
      const { drawing, handlers: h } = interpretFullWithInputs(program, inputMap);
      accDrawingRef.current = drawing;
      handlersRef.current = h;
      setHandlers(h);
      setCommands(render(drawing));
      const timerFn = h.get(':timer');
      if (timerFn) {
        timerRef.current = setInterval(() => {
          if (accDrawingRef.current === null) return;
          try {
            const delta = callHandler(timerFn);
            applyHandlerDelta(delta);
          } catch (e) {
            setError(e instanceof SproutRuntimeError ? e.message : String(e));
            if (timerRef.current !== null) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setHandlers(new Map());
            handlersRef.current = new Map();
          }
        }, TIMER_INTERVAL_MS);
      }
    } catch (e) {
      if (e instanceof SproutRuntimeError || e instanceof ParseError) {
        setError(e.message);
      } else {
        setError(String(e));
      }
      setCommands([]);
      setHandlers(new Map());
      handlersRef.current = new Map();
      accDrawingRef.current = null;
    }
  }

  function handleCanvasClick() {
    const clickFn = handlers.get(':click');
    if (!clickFn || accDrawingRef.current === null) return;
    try {
      const delta = callHandler(clickFn);
      applyHandlerDelta(delta);
    } catch (e) {
      setError(e instanceof SproutRuntimeError ? e.message : String(e));
    }
  }

  function handleSwitchToEditor() {
    setEditorText(programText);
    setSourceMode('editor');
  }

  function handleExport() {
    const text = sourceMode === 'blocks' ? programText : editorText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program.sprout';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setEditorText(text);
      setSourceMode('editor');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleShare() {
    let save: SaveState;
    if (sourceMode === 'blocks' && wsRef.current) {
      const blocksJson = JSON.stringify(Blockly.serialization.workspaces.save(wsRef.current));
      save = buildBlocksSave(blocksJson, programText);
    } else {
      save = buildTextSave(editorText);
    }
    const encoded = encodeShare(save);
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareConfirm(true);
      setTimeout(() => setShareConfirm(false), 2000);
    });
  }

  const hasClickHandler = handlers.has(':click');
  const hasKeyHandlers = handlers.has(':left') || handlers.has(':right') || handlers.has(':up') ||
    handlers.has(':down') || handlers.has(':space');

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'sans-serif' }}>
      {/* Left: Blockly workspace */}
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <BlockWorkspace
          onTextChange={setProgramText}
          onWorkspaceReady={ws => {
            wsRef.current = ws;
            // URL share takes priority over localStorage (child effects run before parent effects,
            // so this fires before the mount useEffect that clears the hash for text shares)
            const share = decodeShare(window.location.hash);
            if (share?.mode === 'blocks') {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
              try {
                Blockly.serialization.workspaces.load(
                  JSON.parse(share.blocks) as Record<string, unknown>,
                  ws,
                  { recordUndo: false },
                );
              } catch { /* ignore corrupt share */ }
              return;
            }
            const raw = localStorage.getItem('sprout_save');
            if (!raw) return;
            const saved = parseSave(raw);
            if (!saved || saved.mode !== 'blocks') return;
            try {
              Blockly.serialization.workspaces.load(
                JSON.parse(saved.blocks) as Record<string, unknown>,
                ws,
                { recordUndo: false },
              );
            } catch {
              // Silently ignore corrupt save data
            }
          }}
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

        {/* Export / Import */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              padding: '4px 0',
              fontSize: 13,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            ↓ Export
          </button>
          <button
            onClick={handleImport}
            style={{
              flex: 1,
              padding: '4px 0',
              fontSize: 13,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            ↑ Import
          </button>
          <button
            onClick={handleShare}
            style={{
              flex: 1,
              padding: '4px 0',
              fontSize: 13,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              color: shareConfirm ? '#16a34a' : '#334155',
            }}
          >
            {shareConfirm ? '✓ Copied!' : '↗ Share'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sprout,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
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

        {(hasKeyHandlers || handlers.has(':timer')) && (
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            {[
              hasKeyHandlers ? '← → ↑ ↓ space active' : '',
              handlers.has(':timer') ? `timer active (${TIMER_INTERVAL_MS}ms)` : '',
            ].filter(Boolean).join(' · ')}
          </div>
        )}

        {inputNames.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '6px 8px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Inputs
            </div>
            {inputNames.map(name => (
              <label
                key={name}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
              >
                <span style={{ minWidth: 80, color: '#475569' }}>{name}</span>
                <input
                  type="number"
                  value={inputValues[name] ?? 0}
                  onChange={e =>
                    setInputValues(prev => ({
                      ...prev,
                      [name]: Number(e.target.value) || 0,
                    }))
                  }
                  style={{
                    width: 72,
                    padding: '2px 6px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                />
              </label>
            ))}
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
