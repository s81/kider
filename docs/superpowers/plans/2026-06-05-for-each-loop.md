# For-Each Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `for each item in list do...end` to Sprout — a loop that iterates over a `SproutList`, binding each element to a variable inside the body.

**Architecture:** Four layers touched in three tasks: (1) `packages/lang` — AST node, interpreter eval function, serializer case, index export; (2) `packages/parser` — text-mode parsing for `for each x in expr do...end`; (3) `packages/blocks` — `sprout_for_each` Blockly block + compiler case + toolbox entry. The `ForEachExpr` node is an `Expr` (not a `Stmt`), following the same pattern as `WhileExpr` and `RepeatExpr`.

**Tech Stack:** TypeScript, Vitest (`bun test`), Blockly 10, Vite + React

---

### Task 1: Lang layer — AST + Interpreter + Serializer + Index

**Files:**
- Modify: `packages/lang/src/ast.ts`
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/src/serializer.ts`
- Modify: `packages/lang/src/index.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`
- Modify: `packages/lang/tests/serializer.test.ts`

**Background:** `SproutList` is already implemented (`{ kind: 'list'; items: readonly SproutValue[] }`). The interpreter eval loop is in `evalExpr` in `interpreter.ts`. The `collectInputNames` walker (`walkExpr` inside) must be updated so `input()` calls inside for-each bodies are discovered. The serializer exhaustiveness check (`const _never: never = expr`) means `ForEachExpr` must be added to both the union AND the serializer case in the same commit.

- [ ] **Step 1: Write the failing interpreter tests**

In `packages/lang/tests/interpreter.test.ts`, add `ForEachExpr` to the existing type import at line 23:

```typescript
import type { Program, Expr, Stmt, InfixExpr, LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '../src/ast.js';
```

Add this builder helper alongside the existing `whileExpr` helper (after line ~61):

```typescript
const forEachExpr = (item: string, list: Expr, body: Stmt[]): ForEachExpr => ({
  kind: 'ForEachExpr',
  item,
  list,
  body: { kind: 'BlockExpr', body },
});
```

Add this describe block at the end of the file:

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

Note: `program`, `exprStmt`, `call`, `numLit`, `ident`, `mkForward`, `mkSequence`, `EMPTY`, `interpretFull` are already in scope in this file.

- [ ] **Step 2: Write the failing serializer test**

In `packages/lang/tests/serializer.test.ts`, add `ForEachExpr` to the existing type import from `'../src/ast.js'`:

```typescript
import type { Program, Expr, Stmt, InfixExpr, LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '../src/ast.js';
```

Add a builder helper alongside the existing helpers (after `whileE` or `onExpr`):

```typescript
const forEachE = (item: string, list: Expr, body: Stmt[]): Expr =>
  ({ kind: 'ForEachExpr', item, list, body: { kind: 'BlockExpr', body } } as unknown as Expr);
```

Add this describe block at the end of the serializer test file:

```typescript
describe('ForEachExpr', () => {
  it('serializes for each loop', () => {
    const expr = forEachE('x', call('list', [numLit(1), numLit(2)]), [
      exprStmt(call('forward', [ident('x')])),
    ]);
    expect(serializeExpr(expr)).toBe(
      'for each x in list(1, 2) do\n  forward(x)\nend'
    );
  });
});
```

Note: `call`, `numLit`, `ident`, `exprStmt`, `serializeExpr` are already in scope in `serializer.test.ts`.

- [ ] **Step 3: Run tests to verify they fail**

```
bun test packages/lang
```

Expected: failures — `ForEachExpr` not imported, `forEachExpr` builder references unknown type.

- [ ] **Step 4: Add `ForEachExpr` to `ast.ts`**

In `packages/lang/src/ast.ts`, add this interface after the `WhileExpr` interface (after line ~105):

```typescript
/** `for each <item> in <list> do ... end` */
export interface ForEachExpr {
  readonly kind: 'ForEachExpr';
  readonly item: string;
  readonly list: Expr;
  readonly body: BlockExpr;
}
```

Add `ForEachExpr` to the `Expr` union (replacing the existing union definition):

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
  | ForEachExpr;
```

- [ ] **Step 5: Add `ForEachExpr` to `interpreter.ts`**

**5a — Add to import.** In `packages/lang/src/interpreter.ts`, add `ForEachExpr` to the type import from `'./ast.js'` (currently ends with `WhileExpr`):

```typescript
import type {
  Program,
  Stmt,
  Expr,
  DefStmt,
  ExprStmt,
  LetStmt,
  AssignStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
  InfixExpr,
  UnaryExpr,
  CallExpr,
  BlockExpr,
  RepeatExpr,
  OnExpr,
  IfExpr,
  WhileExpr,
  ForEachExpr,
} from './ast.js';
```

**5b — Add eval case.** In `evalExpr`, add this case immediately before `case 'WhileExpr':` (so it sits with the other loop forms):

```typescript
    // --- For-each loop ---
    case 'ForEachExpr':
      return evalForEach(expr, env);
```

**5c — Add `evalForEach` function.** Add this function immediately after `evalWhile` (around line 722):

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

**5d — Add to `collectInputNames` walker.** In the `walkExpr` switch inside `collectInputNames`, add this case immediately after `case 'WhileExpr':`:

```typescript
      case 'ForEachExpr':
        walkExpr(expr.list); walkBlock(expr.body);
        break;
```

- [ ] **Step 6: Add `ForEachExpr` case to `serializer.ts`**

**6a — Add to import.** In `packages/lang/src/serializer.ts`, add `ForEachExpr` to the existing import from `'./ast.js'`:

```typescript
import type { Program, Expr, Stmt, BlockExpr, ForEachExpr } from './ast.js';
```

**6b — Add case.** In `serializeExpr`, add this case immediately before `default:`:

```typescript
    case 'ForEachExpr': {
      const listStr = serializeExpr(expr.list, indentLevel);
      const body = serializeBlock(expr.body, indentLevel + 1);
      return `for each ${expr.item} in ${listStr} do\n${body}\n${indent(indentLevel)}end`;
    }
```

- [ ] **Step 7: Export `ForEachExpr` from `index.ts`**

In `packages/lang/src/index.ts`, add `ForEachExpr` to the AST type exports block (alongside `WhileExpr`):

```typescript
export type {
  // AST nodes
  Program,
  DefStmt,
  ExprStmt,
  LetStmt,
  AssignStmt,
  NumberLit,
  StringLit,
  SymbolLit,
  BoolLit,
  Ident,
  CallExpr,
  BlockExpr,
  InfixExpr,
  UnaryExpr,
  RepeatExpr,
  OnExpr,
  IfExpr,
  WhileExpr,
  ForEachExpr,  // NEW
  // Unions
  Expr,
  Stmt,
  Node,
} from './ast.js';
```

- [ ] **Step 8: Run tests to verify they pass**

```
bun test packages/lang
```

Expected: all tests pass. Total count should be ~510+ (503 existing + 6 interpreter + 1 serializer = 510).

- [ ] **Step 9: Commit**

```bash
git add packages/lang/src/ast.ts packages/lang/src/interpreter.ts packages/lang/src/serializer.ts packages/lang/src/index.ts packages/lang/tests/interpreter.test.ts packages/lang/tests/serializer.test.ts
git commit -m "feat(lang): add ForEachExpr AST node, interpreter eval, and serializer"
```

---

### Task 2: Parser — `for each x in expr do...end`

**Files:**
- Modify: `packages/parser/src/parser.ts`
- Modify: `packages/parser/tests/parser.test.ts`

**Background:** The parser is in `packages/parser` (separate package from `packages/lang`). It imports AST types from `@sprout/lang`. The lexer tokenises `for`, `each`, and `in` as `IDENT` tokens — no lexer changes needed. `parseDoBlock()` already parses `do ... end`. The `parseAtom` method handles keyword-like identifiers (`if`, `repeat`, `while`, `on`) by checking `name` before the generic `this.advance()`.

- [ ] **Step 1: Write the failing parser tests**

In `packages/parser/tests/parser.test.ts`, add `ForEachExpr` to the existing type import (currently line 4):

```typescript
import type { Program, LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '@sprout/lang';
```

Add a builder helper alongside the existing builders:

```typescript
const forEachE = (item: string, list: object, body: object[]): ForEachExpr => ({
  kind: 'ForEachExpr' as const,
  item,
  list: list as never,
  body: blockE(body) as never,
});
```

Add this describe block at the end of the parser test file:

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

Note: `prog`, `exprS`, `callE`, `id`, `num`, `blockE` are already in scope in `parser.test.ts`.

- [ ] **Step 2: Run tests to verify they fail**

```
bun test packages/parser
```

Expected: 2 new tests fail — `forEachE` unknown, `parse('for each...')` throws `Unexpected token`.

- [ ] **Step 3: Add `ForEachExpr` to parser**

**3a — Add to import.** In `packages/parser/src/parser.ts`, add `ForEachExpr` to the type import from `@sprout/lang` (currently line 2–7):

```typescript
import type {
  Program, Stmt, Expr, DefStmt,
  BlockExpr, RepeatExpr, OnExpr, CallExpr, IfExpr, UnaryExpr,
  LetStmt, AssignStmt, WhileExpr, ForEachExpr,
} from '@sprout/lang';
```

**3b — Add `for` case.** In `parseAtom`, inside the `if (t.kind === 'IDENT')` block, add this case immediately after the `name === 'on'` block (around line 258) and **before** the generic `this.advance()` call (line 262):

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

- [ ] **Step 4: Run tests to verify they pass**

```
bun test packages/parser
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/parser/src/parser.ts packages/parser/tests/parser.test.ts
git commit -m "feat(parser): add for each loop parsing"
```

---

### Task 3: Blocks layer — `sprout_for_each` block + compiler + toolbox

**Files:**
- Modify: `packages/blocks/src/definitions/variables.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `apps/ide/src/BlockWorkspace.tsx`
- Modify: `packages/blocks/tests/compiler.test.ts`

**Background:** `sprout_while` (the closest sibling) lives in `packages/blocks/src/definitions/variables.ts` alongside `sprout_let` and `sprout_set`. The compiler pattern for loop blocks: (1) add to the fall-through in `compileStmt` so it wraps in `ExprStmt`, (2) add a dedicated case in `compileExprBlock`, (3) add a helper function. The `BODY` input is a StatementInput — use `getInputTargetBlock('BODY')` → `compileBlockExpr(...)`. The `LIST` input is a ValueInput — use `getInputTargetBlock('LIST')` → `compileExpr(...)`.

- [ ] **Step 1: Write the failing compiler test**

In `packages/blocks/tests/compiler.test.ts`, update line 5 to add `ForEachExpr`:

```typescript
import type { LetStmt, AssignStmt, WhileExpr, ForEachExpr } from '@sprout/lang';
```

Add this describe block at the end of the file (after the `describe('stamp block')` block):

```typescript
describe('for each block', () => {
  it('sprout_for_each compiles to ExprStmt wrapping ForEachExpr', () => {
    const ws = makeWorkspace();
    const forEachBlock = ws.newBlock('sprout_for_each');
    forEachBlock.setFieldValue('myItem', 'ITEM');

    const listBlock = ws.newBlock('sprout_list');
    forEachBlock.getInput('LIST')!.connection!.connect(listBlock.outputConnection!);

    const fwdBlock = ws.newBlock('sprout_forward');
    const distBlock = ws.newBlock('sprout_number');
    distBlock.setFieldValue('10', 'NUM');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(distBlock.outputConnection!);
    forEachBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);

    const result = compileWorkspace(ws);
    const expected: ForEachExpr = {
      kind: 'ForEachExpr',
      item: 'myItem',
      list: { kind: 'CallExpr', callee: 'list', args: [], block: null },
      body: {
        kind: 'BlockExpr',
        body: [{
          kind: 'ExprStmt',
          expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 10 }], block: null },
        }],
      },
    };
    expect(result).toEqual({ kind: 'Program', stmts: [{ kind: 'ExprStmt', expr: expected }] });
    ws.dispose();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
bun test packages/blocks
```

Expected: 1 new test fails — `sprout_for_each` block not registered.

- [ ] **Step 3: Add `sprout_for_each` block to `variables.ts`**

In `packages/blocks/src/definitions/variables.ts`, add this block definition inside `registerVariableBlocks()`, immediately after the `sprout_while` block (before the closing `}`):

```typescript
  Blockly.Blocks['sprout_for_each'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('for each')
        .appendField(new Blockly.FieldTextInput('item') as unknown as Blockly.Field, 'ITEM')
        .appendField('in');
      this.appendValueInput('LIST');
      this.appendStatementInput('BODY').appendField('do');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setInputsInline(true);
      this.setColour(120);
    },
  };
```

- [ ] **Step 4: Add compiler support to `compiler.ts`**

**4a — Add import.** In `packages/blocks/src/compiler.ts`, add `ForEachExpr` to the type import from `@sprout/lang` (line 2–8):

```typescript
import type {
  Program, Stmt, Expr,
  DefStmt, ExprStmt,
  LetStmt, AssignStmt, ReturnStmt,
  NumberLit, Ident, InfixExpr, UnaryExpr, CallExpr,
  BlockExpr, RepeatExpr, OnExpr, IfExpr, WhileExpr, ForEachExpr, SymbolLit, BoolLit, StringLit,
} from '@sprout/lang';
```

**4b — Add to `compileStmt` fall-through.** In `compileStmt`, add `case 'sprout_for_each':` to the fall-through list. The current list ends with `case 'sprout_text':` before `return { kind: 'ExprStmt', expr: compileExprBlock(block) }`. Add it alongside `sprout_while`:

```typescript
    case 'sprout_while':
    case 'sprout_for_each':
```

So the full block becomes:

```typescript
    case 'sprout_repeat':
    case 'sprout_on_event':
    case 'sprout_call_stmt':
    case 'sprout_beside':
    case 'sprout_above':
    case 'sprout_scale':
    case 'sprout_if':
    case 'sprout_while':
    case 'sprout_for_each':
    case 'sprout_circle':
    // ... (rest unchanged)
      return { kind: 'ExprStmt', expr: compileExprBlock(block) };
```

**4c — Add case to `compileExprBlock`.** In the switch inside `compileExprBlock`, add this case immediately before `default: throw`:

```typescript
    case 'sprout_for_each':
      return compileForEachExpr(block);
```

**4d — Add `compileForEachExpr` function.** Add this function immediately after `compileOnExpr` (around line 244):

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

- [ ] **Step 5: Add `sprout_for_each` to toolbox in `BlockWorkspace.tsx`**

In `apps/ide/src/BlockWorkspace.tsx`, in the `// Control` section, add `sprout_for_each` after `sprout_while`:

```typescript
    { kind: 'block', type: 'sprout_while' },
    { kind: 'block', type: 'sprout_for_each' },
```

- [ ] **Step 6: Run all tests**

```
bun test
```

Expected: all tests pass. Total count should be ~511+ (510 + 1 new compiler test = 511).

- [ ] **Step 7: Commit**

```bash
git add packages/blocks/src/definitions/variables.ts packages/blocks/src/compiler.ts apps/ide/src/BlockWorkspace.tsx packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add sprout_for_each block and compiler case"
```
