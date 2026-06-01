// Fixture 5: Click event handler — on :click do forward(20); turn(15) end
import type { Program } from '@sprout/lang';

export const program: Program = {
  kind: 'Program',
  stmts: [
    {
      kind: 'ExprStmt',
      expr: {
        kind: 'OnExpr',
        event: { kind: 'SymbolLit', name: 'click' },
        body: {
          kind: 'BlockExpr',
          body: [
            {
              kind: 'ExprStmt',
              expr: {
                kind: 'CallExpr',
                callee: 'forward',
                args: [{ kind: 'NumberLit', value: 20 }],
                block: null,
              },
            },
            {
              kind: 'ExprStmt',
              expr: {
                kind: 'CallExpr',
                callee: 'turn',
                args: [{ kind: 'NumberLit', value: 15 }],
                block: null,
              },
            },
          ],
        },
      },
    },
  ],
};

export const expectedText = `on :click do
  forward(20)
  turn(15)
end`;
