// Fixture 2: Polygon — parameterized function with 6 sides and size 80
import type { Program } from '@sprout/lang';

export const program: Program = {
  kind: 'Program',
  stmts: [
    {
      kind: 'DefStmt',
      name: 'polygon',
      params: ['sides', 'size'],
      body: {
        kind: 'RepeatExpr',
        count: { kind: 'Ident', name: 'sides' },
        item: null,
        body: {
          kind: 'BlockExpr',
          body: [
            {
              kind: 'ExprStmt',
              expr: {
                kind: 'CallExpr',
                callee: 'forward',
                args: [{ kind: 'Ident', name: 'size' }],
                block: null,
              },
            },
            {
              kind: 'ExprStmt',
              expr: {
                kind: 'CallExpr',
                callee: 'turn',
                args: [
                  {
                    kind: 'InfixExpr',
                    op: '/',
                    left: { kind: 'NumberLit', value: 360 },
                    right: { kind: 'Ident', name: 'sides' },
                  },
                ],
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
        callee: 'polygon',
        args: [
          { kind: 'NumberLit', value: 6 },
          { kind: 'NumberLit', value: 80 },
        ],
        block: null,
      },
    },
  ],
};

export const expectedText = `def polygon(sides, size)
  repeat sides do
    forward(size)
    turn(360 / sides)
  end
end

polygon(6, 80)`;
