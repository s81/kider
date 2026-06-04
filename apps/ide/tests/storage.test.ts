import { describe, it, expect } from 'vitest';
import { parseSave, buildBlocksSave, buildTextSave } from '../src/storage.js';

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
