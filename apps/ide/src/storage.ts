export type SaveState =
  | { mode: 'blocks'; blocks: string; text: string }
  | { mode: 'text';   text: string }

export function parseSave(json: string): SaveState | null {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    if (obj.mode === 'blocks') {
      if (typeof obj.blocks !== 'string' || typeof obj.text !== 'string') return null;
      return { mode: 'blocks', blocks: obj.blocks, text: obj.text };
    }
    if (obj.mode === 'text') {
      if (typeof obj.text !== 'string') return null;
      return { mode: 'text', text: obj.text };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildBlocksSave(blocks: string, text: string): SaveState {
  return { mode: 'blocks', blocks, text };
}

export function buildTextSave(text: string): SaveState {
  return { mode: 'text', text };
}

export function encodeShare(save: SaveState): string {
  const json = JSON.stringify(save);
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
}

export function decodeShare(hash: string): SaveState | null {
  if (!hash.startsWith('#share=')) return null;
  try {
    const json = decodeURIComponent(
      atob(hash.slice('#share='.length))
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return parseSave(json);
  } catch {
    return null;
  }
}
