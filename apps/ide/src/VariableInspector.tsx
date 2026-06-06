interface Props {
  variables: Record<string, string>;
}

export function VariableInspector({ variables }: Props) {
  const entries = Object.entries(variables);
  if (entries.length === 0) return null;

  return (
    <div style={{
      width: 500,
      marginTop: 4,
      border: '1px solid #e2e8f0',
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 13,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '3px 8px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        color: '#64748b',
        fontWeight: 600,
      }}>
        Variables
      </div>
      {entries.map(([name, value], i) => (
        <div key={name} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '2px 8px',
          background: i % 2 === 0 ? '#fff' : '#f8fafc',
        }}>
          <span style={{ color: '#1e293b' }}>{name}</span>
          <span style={{ color: '#2563eb' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}
