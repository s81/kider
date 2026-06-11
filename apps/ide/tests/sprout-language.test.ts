import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import {
  SPROUT_BUILTINS,
  SPROUT_KEYWORDS,
  sproutCompletions,
} from '../src/sprout-language.js';

describe('SPROUT_BUILTINS', () => {
  it('is non-empty', () => {
    expect(SPROUT_BUILTINS.length).toBeGreaterThan(0);
  });

  it('contains core motion builtins', () => {
    expect(SPROUT_BUILTINS).toContain('forward');
    expect(SPROUT_BUILTINS).toContain('circle');
    expect(SPROUT_BUILTINS).toContain('sprite');
  });

  it('contains recently added sprite builtins', () => {
    expect(SPROUT_BUILTINS).toContain('bounceSprite');
    expect(SPROUT_BUILTINS).toContain('cloneSprite');
  });
});

describe('SPROUT_KEYWORDS', () => {
  it('contains loop and forever', () => {
    expect(SPROUT_KEYWORDS).toContain('loop');
    expect(SPROUT_KEYWORDS).toContain('forever');
  });

  it('contains core keywords', () => {
    expect(SPROUT_KEYWORDS).toContain('repeat');
    expect(SPROUT_KEYWORDS).toContain('def');
    expect(SPROUT_KEYWORDS).toContain('if');
  });
});

function makeContext(doc: string, pos: number, explicit = true): CompletionContext {
  const state = EditorState.create({ doc });
  return new CompletionContext(state, pos, explicit);
}

describe('sproutCompletions', () => {
  it('returns builtin options when typing a partial function name', () => {
    const result = sproutCompletions(makeContext('forw', 4));
    expect(result).not.toBeNull();
    const options = (result as { options: { label: string }[] }).options;
    expect(options.some(o => o.label === 'forward')).toBe(true);
  });

  it('returns keyword options', () => {
    const result = sproutCompletions(makeContext('rep', 3));
    const options = (result as { options: { label: string }[] }).options;
    expect(options.some(o => o.label === 'repeat')).toBe(true);
  });

  it('returns only symbol options when text starts with :', () => {
    const result = sproutCompletions(makeContext(':re', 3));
    const options = (result as { options: { label: string }[] }).options;
    expect(options.length).toBeGreaterThan(0);
    expect(options.every(o => o.label.startsWith(':'))).toBe(true);
    expect(options.some(o => o.label === ':red')).toBe(true);
  });

  it('includes user-defined variable from let declaration in document', () => {
    const doc = 'let myBall = 0\nmyB';
    const result = sproutCompletions(makeContext(doc, doc.length));
    const options = (result as { options: { label: string }[] }).options;
    expect(options.some(o => o.label === 'myBall')).toBe(true);
  });

  it('includes user-defined function from def declaration', () => {
    const doc = 'def drawStar(n) = circle(n)\ndra';
    const result = sproutCompletions(makeContext(doc, doc.length));
    const options = (result as { options: { label: string }[] }).options;
    expect(options.some(o => o.label === 'drawStar')).toBe(true);
  });

  it('returns null for empty non-explicit context', () => {
    const result = sproutCompletions(makeContext('', 0, false));
    expect(result).toBeNull();
  });

  it('symbol completions only offer values the interpreter accepts', () => {
    const result = sproutCompletions(makeContext(':', 1));
    const labels = (result as { options: { label: string }[] }).options.map(o => o.label);
    // Colors from the interpreter's COLOR_MAP + keys from KEY_NAMES + :timer
    expect(labels).toEqual([
      ':red', ':orange', ':yellow', ':green', ':blue', ':purple',
      ':white', ':black', ':pink',
      ':left', ':right', ':up', ':down', ':space', ':timer',
    ]);
  });
});
