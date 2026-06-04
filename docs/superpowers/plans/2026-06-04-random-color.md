# Random Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `randomColor()` and `randomColor(:any)` builtins that return a color Drawing — a random palette pick or a fully random hex color.

**Architecture:** Single new BUILTINS entry in `interpreter.ts` (no changes to `values.ts` or `renderer.ts` — `mkColor` already accepts arbitrary hex strings). One new Blockly block `sprout_random_color` with a MODE dropdown, placed after `sprout_color` in the toolbox.

**Tech Stack:** TypeScript, Vitest, Blockly 10, pnpm monorepo (`@sprout/lang`, `@sprout/blocks`, `@sprout/ide`)

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/interpreter.ts` | Add `randomColor` builtin after `color` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('randomColor builtin')` |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_random_color` block after `sprout_color` |
| `packages/blocks/src/compiler.ts` | Add `sprout_random_color` to `compileStmt` and `compileExprBlock` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('randomColor block')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_random_color` to toolbox after `sprout_color` |

---

### Task 1: `randomColor` interpreter builtin

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Test: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/lang/tests/interpreter.test.ts` after `describe('color builtin')`:

```typescript
// ---------------------------------------------------------------------------
// randomColor builtin
// ---------------------------------------------------------------------------
describe('randomColor builtin', () => {
  const PALETTE_COLORS = [
    '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea',
    '#000000', '#ffffff', '#ca8a04', '#db2777',
  ];

  it('randomColor() returns mkSequence([mkColor(x)]) where x is a palette color', () => {
    const result = interpret(program(exprStmt(call('randomColor', []))));
    const possible = PALETTE_COLORS.map(c => mkSequence([mkColor(c)]));
    expect(possible).toContainEqual(result);
  });

  it('randomColor(:any) returns a color Drawing with a valid #rrggbb hex', () => {
    const result = interpret(program(exprStmt(call('randomColor', [{ kind: 'SymbolLit' as const, name: 'any' }]))));
    const seq = result as { kind: 'sequence'; steps: Array<{ kind: string; color?: string }> };
    expect(seq.steps[0].kind).toBe('color');
    expect(seq.steps[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('randomColor(:bad) throws SproutRuntimeError', () => {
    expect(() =>
      interpret(program(exprStmt(call('randomColor', [{ kind: 'SymbolLit' as const, name: 'bad' }]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(program(exprStmt(call('randomColor', [{ kind: 'SymbolLit' as const, name: 'bad' }]))))
    ).toThrow(/randomColor/);
  });

  it('randomColor with 2 args throws SproutRuntimeError', () => {
    expect(() =>
      interpret(program(exprStmt(call('randomColor', [numLit(1), numLit(2)]))))
    ).toThrow(SproutRuntimeError);
    expect(() =>
      interpret(program(exprStmt(call('randomColor', [numLit(1), numLit(2)]))))
    ).toThrow(/randomColor/);
  });
});
```

Note: `interpret(prog)` returns `mkSequence([...])`. The `color` Drawing variant has field `color` (not `hex`): `{ kind: 'color', color: string }`. `mkColor` and `mkSequence` are already imported at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: FAIL — `randomColor` is not a builtin.

- [ ] **Step 3: Add `randomColor` to BUILTINS in `interpreter.ts`**

In `packages/lang/src/interpreter.ts`, add the new entry after the `color` entry (after line 191, which closes the `color` entry with `}],`):

```typescript
  ['randomColor', (args) => {
    if (args.length === 0) {
      const keys = Object.keys(COLOR_MAP);
      const hex = COLOR_MAP[keys[Math.floor(Math.random() * keys.length)]];
      return mkColor(hex);
    }
    if (args.length === 1) {
      const sym = args[0];
      if (sym.kind !== 'symbol' || sym.name !== 'any') {
        throw new SproutRuntimeError(
          `randomColor: expected no arguments or :any, got ${sym.kind === 'symbol' ? ':' + sym.name : sym.kind}`
        );
      }
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      return mkColor(hex);
    }
    throw new SproutRuntimeError(`randomColor expects 0 or 1 arguments, got ${args.length}`);
  }],
```

`COLOR_MAP` and `mkColor` are already in scope — they're defined earlier in the same file.

- [ ] **Step 4: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\lang && bun test tests/interpreter.test.ts
```

Expected: All interpreter tests PASS.

- [ ] **Step 5: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add randomColor builtin — palette and :any modes"
```

---

### Task 2: `sprout_random_color` Blockly block and compiler

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Test: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/blocks/tests/compiler.test.ts`:

```typescript
describe('randomColor block', () => {
  it('sprout_random_color with MODE="palette" compiles to randomColor()', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_random_color');
    block.setFieldValue('palette', 'MODE');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'randomColor',
          args: [],
          block: null,
        },
      }],
    });
    ws.dispose();
  });

  it('sprout_random_color with MODE="any" compiles to randomColor(:any)', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_random_color');
    block.setFieldValue('any', 'MODE');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

    const result = compileWorkspace(ws);
    expect(result).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr',
          callee: 'randomColor',
          args: [{ kind: 'SymbolLit', name: 'any' }],
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

Expected: FAIL — `sprout_random_color` block type unknown.

- [ ] **Step 3: Add `sprout_random_color` block to `statements.ts`**

In `packages/blocks/src/definitions/statements.ts`, add the new block immediately after the closing `};` of `sprout_color` (after line ~70):

```typescript
  Blockly.Blocks['sprout_random_color'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('random color')
        .appendField(
          new Blockly.FieldDropdown([
            ['palette', 'palette'],
            ['any',     'any'],
          ]) as unknown as Blockly.Field,
          'MODE',
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
    },
  };
```

- [ ] **Step 4: Add `sprout_random_color` to the compiler**

In `packages/blocks/src/compiler.ts`:

**a)** Add `'sprout_random_color'` to the `compileStmt` case group (after `'sprout_color'` on line ~30):

```typescript
    case 'sprout_color':
    case 'sprout_random_color':
    case 'sprout_pen_width':
```

**b)** Add the case to `compileExprBlock` after the `sprout_color` case:

```typescript
    case 'sprout_random_color': {
      const mode = block.getFieldValue('MODE') as string;
      const args = mode === 'any'
        ? [{ kind: 'SymbolLit' as const, name: 'any' }]
        : [];
      return { kind: 'CallExpr', callee: 'randomColor', args, block: null };
    }
```

- [ ] **Step 5: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\blocks && bun test tests/compiler.test.ts
```

Expected: All compiler tests PASS.

- [ ] **Step 6: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add sprout_random_color block and compiler case"
```

---

### Task 3: Toolbox registration and full test run

**Files:**
- Modify: `apps/ide/src/BlockWorkspace.tsx`

- [ ] **Step 1: Add `sprout_random_color` to the toolbox**

In `apps/ide/src/BlockWorkspace.tsx`, add `sprout_random_color` after `sprout_color` in the Pen section (after line 14):

```typescript
    // Pen
    { kind: 'block', type: 'sprout_pen_up' },
    { kind: 'block', type: 'sprout_pen_down' },
    { kind: 'block', type: 'sprout_color' },
    { kind: 'block', type: 'sprout_random_color' },
    { kind: 'block', type: 'sprout_pen_width' },
```

- [ ] **Step 2: Run the full test suite**

```
cd D:\Projects\kider && bun test
```

Expected: All tests PASS (385+ tests, 0 failures).

- [ ] **Step 3: Commit**

```
git add apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(ide): add sprout_random_color to toolbox"
```
