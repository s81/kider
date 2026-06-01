// Fixture 1: Square — repeat 4 do forward(100); turn(90) end
import type { Program } from '@sprout/lang';

export const program: Program = {
  kind: 'Program',
  stmts: [
    {
      kind: 'ExprStmt',
      expr: {
        kind: 'RepeatExpr',
        count: { kind: 'NumberLit', value: 4 },
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
  ],
};

export const expectedText = `repeat 4 do
  forward(100)
  turn(90)
end`;
