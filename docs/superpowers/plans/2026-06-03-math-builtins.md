# Math Builtins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 15 math functions (`sin`, `cos`, `tan`, `abs`, `sqrt`, `pow`, `mod`, `log`, `floor`, `ceil`, `round`, `max`, `min`, `random`, `pi`) as interpreter builtins and Blockly value blocks.

**Architecture:** Builtins are added to the `BUILTINS` map in `interpreter.ts` — the parser and AST already handle arbitrary `CallExpr` nodes, so no changes needed there. A new `math.ts` registers 15 Blockly value blocks, and `compiler.ts` gets 15 new cases in `compileExpr`. All are TDD.

**Tech Stack:** TypeScript, Vitest, Blockly

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/interpreter.ts` | Add 15 entries to `BUILTINS` map |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('math builtins')` with ~25 tests |
| `packages/blocks/src/definitions/math.ts` | New — `registerMathBlocks()` |
| `packages/blocks/src/definitions/index.ts` | Import + call `registerMathBlocks()` |
| `packages/blocks/src/compiler.ts` | Add 15 cases to `compileExpr` |
| `packages/blocks/tests/compiler.test.ts` | Add 3 representative math block compiler tests |
| `apps/ide/src/BlockWorkspace.tsx` | Add Math section to toolbox |

---

### Task 1: Interpreter math builtins (TDD)

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

**Background:**

The test file uses these AST builder helpers (already defined at the top of the test file):
```typescript
const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const call = (callee: string, args: Expr[], block = null): Expr =>
  ({ kind: 'CallExpr', callee, args, block });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const program = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });
```

To test math builtins that return numbers (not drawings), wrap them in `forward()` and check the resulting `Drawing`. For example `forward(sin(90))` → `mkForward(1)`.

Existing imports at top of test file include `interpret`, `SproutRuntimeError`, `mkForward`.

The existing `BUILTINS` map in `interpreter.ts` ends with the `puts` entry (line ~193). Add the math entries immediately before the closing `]);`.

All new builtins follow this exact pattern:
```typescript
['name', (args) => {
  if (args.length !== N) throw new SproutRuntimeError(`name expects N argument(s), got ${args.length}`);
  const x = assertNumber(args[0], 'name');
  return { kind: 'number', value: Math.name(x.value) } satisfies SproutNumber;
}],
```

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to `packages/lang/tests/interpreter.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// Math builtins
// ---------------------------------------------------------------------------

describe('math builtins', () => {
  // --- trig (degrees) ---
  it('sin(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('sin', [numLit(0)])]))))).toEqual(mkForward(0));
  });
  it('sin(90) = 1', () => {
    expect(interpret(program(exprStmt(call('forward', [call('sin', [numLit(90)])]))))).toEqual(mkForward(1));
  });
  it('cos(0) = 1', () => {
    expect(interpret(program(exprStmt(call('forward', [call('cos', [numLit(0)])]))))).toEqual(mkForward(1));
  });
  it('tan(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('tan', [numLit(0)])]))))).toEqual(mkForward(0));
  });

  // --- arithmetic ---
  it('abs(-5) = 5', () => {
    expect(interpret(program(exprStmt(call('forward', [call('abs', [numLit(-5)])]))))).toEqual(mkForward(5));
  });
  it('abs(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('abs', [numLit(0)])]))))).toEqual(mkForward(0));
  });
  it('sqrt(4) = 2', () => {
    expect(interpret(program(exprStmt(call('forward', [call('sqrt', [numLit(4)])]))))).toEqual(mkForward(2));
  });
  it('sqrt(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('sqrt', [numLit(0)])]))))).toEqual(mkForward(0));
  });
  it('pow(2, 3) = 8', () => {
    expect(interpret(program(exprStmt(call('forward', [call('pow', [numLit(2), numLit(3)])]))))).toEqual(mkForward(8));
  });
  it('mod(7, 3) = 1', () => {
    expect(interpret(program(exprStmt(call('forward', [call('mod', [numLit(7), numLit(3)])]))))).toEqual(mkForward(1));
  });
  it('log(1) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('log', [numLit(1)])]))))).toEqual(mkForward(0));
  });

  // --- rounding ---
  it('floor(3.7) = 3', () => {
    expect(interpret(program(exprStmt(call('forward', [call('floor', [numLit(3.7)])]))))).toEqual(mkForward(3));
  });
  it('floor(-1.5) = -2', () => {
    expect(interpret(program(exprStmt(call('forward', [call('floor', [numLit(-1.5)])]))))).toEqual(mkForward(-2));
  });
  it('ceil(3.2) = 4', () => {
    expect(interpret(program(exprStmt(call('forward', [call('ceil', [numLit(3.2)])]))))).toEqual(mkForward(4));
  });
  it('ceil(-1.5) = -1', () => {
    expect(interpret(program(exprStmt(call('forward', [call('ceil', [numLit(-1.5)])]))))).toEqual(mkForward(-1));
  });
  it('round(3.5) = 4', () => {
    expect(interpret(program(exprStmt(call('forward', [call('round', [numLit(3.5)])]))))).toEqual(mkForward(4));
  });

  // --- extrema ---
  it('max(3, 7) = 7', () => {
    expect(interpret(program(exprStmt(call('forward', [call('max', [numLit(3), numLit(7)])]))))).toEqual(mkForward(7));
  });
  it('min(3, 7) = 3', () => {
    expect(interpret(program(exprStmt(call('forward', [call('min', [numLit(3), numLit(7)])]))))).toEqual(mkForward(3));
  });

  // --- random ---
  it('random(0) = 0', () => {
    expect(interpret(program(exprStmt(call('forward', [call('random', [numLit(0)])]))))).toEqual(mkForward(0));
  });

  // --- pi ---
  it('pi() = Math.PI', () => {
    expect(interpret(program(exprStmt(call('forward', [call('pi', [])]))))).toEqual(mkForward(Math.PI));
  });

  // --- arity errors ---
  it('sin throws with 0 args', () => {
    expect(() => interpret(program(exprStmt(call('sin', []))))).toThrow(SproutRuntimeError);
  });
  it('sin throws with 2 args', () => {
    expect(() => interpret(program(exprStmt(call('sin', [numLit(0), numLit(0)]))))).toThrow(SproutRuntimeError);
  });
  it('pow throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('pow', [numLit(2)]))))).toThrow(SproutRuntimeError);
  });
  it('pi throws with 1 arg', () => {
    expect(() => interpret(program(exprStmt(call('pi', [numLit(1)]))))).toThrow(SproutRuntimeError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm test
```

Expected: ~25 new failures with `SproutRuntimeError: forward: expected number, got undefined` or similar (the builtins don't exist yet).

- [ ] **Step 3: Add math builtins to `interpreter.ts`**

In `packages/lang/src/interpreter.ts`, find the closing `]);` of the `BUILTINS` map (after the `puts` entry, around line 193). Insert these entries **before** that closing `]);`:

```typescript
  // --- Math builtins ---
  ['sin', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`sin expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'sin');
    return { kind: 'number', value: Math.sin(x.value * Math.PI / 180) } satisfies SproutNumber;
  }],
  ['cos', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`cos expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'cos');
    return { kind: 'number', value: Math.cos(x.value * Math.PI / 180) } satisfies SproutNumber;
  }],
  ['tan', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`tan expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'tan');
    return { kind: 'number', value: Math.tan(x.value * Math.PI / 180) } satisfies SproutNumber;
  }],
  ['abs', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`abs expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'abs');
    return { kind: 'number', value: Math.abs(x.value) } satisfies SproutNumber;
  }],
  ['sqrt', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`sqrt expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'sqrt');
    return { kind: 'number', value: Math.sqrt(x.value) } satisfies SproutNumber;
  }],
  ['pow', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`pow expects 2 arguments, got ${args.length}`);
    const base = assertNumber(args[0], 'pow (base)');
    const exp = assertNumber(args[1], 'pow (exp)');
    return { kind: 'number', value: Math.pow(base.value, exp.value) } satisfies SproutNumber;
  }],
  ['mod', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`mod expects 2 arguments, got ${args.length}`);
    const a = assertNumber(args[0], 'mod (a)');
    const b = assertNumber(args[1], 'mod (b)');
    return { kind: 'number', value: a.value % b.value } satisfies SproutNumber;
  }],
  ['log', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`log expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'log');
    return { kind: 'number', value: Math.log(x.value) } satisfies SproutNumber;
  }],
  ['floor', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`floor expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'floor');
    return { kind: 'number', value: Math.floor(x.value) } satisfies SproutNumber;
  }],
  ['ceil', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`ceil expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'ceil');
    return { kind: 'number', value: Math.ceil(x.value) } satisfies SproutNumber;
  }],
  ['round', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`round expects 1 argument, got ${args.length}`);
    const x = assertNumber(args[0], 'round');
    return { kind: 'number', value: Math.round(x.value) } satisfies SproutNumber;
  }],
  ['max', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`max expects 2 arguments, got ${args.length}`);
    const a = assertNumber(args[0], 'max (a)');
    const b = assertNumber(args[1], 'max (b)');
    return { kind: 'number', value: Math.max(a.value, b.value) } satisfies SproutNumber;
  }],
  ['min', (args) => {
    if (args.length !== 2) throw new SproutRuntimeError(`min expects 2 arguments, got ${args.length}`);
    const a = assertNumber(args[0], 'min (a)');
    const b = assertNumber(args[1], 'min (b)');
    return { kind: 'number', value: Math.min(a.value, b.value) } satisfies SproutNumber;
  }],
  ['random', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`random expects 1 argument, got ${args.length}`);
    const n = assertNumber(args[0], 'random');
    return { kind: 'number', value: Math.random() * n.value } satisfies SproutNumber;
  }],
  ['pi', (args) => {
    if (args.length !== 0) throw new SproutRuntimeError(`pi expects 0 arguments, got ${args.length}`);
    return { kind: 'number', value: Math.PI } satisfies SproutNumber;
  }],
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm test
```

Expected: all tests pass. Total count increases by ~25.

- [ ] **Step 5: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add 15 math builtins (sin, cos, tan, abs, sqrt, pow, mod, log, floor, ceil, round, max, min, random, pi)"
```

---

### Task 2: Blockly math block definitions + compiler

**Files:**
- Create: `packages/blocks/src/definitions/math.ts`
- Modify: `packages/blocks/src/definitions/index.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/tests/compiler.test.ts`

**Background:**

Existing value block pattern (from `values.ts`): blocks use `this.setOutput(true, null)` and colour `230`. 1-arg blocks use `appendValueInput('X').setCheck(null).appendField('label')`. 2-arg blocks use inputs named `'A'` and `'B'`. The 0-arg `pi` block uses `appendDummyInput().appendField('π')`.

In `compiler.ts`, `compileExpr` is a switch on `block.type`. Each math case returns a `CallExpr`. The `block` field on `CallExpr` is always `null` for builtins.

In `index.ts`, the current `registerAllBlocks()` body is:
```typescript
registerStatementBlocks();
registerValueBlocks();
registerConditionalBlocks();
registerVariableBlocks();
```

- [ ] **Step 1: Create `packages/blocks/src/definitions/math.ts`**

```typescript
import * as Blockly from 'blockly/node';

export function registerMathBlocks(): void {
  Blockly.Blocks['sprout_sin'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('sin');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_cos'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('cos');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_tan'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('tan');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_abs'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('abs');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_sqrt'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('sqrt');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_log'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('log');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_floor'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('floor');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_ceil'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('ceil');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_round'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('round');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_random'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck(null).appendField('random');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_pow'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('A').setCheck(null).appendField('pow');
      this.appendValueInput('B').setCheck(null).appendField('exp');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_mod'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('A').setCheck(null).appendField('mod');
      this.appendValueInput('B').setCheck(null);
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_max'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('A').setCheck(null).appendField('max');
      this.appendValueInput('B').setCheck(null).appendField(',');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_min'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('A').setCheck(null).appendField('min');
      this.appendValueInput('B').setCheck(null).appendField(',');
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
  Blockly.Blocks['sprout_pi'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('π');
      this.setOutput(true, null);
      this.setColour(230);
    },
  };
}
```

- [ ] **Step 2: Update `packages/blocks/src/definitions/index.ts`**

```typescript
import { registerStatementBlocks } from './statements.js';
import { registerValueBlocks } from './values.js';
import { registerConditionalBlocks } from './conditionals.js';
import { registerVariableBlocks } from './variables.js';
import { registerMathBlocks } from './math.js';

let registered = false;

export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  registerStatementBlocks();
  registerValueBlocks();
  registerConditionalBlocks();
  registerVariableBlocks();
  registerMathBlocks();
}
```

- [ ] **Step 3: Add 15 cases to `compileExpr` in `packages/blocks/src/compiler.ts`**

Find the `default:` case at the end of the `compileExpr` switch (around line 249). Insert these cases immediately before `default:`:

```typescript
    case 'sprout_sin': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'sin', args: [x], block: null };
    }
    case 'sprout_cos': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'cos', args: [x], block: null };
    }
    case 'sprout_tan': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'tan', args: [x], block: null };
    }
    case 'sprout_abs': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'abs', args: [x], block: null };
    }
    case 'sprout_sqrt': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'sqrt', args: [x], block: null };
    }
    case 'sprout_log': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'log', args: [x], block: null };
    }
    case 'sprout_floor': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'floor', args: [x], block: null };
    }
    case 'sprout_ceil': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'ceil', args: [x], block: null };
    }
    case 'sprout_round': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'round', args: [x], block: null };
    }
    case 'sprout_random': {
      const x = compileExpr(mustGetInput(block, 'X'));
      return { kind: 'CallExpr', callee: 'random', args: [x], block: null };
    }
    case 'sprout_pow': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'pow', args: [a, b], block: null };
    }
    case 'sprout_mod': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'mod', args: [a, b], block: null };
    }
    case 'sprout_max': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'max', args: [a, b], block: null };
    }
    case 'sprout_min': {
      const a = compileExpr(mustGetInput(block, 'A'));
      const b = compileExpr(mustGetInput(block, 'B'));
      return { kind: 'CallExpr', callee: 'min', args: [a, b], block: null };
    }
    case 'sprout_pi':
      return { kind: 'CallExpr', callee: 'pi', args: [], block: null };
```

- [ ] **Step 4: Add compiler tests to `packages/blocks/tests/compiler.test.ts`**

Append this `describe` block to the test file:

```typescript
// ---------------------------------------------------------------------------
// Math blocks
// ---------------------------------------------------------------------------

describe('math blocks', () => {
  it('sprout_sin compiles to sin CallExpr (1-arg pattern)', () => {
    const ws = makeWorkspace();
    const sinBlock = ws.newBlock('sprout_sin');
    const numBlock = ws.newBlock('sprout_number');
    numBlock.setFieldValue('90', 'NUM');
    sinBlock.getInput('X')!.connection!.connect(numBlock.outputConnection!);
    const fwdBlock = ws.newBlock('sprout_forward');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(sinBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'forward',
          args: [{ kind: 'CallExpr', callee: 'sin', args: [{ kind: 'NumberLit', value: 90 }], block: null }],
          block: null,
        },
      }],
    });
  });

  it('sprout_pow compiles to pow CallExpr (2-arg pattern)', () => {
    const ws = makeWorkspace();
    const powBlock = ws.newBlock('sprout_pow');
    const base = ws.newBlock('sprout_number');
    base.setFieldValue('2', 'NUM');
    const exp = ws.newBlock('sprout_number');
    exp.setFieldValue('3', 'NUM');
    powBlock.getInput('A')!.connection!.connect(base.outputConnection!);
    powBlock.getInput('B')!.connection!.connect(exp.outputConnection!);
    const fwdBlock = ws.newBlock('sprout_forward');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(powBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'forward',
          args: [{
            kind: 'CallExpr', callee: 'pow',
            args: [{ kind: 'NumberLit', value: 2 }, { kind: 'NumberLit', value: 3 }],
            block: null,
          }],
          block: null,
        },
      }],
    });
  });

  it('sprout_pi compiles to pi CallExpr (0-arg pattern)', () => {
    const ws = makeWorkspace();
    const piBlock = ws.newBlock('sprout_pi');
    const fwdBlock = ws.newBlock('sprout_forward');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(piBlock.outputConnection!);
    expect(compileWorkspace(ws)).toEqual({
      kind: 'Program',
      stmts: [{
        kind: 'ExprStmt',
        expr: {
          kind: 'CallExpr', callee: 'forward',
          args: [{ kind: 'CallExpr', callee: 'pi', args: [], block: null }],
          block: null,
        },
      }],
    });
  });
});
```

- [ ] **Step 5: Run tests**

```
pnpm test
```

Expected: all tests pass. Total increases by 3 compiler tests.

- [ ] **Step 6: Commit**

```
git add packages/blocks/src/definitions/math.ts packages/blocks/src/definitions/index.ts packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add math block definitions and compiler cases"
```

---

### Task 3: Add Math section to toolbox

**Files:**
- Modify: `apps/ide/src/BlockWorkspace.tsx`

**Background:**

The `TOOLBOX` constant in `BlockWorkspace.tsx` is a `ToolboxDefinition` with a flat `contents` array. Add a Math section after the "Values" comment and before the "Output" comment. The new entries use the same `{ kind: 'block', type: '...' }` shape as all others.

- [ ] **Step 1: Update `BlockWorkspace.tsx` toolbox**

Find the `// Output` comment line and insert the Math entries before it:

```typescript
    // Math
    { kind: 'block', type: 'sprout_sin' },
    { kind: 'block', type: 'sprout_cos' },
    { kind: 'block', type: 'sprout_tan' },
    { kind: 'block', type: 'sprout_abs' },
    { kind: 'block', type: 'sprout_sqrt' },
    { kind: 'block', type: 'sprout_pow' },
    { kind: 'block', type: 'sprout_mod' },
    { kind: 'block', type: 'sprout_log' },
    { kind: 'block', type: 'sprout_floor' },
    { kind: 'block', type: 'sprout_ceil' },
    { kind: 'block', type: 'sprout_round' },
    { kind: 'block', type: 'sprout_max' },
    { kind: 'block', type: 'sprout_min' },
    { kind: 'block', type: 'sprout_random' },
    { kind: 'block', type: 'sprout_pi' },
```

- [ ] **Step 2: Run tests**

```
pnpm test
```

Expected: all tests pass (no new tests — toolbox is IDE-only).

- [ ] **Step 3: Commit**

```
git add apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(ide): add Math section to toolbox with all 15 math blocks"
```

---

## Done

After all three tasks, users can:
- Use `sin(x)`, `cos(x)`, `tan(x)` etc. in any Sprout expression (text editor or blocks)
- Drag math blocks from the Math section of the toolbox
- Write programs like `forward(sin(step) * 100)` for spiral animations
