# For-Each Loop Design Spec

## Goal

Add a `for each item in list do...end` loop to Sprout so kids can iterate over lists naturally, enabling patterns like drawing a shape for each item in a list.

## Architecture

New `ForEachExpr` AST node — not desugared to a function call — to keep semantics clean, avoid index variable leakage, and produce a clear display in the text panel. Five-layer feature: AST, interpreter, serializer, parser, blocks.

---

## Section 1: AST + Semantics

### AST node

New interface added to `packages/lang/src/ast.ts`:

```typescript
/** `for each <item> in <list> do ... end` */
export interface ForEachExpr {
  readonly kind: 'ForEachExpr';
  readonly item: string;       // iteration variable name
  readonly list: Expr;         // must evaluate to a SproutList
  readonly body: BlockExpr;
}
```

Added to the `Expr` union:

```typescript
export type Expr =
  | NumberLit
  | StringLit
  | SymbolLit
  | BoolLit
  | Ident
  | InfixExpr
  | UnaryExpr
  | CallExpr
  | BlockExpr
  | RepeatExpr
  | OnExpr
  | IfExpr
  | WhileExpr
  | ForEachExpr;  // NEW
```

Also export `ForEachExpr` from `packages/lang/src/index.ts` alongside the other AST type exports.

### Interpreter semantics

```
for each x in expr do body end
```

1. Evaluate `expr` — must be a `SproutList`; throw `"for each: expected list, got <kind>"` otherwise
2. For each item in `list.items` (in order):
   - Create child env with `item` name bound to the current element
   - Evaluate `body` in child env
   - Collect the resulting Drawing
3. Return `mkSequence(drawings)` if any iterations ran, else `EMPTY`
4. `item` binding is scoped to the body — does not leak into the outer env after the loop

`ReturnSignal` propagates naturally through `evalBlock` (already handles it).

### `evalForEach` function (in interpreter.ts)

```typescript
function evalForEach(expr: ForEachExpr, env: Env): Drawing {
  const listVal = evalExpr(expr.list, env);
  if (listVal.kind !== 'list') {
    throw new SproutRuntimeError(`for each: expected list, got ${listVal.kind}`);
  }
  const drawings: Drawing[] = [];
  for (const item of listVal.items) {
    const childEnv = envExtend(env, [[expr.item, item]]);
    drawings.push(evalBlock(expr.body, childEnv));
  }
  return drawings.length === 0 ? EMPTY : mkSequence(drawings);
}
```

Add `case 'ForEachExpr': return evalForEach(expr, env);` to the main `evalExpr` switch.

Add `ForEachExpr` import to interpreter.ts.

Also add to `collectInputNames` walker (`walkExpr` switch) so `input()` calls inside for-each bodies are discovered:

```typescript
case 'ForEachExpr':
  walkExpr(expr.list); walkBlock(expr.body);
  break;
```

---

## Section 2: Serializer

New case in `serializeExpr` in `packages/lang/src/serializer.ts`:

```typescript
case 'ForEachExpr': {
  const listStr = serializeExpr(expr.list, indentLevel);
  const body = serializeBlock(expr.body, indentLevel + 1);
  return `for each ${expr.item} in ${listStr} do\n${body}\n${indent(indentLevel)}end`;
}
```

Add `ForEachExpr` to the import in serializer.ts.

Example output (indentLevel 0):
```
for each x in list(1, 2, 3) do
  forward(x)
end
```

---

## Section 3: Parser

**File:** `packages/parser/src/parser.ts`

Add import of `ForEachExpr` type:

```typescript
import type {
  Program, Stmt, Expr, DefStmt,
  BlockExpr, RepeatExpr, OnExpr, CallExpr, IfExpr, UnaryExpr,
  LetStmt, AssignStmt, WhileExpr, ForEachExpr,
} from '@sprout/lang';
```

Add case in `parseAtom` immediately before the generic `this.advance()` at the end of the IDENT block:

```typescript
if (name === 'for') {
  this.advance();
  this.eatIdent('each');
  const itemTok = this.eat('IDENT') as { kind: 'IDENT'; name: string };
  this.eatIdent('in');
  const list = this.parseExpr();
  const body = this.parseDoBlock();
  return { kind: 'ForEachExpr', item: itemTok.name, list, body } satisfies ForEachExpr;
}
```

`for`, `each`, and `in` are all lexed as `IDENT` tokens — no lexer changes needed.

`parseDoBlock()` already parses `do ... end`, so nesting is handled correctly.

---

## Section 4: Block + Compiler

### Block definition

In `packages/blocks/src/definitions/statements.ts` (alongside `while`, `repeat`), colour **120** (green):

```typescript
Blockly.Blocks['sprout_for_each'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('for each')
      .appendField(new Blockly.FieldTextInput('item'), 'ITEM')
      .appendField('in');
    this.appendValueInput('LIST');
    this.appendStatementInput('BODY').appendField('do');
    this.setNextStatement(true, null);
    this.setPreviousStatement(true, null);
    this.setInputsInline(true);
    this.setColour(120);
  },
};
```

### Compiler case

Two changes to `packages/blocks/src/compiler.ts`:

**1.** In `compileStmt`, add `case 'sprout_for_each':` to the fall-through list alongside `sprout_while`, `sprout_repeat`, etc.:

```typescript
case 'sprout_for_each':
// ... (other cases)
  return { kind: 'ExprStmt', expr: compileExprBlock(block) };
```

**2.** In `compileExprBlock`, add a dedicated case before `default: throw`:

```typescript
case 'sprout_for_each':
  return compileForEachExpr(block);
```

**3.** Add a new `compileForEachExpr` function (alongside `compileRepeatExpr`, `compileOnExpr`):

```typescript
function compileForEachExpr(block: Blockly.Block): ForEachExpr {
  const item = block.getFieldValue('ITEM') as string;
  const listBlock = block.getInputTargetBlock('LIST');
  const list = listBlock
    ? compileExpr(listBlock)
    : { kind: 'CallExpr' as const, callee: 'list', args: [], block: null };
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileBlockExpr(firstBodyBlock);
  return { kind: 'ForEachExpr', item, list, body };
}
```

Also import `ForEachExpr` type in compiler.ts.

Add `sprout_for_each` to the toolbox in `apps/ide/src/BlockWorkspace.tsx`, in the loops/control section near `sprout_repeat` and `sprout_while`:

```typescript
{ kind: 'block', type: 'sprout_for_each' },
```

---

## Section 5: Exports

Export `ForEachExpr` type from `packages/lang/src/index.ts`:

```typescript
export type {
  // AST nodes
  ...
  ForEachExpr,  // NEW
  ...
} from './ast.js';
```

---

## Section 6: Tests

### Lang — interpreter tests

In `packages/lang/tests/interpreter.test.ts`, add after the `describe('stamp builtin')` block.

**Builder helpers to add** (alongside the existing `whileExpr`, `ifExpr`, etc.):

```typescript
const forEachExpr = (item: string, list: Expr, body: Stmt[]): ForEachExpr => ({
  kind: 'ForEachExpr',
  item,
  list,
  body: { kind: 'BlockExpr', body },
});
```

Add `ForEachExpr` to the existing type import from `'../src/ast.js'`:
```typescript
import type { Program, Expr, Stmt, InfixExpr, LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '../src/ast.js';
```

**Tests** (`program` takes rest params, `numLit` for numbers, `ident` is already defined):

```typescript
describe('for each loop', () => {
  it('empty list produces EMPTY drawing', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', []), [
        exprStmt(call('forward', [numLit(10)])),
      ])),
    );
    expect(interpretFull(prog).drawing).toEqual(EMPTY);
  });

  it('single-item list runs body once', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', [numLit(50)]), [
        exprStmt(call('forward', [ident('x')])),
      ])),
    );
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkForward(50)]));
  });

  it('multi-item list runs body N times', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', [numLit(10), numLit(20), numLit(30)]), [
        exprStmt(call('forward', [ident('x')])),
      ])),
    );
    expect(interpretFull(prog).drawing).toEqual(
      mkSequence([mkForward(10), mkForward(20), mkForward(30)])
    );
  });

  it('throws on non-list', () => {
    const prog = program(
      exprStmt(forEachExpr('x', numLit(42), [])),
    );
    expect(() => interpretFull(prog)).toThrow('for each: expected list, got number');
  });

  it('item variable is in scope inside body', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', [numLit(7)]), [
        exprStmt(call('forward', [ident('x')])),
      ])),
    );
    expect(interpretFull(prog).drawing).toEqual(mkSequence([mkForward(7)]));
  });

  it('item variable does not leak out of loop', () => {
    const prog = program(
      exprStmt(forEachExpr('x', call('list', [numLit(1)]), [])),
      exprStmt(ident('x')),
    );
    expect(() => interpretFull(prog)).toThrow();
  });
});
```

`mkForward` and `EMPTY` are already in the interpreter test imports.

### Lang — serializer tests

In `packages/lang/tests/serializer.test.ts`, add a `forEachExpr` builder alongside the existing helpers:

```typescript
const forEachExpr = (item: string, list: Expr, body: Stmt[]): Expr => ({
  kind: 'ForEachExpr',
  item,
  list,
  body: { kind: 'BlockExpr', body },
} as Expr);
```

Add `ForEachExpr` to the type import from `'../src/ast.js'`:
```typescript
import type { ..., ForEachExpr } from '../src/ast.js';
```

```typescript
describe('ForEachExpr serialization', () => {
  it('serializes for each loop', () => {
    const expr = forEachExpr('x', call('list', [numLit(1), numLit(2)]), [
      exprStmt(call('forward', [ident('x')])),
    ]);
    expect(serializeExpr(expr)).toBe(
      'for each x in list(1, 2) do\n  forward(x)\nend'
    );
  });
});
```

### Parser — parser tests

In `packages/parser/tests/parser.test.ts`, add a `forEachE` builder and two tests.

Add to the existing type import line at the top:
```typescript
import type { Program, LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '@sprout/lang';
```

Add builder:
```typescript
const forEachE = (item: string, list: object, body: object[]): ForEachExpr => ({
  kind: 'ForEachExpr' as const,
  item,
  list: list as never,
  body: blockE(body) as never,
});
```

Tests:
```typescript
describe('for each loop', () => {
  it('parses for each with ident list', () => {
    expect(parse('for each x in myList do\n  forward(x)\nend')).toEqual(
      prog(exprS(forEachE('x', id('myList'), [exprS(callE('forward', [id('x')]))])))
    );
  });

  it('parses for each with list() call', () => {
    const result = parse('for each item in list(1, 2, 3) do\n  stamp()\nend');
    const expr = (result.stmts[0] as { expr: ForEachExpr }).expr;
    expect(expr.kind).toBe('ForEachExpr');
    expect(expr.item).toBe('item');
    expect(expr.list).toEqual(callE('list', [num(1), num(2), num(3)]));
  });
});
```

### Blocks — compiler tests

In `packages/blocks/tests/compiler.test.ts`, add:

```typescript
describe('for each block', () => {
  it('sprout_for_each compiles to ForEachExpr', () => {
    const ws = makeWorkspace();
    const forEachBlock = ws.newBlock('sprout_for_each');
    forEachBlock.setFieldValue('myItem', 'ITEM');
    const listBlock = ws.newBlock('sprout_list');
    forEachBlock.getInput('LIST')!.connection!.connect(listBlock.outputConnection!);
    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'ExprStmt',
      expr: {
        kind: 'ForEachExpr',
        item: 'myItem',
        list: { kind: 'CallExpr', callee: 'list', args: [], block: null },
        body: { kind: 'BlockExpr', body: [] },
      },
    });
  });
});
```

---

## What's not in scope

- `break` / `continue` inside for-each
- Indexed iteration (no `for i, x in list`)
- Nested for-each loops (supported by design — just not tested in this spec)
- Mutation of the list while iterating
