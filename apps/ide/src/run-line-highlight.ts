import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** Tell the editor which 1-based source line is currently being drawn (or null to clear). */
export const setActiveLine = StateEffect.define<number | null>();

const activeLineDeco = Decoration.line({ attributes: { class: 'cm-activeRunLine' } });

export const activeLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(set, tr) {
    set = set.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setActiveLine)) {
        const line = e.value;
        if (line === null) {
          set = Decoration.none;
        } else {
          const total = tr.state.doc.lines;
          const clamped = Math.min(Math.max(line, 1), total);
          const lineInfo = tr.state.doc.line(clamped);
          set = Decoration.set([activeLineDeco.range(lineInfo.from)]);
        }
      }
    }
    return set;
  },
  provide: f => EditorView.decorations.from(f),
});

/** Bundle: include this in the editor's extensions list. */
export const runLineHighlight = [activeLineField];
