interface Props {
  text: string;
}

export default function TextPanel({ text }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e' }}>
      <div style={{
        padding: '6px 12px',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        color: '#888',
        borderBottom: '1px solid #333',
        flexShrink: 0,
      }}>
        Sprout  ·  read only
      </div>
      <pre style={{
        flex: 1,
        margin: 0,
        padding: '12px 16px',
        fontFamily: '"Fira Code", "Cascadia Code", "Menlo", monospace',
        fontSize: 13,
        lineHeight: 1.6,
        color: '#d4d4d4',
        overflowY: 'auto',
        userSelect: 'none',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {text || '# drag blocks to start'}
      </pre>
    </div>
  );
}
