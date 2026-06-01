// Fixture 4: Repeat loop — 8 sides at 45 degrees each (octagon walk)
import type { Program } from '@sprout/lang';

export const program: Program = {
  kind: 'Program',
  stmts: [
    {
      kind: 'ExprStmt',
      expr: {
        kind: 'RepeatExpr',
        count: { kind: 'NumberLit', value: 8 },
        body: {
          kind: 'BlockExpr',
          body: [
            {
              kind: 'ExprStmt',
              expr: {
                kind: 'CallExpr',
                callee: 'forward',
                args: [{ kind: 'NumberLit', value: 60 }],
                block: null,
              },
            },
            {
              kind: 'ExprStmt',
              expr: {
                kind: 'CallExpr',
                callee: 'turn',
                args: [{ kind: 'NumberLit', value: 45 }],
                block: null,
              },
            },
          ],
        },
      },
    },
  ],
};

export const expectedText = `repeat 8 do
  forward(60)
  turn(45)
end`;
