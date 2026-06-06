# List Access Builtins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `at(list, index)` (0-based index access) and `range(start, end)` (integer list generator) builtins with interpreter, blocks, and compiler support.

**Architecture:** Both are pure BUILTINS map entries in `interpreter.ts` — no AST or renderer changes needed. `at` is 0-based (note: existing `get` is 1-based; `at` pairs naturally with `range` which starts at 0). Each gets a Blockly value block and a compiler case in `compileExprBlock`.

**Tech Stack:** TypeScript, Bun/Vitest, Blockly

---

## File Map

| File | Change |
|------|--------|
| `packages/lang/src/interpreter.ts` | Add `at` and `range` after the `isEmpty` entry in BUILTINS |
| `packages/lang/tests/interpreter.test.ts` | Add `at` and `range` describe blocks at end of file |
| `packages/blocks/src/definitions/values.ts` | Add `sprout_at` and `sprout_range` block definitions |
| `packages/blocks/src/compiler.ts` | Add `sprout_at` and `sprout_range` cases to `compileExprBlock` |

---

### Task 1: `at(list, index)` builtin

**Files:**
- Modify: `packages/lang/tests/interpreter.test.ts` (add at end)
- Modify: `packages/lang/src/interpreter.ts` (add after `isEmpty` entry, before the `]);` that closes BUILTINS)

- [ ] **Step 1: Write failing tests**

Append to `packages/lang/tests/interpreter.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// at builtin
// ---------------------------------------------------------------------------
describe('at builtin', () => {
  it('at(list(10,20,30), 0) returns 10', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(0)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 10 });
  });

  it('at(list(10,20,30), 2) returns 30', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(2)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 30 });
  });

  it('at(list(10,20,30), 1) returns 20', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(10), numLit(20), numLit(30)]), numLit(1)])));
    expect(interpretValue(prog)).toEqual({ kind: 'number', value: 20 });
  });

  it('at with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)])])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with non-list first arg throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [numLit(42), numLit(0)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with non-number index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), strLit('x')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with out-of-bounds index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), numLit(5)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('at with negative index throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('at', [call('list', [numLit(1)]), numLit(-1)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});
```

- [ ] **Step 2: Run to confirm failing**

```
"/c/Users/samer/.bun/bin/bun" test packages/lang/tests/interpreter.test.ts
```

Expected: 8 new failures — `SproutRuntimeError: Unbound identifier: 'at'`

- [ ] **Step 3: Implement `at` in interpreter.ts**

In `packages/lang/src/interpreter.ts`, add after the `isEmpty` entry (just before the `]);` that closes the BUILTINS map):

```typescript
  ['at', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`at expects 2 arguments, got ${args.length}`);
    const lst = assertList(args[0], 'at');
    const idx = assertNumber(args[1], 'at');
    const i = idx.value;
    if (i < 0 || i >= lst.items.length) {
      throw new SproutRuntimeError(`at: index ${i} out of bounds (list length ${lst.items.length})`);
    }
    return lst.items[i];
  }],
```

- [ ] **Step 4: Run tests to confirm passing**

```
"/c/Users/samer/.bun/bin/bun" test packages/lang/tests/interpreter.test.ts
```

Expected: all pass

- [ ] **Step 5: Add Blockly block definition**

In `packages/blocks/src/definitions/values.ts`, add after the `sprout_size` block (find it by searching for `'sprout_size'`):

```typescript
  Blockly.Blocks['sprout_at'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LIST').setCheck(null).appendField('at');
      this.appendValueInput('INDEX').setCheck('Number').appendField('index');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(200);
      this.setTooltip('Get item at 0-based index from list');
    },
  };
```

- [ ] **Step 6: Add compiler case**

In `packages/blocks/src/compiler.ts`, add after the `sprout_size` case (find it by searching for `'sprout_size'`):

```typescript
    case 'sprout_at': {
      const list = compileExpr(mustGetInput(block, 'LIST'));
      const index = compileExpr(mustGetInput(block, 'INDEX'));
      return { kind: 'CallExpr', callee: 'at', args: [list, index], block: null };
    }
```

- [ ] **Step 7: Run full suite to confirm no regressions**

```
"/c/Users/samer/.bun/bin/bun" test
```

Expected: all pass (609+ tests)

- [ ] **Step 8: Commit**

```bash
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts packages/blocks/src/definitions/values.ts packages/blocks/src/compiler.ts
git commit -m "feat(lang): add at(list, index) 0-based list access builtin"
```

---

### Task 2: `range(start, end)` builtin

**Files:**
- Modify: `packages/lang/tests/interpreter.test.ts` (add at end)
- Modify: `packages/lang/src/interpreter.ts` (add after `at` entry)
- Modify: `packages/blocks/src/definitions/values.ts`
- Modify: `packages/blocks/src/compiler.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/lang/tests/interpreter.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// range builtin
// ---------------------------------------------------------------------------
describe('range builtin', () => {
  it('range(0, 5) returns [0,1,2,3,4]', () => {
    const prog = program(exprStmt(call('range', [numLit(0), numLit(5)])));
    expect(interpretValue(prog)).toEqual({
      kind: 'list',
      items: [
        { kind: 'number', value: 0 },
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 3 },
        { kind: 'number', value: 4 },
      ],
    });
  });

  it('range(3, 6) returns [3,4,5]', () => {
    const prog = program(exprStmt(call('range', [numLit(3), numLit(6)])));
    expect(interpretValue(prog)).toEqual({
      kind: 'list',
      items: [
        { kind: 'number', value: 3 },
        { kind: 'number', value: 4 },
        { kind: 'number', value: 5 },
      ],
    });
  });

  it('range(5, 5) returns empty list', () => {
    const prog = program(exprStmt(call('range', [numLit(5), numLit(5)])));
    expect(interpretValue(prog)).toEqual({ kind: 'list', items: [] });
  });

  it('range(0, 1) returns [0]', () => {
    const prog = program(exprStmt(call('range', [numLit(0), numLit(1)])));
    expect(interpretValue(prog)).toEqual({ kind: 'list', items: [{ kind: 'number', value: 0 }] });
  });

  it('range with wrong arg count throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [numLit(0)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('range with non-number start throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [strLit('a'), numLit(5)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('range with non-number end throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [numLit(0), strLit('b')])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });

  it('range where start > end throws SproutRuntimeError', () => {
    const prog = program(exprStmt(call('range', [numLit(5), numLit(3)])));
    expect(() => interpretValue(prog)).toThrow(SproutRuntimeError);
  });
});
```

- [ ] **Step 2: Run to confirm failing**

```
"/c/Users/samer/.bun/bin/bun" test packages/lang/tests/interpreter.test.ts
```

Expected: 8 new failures — `SproutRuntimeError: Unbound identifier: 'range'`

- [ ] **Step 3: Implement `range` in interpreter.ts**

In `packages/lang/src/interpreter.ts`, add after the `at` entry (just before the `]);` closing BUILTINS):

```typescript
  ['range', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`range expects 2 arguments, got ${args.length}`);
    const start = assertNumber(args[0], 'range');
    const end = assertNumber(args[1], 'range');
    if (start.value > end.value) {
      throw new SproutRuntimeError(`range: start (${start.value}) must be <= end (${end.value})`);
    }
    const items: SproutValue[] = [];
    for (let i = start.value; i < end.value; i++) {
      items.push({ kind: 'number', value: i });
    }
    return mkList(items);
  }],
```

- [ ] **Step 4: Run tests to confirm passing**

```
"/c/Users/samer/.bun/bin/bun" test packages/lang/tests/interpreter.test.ts
```

Expected: all pass

- [ ] **Step 5: Add Blockly block definition**

In `packages/blocks/src/definitions/values.ts`, add after the `sprout_at` block:

```typescript
  Blockly.Blocks['sprout_range'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('START').setCheck('Number').appendField('range');
      this.appendValueInput('END').setCheck('Number').appendField('to');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(200);
      this.setTooltip('Generate list of integers from start up to (not including) end');
    },
  };
```

- [ ] **Step 6: Add compiler case**

In `packages/blocks/src/compiler.ts`, add after the `sprout_at` case:

```typescript
    case 'sprout_range': {
      const start = compileExpr(mustGetInput(block, 'START'));
      const end = compileExpr(mustGetInput(block, 'END'));
      return { kind: 'CallExpr', callee: 'range', args: [start, end], block: null };
    }
```

- [ ] **Step 7: Run full suite**

```
"/c/Users/samer/.bun/bin/bun" test
```

Expected: all pass (617+ tests)

- [ ] **Step 8: Commit**

```bash
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts packages/blocks/src/definitions/values.ts packages/blocks/src/compiler.ts
git commit -m "feat(lang): add range(start, end) integer list generator builtin"
```

---

## Self-Review

**Spec coverage:**
- `at(list, index)` 0-based — Task 1 ✓
- `at` out-of-bounds throws — Task 1 Step 1 ✓
- `range(start, end)` exclusive end — Task 2 ✓
- `range(n, n)` → empty list — Task 2 Step 1 ✓
- `range` start > end throws — Task 2 Step 1 ✓
- Blockly blocks for both — Tasks 1 & 2 Steps 5–6 ✓
- Compiler cases for both — Tasks 1 & 2 Steps 6 ✓

**Placeholder scan:** No TBDs or incomplete steps.

**Type consistency:** `SproutValue[]` used in `range` impl matches the type accepted by `mkList`. `assertList`/`assertNumber` are existing helpers in scope. `interpretValue` is already imported in the test file.
