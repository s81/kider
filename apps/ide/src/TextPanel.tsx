import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CSSProperties } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
import { sproutLanguage, sproutCompletions } from './sprout-language.js';
import { sproutLinter } from './sprout-lint.js';
import { lineToPos, makeRunCommand } from './editor-utils.js';
import { runLineHighlight, setActiveLine } from './run-line-highlight.js';

const SHARED_PRE_STYLE: CSSProperties = {
  flex: '1 1 0',
  background: '#1e1e1e',
  color: '#d4d4d4',
  padding: 12,
  margin: 0,
  fontFamily: '"Fira Code", "Consolas", monospace',
  fontSize: 13,
  lineHeight: 1.5,
  borderRadius: 4,
  minHeight: 120,
};

const EDITOR_THEME = EditorView.theme({
  '&': {
    background: '#1e1e1e',
    color: '#d4d4d4',
    borderRadius: '4px',
    outline: '2px solid #2563eb',
    height: '100%',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily: '"Fira Code", "Consolas", monospace',
    lineHeight: '1.5',
    padding: '12px 0',
  },
  '.cm-gutters': {
    background: '#1e1e1e',
    color: '#555',
    borderRight: '1px solid #333',
  },
  '.cm-activeLineGutter': { background: '#2a2a2a' },
  '.cm-activeLine': { background: '#2a2a2a' },
  '.cm-activeRunLine': { background: 'rgba(255, 213, 0, 0.18)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    background: '#264f78',
  },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#d4d4d4' },
});

export interface EditorHandle {
  jumpToLine(line: number): void;
  /** Highlight (or clear) the given 1-based source line as currently drawing. */
  highlightLine(line: number | null): void;
}

interface Props {
  text: string;
  editable?: boolean;
  onChange?: (text: string) => void;
  error?: string | null;
  onRun?: () => void;
}

export const TextPanel = forwardRef<EditorHandle, Props>(function TextPanel(
  { text, editable = false, onChange, error = null, onRun }: Props,
  ref,
) {
  const divRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  useImperativeHandle(ref, () => ({
    jumpToLine(line: number) {
      const view = viewRef.current;
      if (!view) return;
      const pos = lineToPos(view.state, line);
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    },
    highlightLine(line: number | null) {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ effects: setActiveLine.of(line) });
    },
  }), []);

  // Mount the editor once (editable mode only).
  useEffect(() => {
    if (!editable || !divRef.current) return;

    const view = new EditorView({
      doc: text,
      extensions: [
        Prec.highest(keymap.of([
          { key: 'Mod-Enter', run: makeRunCommand(() => onRunRef.current) },
        ])),
        basicSetup,
        sproutLanguage,
        autocompletion({ override: [sproutCompletions] }),
        sproutLinter,
        ...runLineHighlight,
        EDITOR_THEME,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ],
      parent: divRef.current,
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; `text` syncs via the effect below, onChange via onChangeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  // Sync externally-changed text (loading an example, share import, mode switch).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== text) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: text },
      });
    }
  }, [text]);

  if (editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
        <div
          ref={divRef}
          style={{ flex: '1 1 0', minHeight: 120, overflow: 'auto', borderRadius: 4 }}
        />
        <div style={{ fontSize: 11, color: '#94a3b8' }}>Press Ctrl/⌘+Enter to run</div>
        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: 8,
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <pre
      style={{
        ...SHARED_PRE_STYLE,
        overflow: 'auto',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {text || '// drag blocks to start'}
    </pre>
  );
});
