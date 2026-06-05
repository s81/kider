# String Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `join(...)`, `length(str)`, polymorphic `+` (string concat), and string `==` to Sprout so users can build dynamic text like `text("Score: " + score, 20)`.

**Architecture:** All language changes live in `interpreter.ts` — a new `toStr` helper, updated `evalInfix` for `+` and `==`, and two new BUILTINS entries. Block changes add three new reporter blocks in `values.ts`, three compiler cases, and a Text section in the toolbox.

**Tech Stack:** TypeScript, Vitest, Blockly 10, pnpm monorepo (`@sprout/lang`, `@sprout/blocks`, `@sprout/ide`)

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/interpreter.ts` | Add `toStr` helper; update `+` and `==` in `evalInfix`; add `join` and `length` builtins |
| `packages/lang/tests/interpreter.test.ts` | Add 4 describe blocks for new string behavior |
| `packages/blocks/src/definitions/values.ts` | Add `sprout_string`, `sprout_join`, `sprout_length` inside `registerValueBlocks` |
| `packages/blocks/src/compiler.ts` | Add 3 cases to `compileExprBlock` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('string blocks')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add Text section to TOOLBOX constant |

---

### Task 1: `toStr` helper + polymorphic `+` + string `==`

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Test: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/lang/tests/interpreter.test.ts`, append after the last `describe` block at the end of the file:

```typescript
// ---------------------------------------------------------------------------
// String + operator
// ---------------------------------------------------------------------------
describe('+ with strings', () => {
  it('"a" + "b" concatenates to "ab"', () => {
    const prog = program(exprStmt(call('text', [infix('+', strLit('a'), strLit('b')), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('ab', 20)]));
  });

  it('"Score: " + 42 concatenates to "Score: 42"', () => {
    const prog = program(exprStmt(call('text', [infix('+', strLit('Score: '), numLit(42)), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('Score: 42', 20)]));
  });

  it('42 + " pts" concatenates to "42 pts"', () => {
    const prog = program(exprStmt(call('text', [infix('+', numLit(42), strLit(' pts')), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('42 pts', 20)]));
  });

  it('3 + 4 still adds numbers', () => {
    const prog = program(exprStmt(call('forward', [infix('+', numLit(3), numLit(4))])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(7)]));
  });

  it('"x" + true concatenates to "xtrue"', () => {
    const prog = program(exprStmt(call('text', [infix('+', strLit('x'), boolLit(true)), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('xtrue', 20)]));
  });
});

// ---------------------------------------------------------------------------
// String == operator
// ---------------------------------------------------------------------------
describe('== for strings', () => {
  it('"hello" == "hello" is true', () => {
    const prog = program(exprStmt(ifExpr(
      infix('==', strLit('hello'), strLit('hello')),
      [exprStmt(call('forward', [numLit(1)]))]
    )));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(1)]));
  });

  it('"hello" == "world" is false', () => {
    const prog = program(exprStmt(ifExpr(
      infix('==', strLit('hello'), strLit('world')),
      [exprStmt(call('forward', [numLit(1)]))]
    )));
    expect(interpret(prog)).toEqual(EMPTY);
  });

  it('"hello" != "world" is true', () => {
    const prog = program(exprStmt(ifExpr(
      infix('!=', strLit('hello'), strLit('world')),
      [exprStmt(call('forward', [numLit(1)]))]
    )));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(1)]));
  });

  it('"hello" == 42 throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(ifExpr(
      infix('==', strLit('hello'), numLit(42)),
      [exprStmt(call('forward', [numLit(1)]))]
    ))));
    expect(fn).toThrow(SproutRuntimeError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: FAIL — `+` with strings throws because `assertNumber` rejects string args; `==` throws for strings.

- [ ] **Step 3: Add `toStr` helper to `interpreter.ts`**

In `packages/lang/src/interpreter.ts`, insert the following helper function immediately before the `evalInfix` function (currently at line 459):

```typescript
function toStr(v: SproutValue, context: string): string {
  if (v.kind === 'string') return v.value;
  if (v.kind === 'number') return String(v.value);
  if (v.kind === 'bool') return String(v.value);
  if (v.kind === 'symbol') return `:${v.name}`;
  throw new SproutRuntimeError(`${context}: cannot convert ${v.kind} to string`);
}
```

- [ ] **Step 4: Update `evalInfix` — `==`/`!=` block to support strings**

In `packages/lang/src/interpreter.ts`, find the `==`/`!=` block inside `evalInfix` (lines 477–489). Replace this:

```typescript
  // == and != work on numbers or bools (same kind required)
  if (expr.op === '==' || expr.op === '!=') {
    const lv = evalExpr(expr.left, env);
    const rv = evalExpr(expr.right, env);
    let eq: boolean;
    if (lv.kind === 'number' && rv.kind === 'number') {
      eq = lv.value === rv.value;
    } else if (lv.kind === 'bool' && rv.kind === 'bool') {
      eq = lv.value === rv.value;
    } else {
      throw new SproutRuntimeError(`${expr.op}: cannot compare ${lv.kind} and ${rv.kind}`);
    }
    return { kind: 'bool', value: expr.op === '==' ? eq : !eq };
  }
```

With this:

```typescript
  // == and != work on numbers, bools, or strings (same kind required)
  if (expr.op === '==' || expr.op === '!=') {
    const lv = evalExpr(expr.left, env);
    const rv = evalExpr(expr.right, env);
    let eq: boolean;
    if (lv.kind === 'number' && rv.kind === 'number') {
      eq = lv.value === rv.value;
    } else if (lv.kind === 'bool' && rv.kind === 'bool') {
      eq = lv.value === rv.value;
    } else if (lv.kind === 'string' && rv.kind === 'string') {
      eq = lv.value === rv.value;
    } else {
      throw new SproutRuntimeError(`${expr.op}: cannot compare ${lv.kind} and ${rv.kind}`);
    }
    return { kind: 'bool', value: expr.op === '==' ? eq : !eq };
  }
```

- [ ] **Step 5: Update `evalInfix` — replace the arithmetic block for polymorphic `+`**

In `packages/lang/src/interpreter.ts`, find the arithmetic block starting with the comment `// Arithmetic and numeric comparisons` (lines 491–505). Replace this entire block:

```typescript
  // Arithmetic and numeric comparisons
  const left = assertNumber(evalExpr(expr.left, env), `(${expr.op}) left operand`);
  const right = assertNumber(evalExpr(expr.right, env), `(${expr.op}) right operand`);
  switch (expr.op) {
    case '+':  return { kind: 'number', value: left.value + right.value };
    case '-':  return { kind: 'number', value: left.value - right.value };
    case '*':  return { kind: 'number', value: left.value * right.value };
    case '/':
      if (right.value === 0) throw new SproutRuntimeError('Division by zero');
      return { kind: 'number', value: left.value / right.value };
    case '<':  return { kind: 'bool', value: left.value <  right.value };
    case '>':  return { kind: 'bool', value: left.value >  right.value };
    case '<=': return { kind: 'bool', value: left.value <= right.value };
    case '>=': return { kind: 'bool', value: left.value >= right.value };
  }
```

With this:

```typescript
  // Arithmetic and numeric comparisons — + is polymorphic (string concat or numeric add)
  const leftVal = evalExpr(expr.left, env);
  const rightVal = evalExpr(expr.right, env);
  switch (expr.op) {
    case '+': {
      if (leftVal.kind === 'number' && rightVal.kind === 'number') {
        return { kind: 'number', value: leftVal.value + rightVal.value };
      }
      if (leftVal.kind === 'string' || rightVal.kind === 'string') {
        return { kind: 'string', value: toStr(leftVal, '+') + toStr(rightVal, '+') };
      }
      throw new SproutRuntimeError(`+: cannot add ${leftVal.kind} and ${rightVal.kind}`);
    }
    case '-': {
      const left = assertNumber(leftVal, '(-) left operand');
      const right = assertNumber(rightVal, '(-) right operand');
      return { kind: 'number', value: left.value - right.value };
    }
    case '*': {
      const left = assertNumber(leftVal, '(*) left operand');
      const right = assertNumber(rightVal, '(*) right operand');
      return { kind: 'number', value: left.value * right.value };
    }
    case '/': {
      const left = assertNumber(leftVal, '(/) left operand');
      const right = assertNumber(rightVal, '(/) right operand');
      if (right.value === 0) throw new SproutRuntimeError('Division by zero');
      return { kind: 'number', value: left.value / right.value };
    }
    case '<': {
      const left = assertNumber(leftVal, '(<) left operand');
      const right = assertNumber(rightVal, '(<) right operand');
      return { kind: 'bool', value: left.value < right.value };
    }
    case '>': {
      const left = assertNumber(leftVal, '(>) left operand');
      const right = assertNumber(rightVal, '(>) right operand');
      return { kind: 'bool', value: left.value > right.value };
    }
    case '<=': {
      const left = assertNumber(leftVal, '(<=) left operand');
      const right = assertNumber(rightVal, '(<=) right operand');
      return { kind: 'bool', value: left.value <= right.value };
    }
    case '>=': {
      const left = assertNumber(leftVal, '(>=) left operand');
      const right = assertNumber(rightVal, '(>=) right operand');
      return { kind: 'bool', value: left.value >= right.value };
    }
  }
```

- [ ] **Step 6: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: All interpreter tests PASS (285+ tests).

- [ ] **Step 7: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add toStr helper; make + polymorphic; add string == support"
```

---

### Task 2: `join` and `length` builtins

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Test: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/lang/tests/interpreter.test.ts`, append after the `== for strings` describe block:

```typescript
// ---------------------------------------------------------------------------
// join builtin
// ---------------------------------------------------------------------------
describe('join builtin', () => {
  it('join() returns ""', () => {
    const prog = program(exprStmt(call('text', [call('join', []), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('', 20)]));
  });

  it('join("hello") returns "hello"', () => {
    const prog = program(exprStmt(call('text', [call('join', [strLit('hello')]), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('hello', 20)]));
  });

  it('join("Score: ", 42) returns "Score: 42"', () => {
    const prog = program(exprStmt(call('text', [call('join', [strLit('Score: '), numLit(42)]), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('Score: 42', 20)]));
  });

  it('join(true, "!") returns "true!"', () => {
    const prog = program(exprStmt(call('text', [call('join', [boolLit(true), strLit('!')]), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('true!', 20)]));
  });

  it('join("a", "b", "c") returns "abc"', () => {
    const prog = program(exprStmt(call('text', [call('join', [strLit('a'), strLit('b'), strLit('c')]), numLit(20)])));
    expect(interpret(prog)).toEqual(mkSequence([mkText('abc', 20)]));
  });
});

// ---------------------------------------------------------------------------
// length builtin
// ---------------------------------------------------------------------------
describe('length builtin', () => {
  it('length("hello") returns 5', () => {
    const prog = program(exprStmt(call('forward', [call('length', [strLit('hello')])])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(5)]));
  });

  it('length("") returns 0', () => {
    const prog = program(exprStmt(call('forward', [call('length', [strLit('')])])));
    expect(interpret(prog)).toEqual(mkSequence([mkForward(0)]));
  });

  it('length(42) throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('length', [numLit(42)]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/length/);
  });

  it('length("a", "b") throws SproutRuntimeError', () => {
    const fn = () => interpret(program(exprStmt(call('length', [strLit('a'), strLit('b')]))));
    expect(fn).toThrow(SproutRuntimeError);
    expect(fn).toThrow(/length/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: FAIL — `join` and `length` are not builtins yet.

- [ ] **Step 3: Add `join` and `length` builtins to the BUILTINS map**

In `packages/lang/src/interpreter.ts`, find the `text` builtin entry (the last entry in BUILTINS, ending at line 372). Add the following two entries immediately after the closing `}],` of the `text` builtin:

```typescript
  // --- String builtins ---
  ['join', (args) => {
    return { kind: 'string', value: args.map(a => toStr(a, 'join')).join('') };
  }],
  ['length', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`length expects 1 argument, got ${args.length}`);
    const s = assertString(args[0], 'length');
    return { kind: 'number', value: s.value.length };
  }],
```

Note: `toStr` is defined in Task 1 — make sure Task 1 is committed before implementing this task.

- [ ] **Step 4: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: All interpreter tests PASS (294+ tests).

- [ ] **Step 5: Run the full suite to confirm no regressions**

```
cd D:\Projects\kider && bun test
```

Expected: All tests PASS (435+ total, 0 failures).

- [ ] **Step 6: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add join() and length() string builtins"
```

---

### Task 3: String blocks, compiler cases, and toolbox

**Files:**
- Modify: `packages/blocks/src/definitions/values.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/tests/compiler.test.ts`
- Modify: `apps/ide/src/BlockWorkspace.tsx`

- [ ] **Step 1: Write the failing tests**

In `packages/blocks/tests/compiler.test.ts`, append after the last `describe` block at the end of the file:

```typescript
// ---------------------------------------------------------------------------
// String blocks
// ---------------------------------------------------------------------------
describe('string blocks', () => {
  it('sprout_string compiles to StringLit', () => {
    const ws = makeWorkspace();

    // sprout_text is a statement block; sprout_string goes into its STR input
    const textBlock = ws.newBlock('sprout_text');
    const strBlock = ws.newBlock('sprout_string');
    strBlock.setFieldValue('hi', 'VALUE');
    const sizeBlock = ws.newBlock('sprout_number');
    sizeBlock.setFieldValue('20', 'NUM');

    textBlock.getInput('STR')!.connection!.connect(strBlock.outputConnection!);
    textBlock.getInput('SIZE')!.connection!.connect(sizeBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [textBlock];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'text',
          args: [
            { kind: 'StringLit', value: 'hi' },
            { kind: 'NumberLit', value: 20 },
          ],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_join compiles to join(A, B) CallExpr', () => {
    const ws = makeWorkspace();

    // sprout_text wraps the join result for use as a statement
    const textBlock = ws.newBlock('sprout_text');
    const joinBlock = ws.newBlock('sprout_join');
    const aBlock = ws.newBlock('sprout_string');
    aBlock.setFieldValue('hello', 'VALUE');
    const bBlock = ws.newBlock('sprout_number');
    bBlock.setFieldValue('42', 'NUM');
    const sizeBlock = ws.newBlock('sprout_number');
    sizeBlock.setFieldValue('20', 'NUM');

    joinBlock.getInput('A')!.connection!.connect(aBlock.outputConnection!);
    joinBlock.getInput('B')!.connection!.connect(bBlock.outputConnection!);
    textBlock.getInput('STR')!.connection!.connect(joinBlock.outputConnection!);
    textBlock.getInput('SIZE')!.connection!.connect(sizeBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [textBlock];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'text',
          args: [
            {
              kind: 'CallExpr',
              callee: 'join',
              args: [
                { kind: 'StringLit', value: 'hello' },
                { kind: 'NumberLit', value: 42 },
              ],
              block: null,
            },
            { kind: 'NumberLit', value: 20 },
          ],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_length compiles to length(str) CallExpr', () => {
    const ws = makeWorkspace();

    // sprout_forward uses length result as distance (length returns a Number)
    const fwdBlock = ws.newBlock('sprout_forward');
    const lenBlock = ws.newBlock('sprout_length');
    const strBlock = ws.newBlock('sprout_string');
    strBlock.setFieldValue('hello', 'VALUE');

    lenBlock.getInput('STR')!.connection!.connect(strBlock.outputConnection!);
    fwdBlock.getInput('DISTANCE')!.connection!.connect(lenBlock.outputConnection!);
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [fwdBlock];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'forward',
          args: [{
            kind: 'CallExpr',
            callee: 'length',
            args: [{ kind: 'StringLit', value: 'hello' }],
            block: null,
          }],
          block: null,
        },
      }],
    });
    ws.dispose();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\blocks && bun test tests/compiler.test.ts
```

Expected: FAIL — block types `sprout_string`, `sprout_join`, `sprout_length` are unknown.

- [ ] **Step 3: Add the three block definitions to `values.ts`**

In `packages/blocks/src/definitions/values.ts`, add the following inside the `registerValueBlocks` function, after the closing `};` of `sprout_infix` (after line 45, before the closing `}` of the function):

```typescript
  Blockly.Blocks['sprout_string'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('"')
        .appendField(new Blockly.FieldTextInput('hello'), 'VALUE')
        .appendField('"');
      this.setOutput(true, 'String');
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_join'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('join');
      this.appendValueInput('A').setCheck(null);
      this.appendValueInput('B').setCheck(null);
      this.setOutput(true, 'String');
      this.setInputsInline(true);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_length'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('STR').setCheck('String').appendField('length of');
      this.setOutput(true, 'Number');
      this.setInputsInline(true);
      this.setColour(160);
    },
  };
```

- [ ] **Step 4: Add `StringLit` to the compiler imports**

In `packages/blocks/src/compiler.ts`, find the import from `'@sprout/lang'` at the top of the file. It currently imports `NumberLit, Ident, InfixExpr, UnaryExpr, CallExpr, BlockExpr, RepeatExpr, OnExpr, IfExpr, WhileExpr, SymbolLit, BoolLit` (and others). Add `StringLit` to that same import list.

- [ ] **Step 5: Add the three compiler cases to `compiler.ts`**

In `packages/blocks/src/compiler.ts`, inside the `compileExprBlock` function, find `case 'sprout_text':` and insert the three new cases immediately after that case's closing `}` — before the `default:` case at the end of the switch. Add:

```typescript
    case 'sprout_string': {
      const value = block.getFieldValue('VALUE') as string;
      const lit: StringLit = { kind: 'StringLit', value };
      return lit;
    }

    case 'sprout_join': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'join', args: [a, b], block: null };
    }

    case 'sprout_length': {
      const str = compileExpr(mustGetInput(block, 'STR'));
      return { kind: 'CallExpr', callee: 'length', args: [str], block: null };
    }
```

- [ ] **Step 6: Add the Text section to the toolbox in `BlockWorkspace.tsx`**

In `apps/ide/src/BlockWorkspace.tsx`, find the `// Values` comment section in the TOOLBOX constant (around line 35). Add a new `// Text` comment and three block entries immediately before the `// Values` line:

```typescript
    // Text
    { kind: 'block', type: 'sprout_string' },
    { kind: 'block', type: 'sprout_join' },
    { kind: 'block', type: 'sprout_length' },
    // Values
```

- [ ] **Step 7: Run compiler tests to verify they pass**

```
cd D:\Projects\kider\packages\blocks && bun test tests/compiler.test.ts
```

Expected: All compiler tests PASS (44+ tests).

- [ ] **Step 8: Run the full test suite**

```
cd D:\Projects\kider && bun test
```

Expected: All tests PASS (444+ tests, 0 failures).

- [ ] **Step 9: Commit**

```
git add packages/blocks/src/definitions/values.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(blocks): add sprout_string, sprout_join, sprout_length blocks and toolbox"
```
