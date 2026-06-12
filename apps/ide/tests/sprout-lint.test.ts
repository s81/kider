import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { sproutDiagnostics, stripLinePrefix } from '../src/sprout-lint.js';

const state = (doc: string) => EditorState.create({ doc });

describe('stripLinePrefix', () => {
  it('removes a leading "Line N: " prefix', () => {
    expect(stripLinePrefix('Line 4: boom')).toBe('boom');
  });
  it('leaves an unprefixed message unchanged', () => {
    expect(stripLinePrefix('boom')).toBe('boom');
  });
});

describe('sproutDiagnostics', () => {
  it('returns [] for an empty document', () => {
    expect(sproutDiagnostics(state(''))).toEqual([]);
  });
  it('returns [] for a whitespace-only document', () => {
    expect(sproutDiagnostics(state('   \n  '))).toEqual([]);
  });
  it('returns [] for a valid program', () => {
    expect(sproutDiagnostics(state('forward(100)\nturn(90)'))).toEqual([]);
  });
  it('flags a syntax error with exactly one error diagnostic', () => {
    const ds = sproutDiagnostics(state('forward('));
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe('error');
  });
  it('spans the whole error line', () => {
    const doc = 'circle(10)\nforward('; // error attributed to line 2 (EOF line)
    const ds = sproutDiagnostics(state(doc));
    const line2 = state(doc).doc.line(2);
    expect(ds[0].from).toBe(line2.from);
    expect(ds[0].to).toBe(line2.to);
  });
  it('strips the "Line N:" prefix from the message', () => {
    const ds = sproutDiagnostics(state('forward('));
    expect(ds[0].message).not.toMatch(/^Line \d+:/);
  });
});
