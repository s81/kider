const SHARED_STYLE: React.CSSProperties = {
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

interface Props {
  text: string;
  editable?: boolean;
  onChange?: (text: string) => void;
  error?: string | null;
}

export function TextPanel({ text, editable = false, onChange, error = null }: Props) {
  if (editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
        <textarea
          value={text}
          onChange={e => onChange?.(e.target.value)}
          spellCheck={false}
          style={{
            ...SHARED_STYLE,
            resize: 'none',
            border: 'none',
            outline: '2px solid #2563eb',
            cursor: 'text',
            userSelect: 'text',
          }}
        />
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
        ...SHARED_STYLE,
        overflow: 'auto',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {text || '// drag blocks to start'}
    </pre>
  );
}
