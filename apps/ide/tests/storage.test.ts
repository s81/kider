import { describe, it, expect } from 'vitest';
import { parseSave, buildBlocksSave, buildTextSave, encodeShare, decodeShare } from '../src/storage.js';

describe('parseSave', () => {
  it('returns null for invalid JSON', () => {
    expect(parseSave('not json')).toBeNull();
  });

  it('returns null for JSON missing mode field', () => {
    expect(parseSave(JSON.stringify({ blocks: '{}', text: 'forward(100)' }))).toBeNull();
  });

  it('returns null for blocks save missing blocks field', () => {
    expect(parseSave(JSON.stringify({ mode: 'blocks', text: 'forward(100)' }))).toBeNull();
  });

  it('returns null for blocks save missing text field', () => {
    expect(parseSave(JSON.stringify({ mode: 'blocks', blocks: '{}' }))).toBeNull();
  });

  it('round-trips a valid blocks save', () => {
    const save = { mode: 'blocks', blocks: '{"blocks":{}}', text: 'forward(100)' };
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });

  it('round-trips a valid text save', () => {
    const save = { mode: 'text', text: 'forward(100)' };
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });

  it('returns null for text save missing text field', () => {
    expect(parseSave(JSON.stringify({ mode: 'text' }))).toBeNull();
  });
});

describe('buildBlocksSave', () => {
  it('returns correct blocks save shape', () => {
    expect(buildBlocksSave('{"blocks":{}}', 'forward(100)')).toEqual({
      mode: 'blocks',
      blocks: '{"blocks":{}}',
      text: 'forward(100)',
    });
  });
});

describe('buildTextSave', () => {
  it('returns correct text save shape', () => {
    expect(buildTextSave('forward(100)')).toEqual({
      mode: 'text',
      text: 'forward(100)',
    });
  });
});

describe('encodeShare / decodeShare', () => {
  it('round-trips a text save', () => {
    const save = buildTextSave('forward(100)');
    expect(decodeShare('#share=' + encodeShare(save))).toEqual(save);
  });

  it('round-trips a blocks save', () => {
    const save = buildBlocksSave('{"blocks":{}}', 'forward(100)');
    expect(decodeShare('#share=' + encodeShare(save))).toEqual(save);
  });

  it('round-trips text containing Unicode (emoji)', () => {
    const save = buildTextSave('text("hello 🌈", 20)');
    expect(decodeShare('#share=' + encodeShare(save))).toEqual(save);
  });

  it('decodeShare returns null for empty string', () => {
    expect(decodeShare('')).toBeNull();
  });

  it('decodeShare returns null for wrong prefix', () => {
    expect(decodeShare('#other=abc')).toBeNull();
  });

  it('decodeShare returns null for malformed base64', () => {
    expect(decodeShare('#share=!!!')).toBeNull();
  });

  it('decodeShare returns null for valid base64 but invalid save JSON', () => {
    const badPayload = btoa('{"mode":"unknown"}');
    expect(decodeShare('#share=' + badPayload)).toBeNull();
  });
});
