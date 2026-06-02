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
}

export function TextPanel({ text, editable = false, onChange }: Props) {
  if (editable) {
    return (
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
