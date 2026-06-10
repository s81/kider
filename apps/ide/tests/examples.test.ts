import { describe, it, expect } from 'vitest';
import { parse } from '@sprout/parser';
import { interpretFull, callHandler } from '@sprout/lang';
import { EXAMPLES } from '../src/examples.js';

describe('examples gallery', () => {
  it('has at least five examples with unique names', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(5);
    const names = EXAMPLES.map(e => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const example of EXAMPLES) {
    describe(example.name, () => {
      it('parses', () => {
        expect(() => parse(example.code)).not.toThrow();
      });

      it('interprets without error', () => {
        expect(() => interpretFull(parse(example.code))).not.toThrow();
      });
    });
  }

  it('Catch Game registers a timer handler that runs clean', () => {
    const game = EXAMPLES.find(e => e.name === 'Catch Game');
    expect(game).toBeDefined();
    const { handlers } = interpretFull(parse(game!.code));
    const timerFn = handlers.get(':timer');
    expect(timerFn).toBeDefined();
    expect(() => callHandler(timerFn!)).not.toThrow();
  });
});
