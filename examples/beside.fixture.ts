// Fixture 3: Beside — defines square, then places two copies side by side.
// In Sprout, `square` with no args is called as `square()` to produce a Drawing value.
// Bare name references (`ident('square')`) return a SproutFunction, which cannot be
// passed to `beside`. The block compiler (Phase 2) will generate call blocks for
// zero-arg functions in expression position.
import type { Program } from '@sprout/lang';

export const program: Program = {
  kind: 'Program',
  stmts: [
    {
      kind: 'DefStmt',
      name: 'square',
      params: [],
      body: {
        kind: 'RepeatExpr',
        count: { kind: 'NumberLit', value: 4 },
        item: null,
        body: {
          kind: 'BlockExpr',
          body: [
            {
              kind: 'ExprStmt',
              expr: {
                kind: 'CallExpr',
                callee: 'forward',
                args: [{ kind: 'NumberLit', value: 100 }],
                block: null,
              },
            },
            {
              kind: 'ExprStmt',
              expr: {
                kind: 'CallExpr',
                callee: 'turn',
                args: [{ kind: 'NumberLit', value: 90 }],
                block: null,
              },
            },
          ],
        },
      },
    },
    {
      kind: 'ExprStmt',
      expr: {
        kind: 'CallExpr',
        callee: 'beside',
        args: [
          { kind: 'CallExpr', callee: 'square', args: [], block: null },
          { kind: 'CallExpr', callee: 'square', args: [], block: null },
        ],
        block: null,
      },
    },
  ],
};

export const expectedText = `def square
  repeat 4 do
    forward(100)
    turn(90)
  end
end

beside(square(), square())`;
