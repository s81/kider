import { describe, it, expect } from 'vitest';
import {
  tagLines,
  mkCircle,
  mkForward,
  mkSequence,
  mkBeside,
  mkScale,
  mkFillPath,
} from '../src/values.js';

describe('tagLines', () => {
  it('stamps a line onto a single untagged primitive', () => {
    const out = tagLines(mkCircle(20), 3);
    expect(out.line).toBe(3);
    expect(out.kind).toBe('circle');
  });

  it('recurses into sequence / beside / scale / fillPath children', () => {
    const tree = mkSequence([
      mkBeside(mkForward(10), mkCircle(5)),
      mkScale(2, mkForward(7)),
      mkFillPath(mkForward(3)),
    ]);
    const out = tagLines(tree, 7);
    expect(out.line).toBe(7);
    expect(out.kind).toBe('sequence');
    if (out.kind !== 'sequence') return;
    for (const step of out.steps) {
      expect(step.line).toBe(7);
    }
    const beside = out.steps[0];
    if (beside.kind !== 'beside') throw new Error('expected beside');
    expect(beside.left.line).toBe(7);
    expect(beside.right.line).toBe(7);
    const scale = out.steps[1];
    if (scale.kind !== 'scale') throw new Error('expected scale');
    expect(scale.drawing.line).toBe(7);
    const fillPath = out.steps[2];
    if (fillPath.kind !== 'fillPath') throw new Error('expected fillPath');
    expect(fillPath.drawing.line).toBe(7);
  });

  it('leaves an already-tagged subtree untouched (innermost wins)', () => {
    const inner = tagLines(mkForward(5), 2);
    const tree = mkSequence([mkCircle(10), inner]);
    const out = tagLines(tree, 9);
    if (out.kind !== 'sequence') throw new Error('expected sequence');
    expect(out.line).toBe(9);
    expect(out.steps[0].line).toBe(9);
    expect(out.steps[1].line).toBe(2);
  });
});
