interface Props {
  text: string;
}

export function TextPanel({ text }: Props) {
  return (
    <pre
      style={{
        flex: '1 1 0',
        overflow: 'auto',
        background: '#1e1e1e',
        color: '#d4d4d4',
        padding: 12,
        margin: 0,
        fontFamily: '"Fira Code", "Consolas", monospace',
        fontSize: 13,
        lineHeight: 1.5,
        userSelect: 'none',
        cursor: 'default',
        borderRadius: 4,
        minHeight: 120,
      }}
    >
      {text || '// drag blocks to start'}
    </pre>
  );
}
