# Phase 2 — packages/blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `packages/blocks` — Blockly block definitions, a compiler (workspace → Phase 1 AST), and a generator (workspace → display text) — so all 5 example programs can be expressed as Blockly workspaces whose compiler output deep-equals the hand-built Phase 1 fixtures.

**Architecture:** Block definitions register shapes with Blockly using `Blockly.Blocks['type']`. The compiler traverses the workspace block graph to produce a `Program` AST that exactly matches the Phase 1 fixture types. The generator wraps the existing `@sprout/lang` serializer, so text correctness is inherited from Phase 1.

**Tech Stack:** `blockly` (v10+), `@sprout/lang` (workspace), TypeScript strict NodeNext, Vitest, pnpm.

---

## File Map

```
packages/blocks/
  package.json                     — add blockly dep
  src/
    definitions/
      statements.ts                — Blockly.Blocks registrations for statement blocks
      values.ts                    — Blockly.Blocks registrations for value blocks
      index.ts                     — imports both; call once to register everything
    compiler.ts                    — compileWorkspace(ws) → Program
    generator.ts                   — generateText(ws) → string
    index.ts                       — public re-exports
  tests/
    compiler.test.ts               — 5 fixtures × deep-equal AST check
    generator.test.ts              — 5 fixtures × string-equal expectedText check
```

---

### Task 1: Add Blockly dependency and verify headless import

**Files:**
- Modify: `packages/blocks/package.json`
- Modify: `packages/blocks/src/index.ts`

- [ ] **Step 1: Add blockly to packages/blocks/package.json**

Replace the file with:

```json
{
  "name": "@sprout/blocks",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --project tsconfig.json --noEmit"
  },
  "dependencies": {
    "@sprout/lang": "workspace:*",
    "blockly": "^10.4.3"
  }
}
```

- [ ] **Step 2: Install the new dependency**

Run from the repo root:
```
pnpm install
```

Expected: pnpm resolves `blockly@^10.4.3` and installs it. No errors.

- [ ] **Step 3: Write a smoke-test to confirm blockly/node works headless**

Create `packages/blocks/tests/smoke.test.ts`:

```ts
import * as Blockly from 'blockly/node';
import { describe, it, expect } from 'vitest';

describe('blockly headless', () => {
  it('can create a workspace and a block without DOM', () => {
    const ws = new Blockly.Workspace();
    // Register a minimal block so newBlock doesn't throw
    Blockly.Blocks['test_noop'] = { init() { /* empty */ } };
    const block = ws.newBlock('test_noop');
    expect(block).toBeDefined();
    ws.dispose();
  });
});
```

- [ ] **Step 4: Run the smoke test**

```
pnpm test packages/blocks/tests/smoke.test.ts
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```
git add packages/blocks/package.json packages/blocks/tests/smoke.test.ts pnpm-lock.yaml
git commit -m "chore(blocks): add blockly dep; smoke-test headless workspace"
```

---

### Task 2: Block definitions — statement blocks

**Files:**
- Create: `packages/blocks/src/definitions/statements.ts`

Statement blocks have previous/next connections. They map to `Stmt` nodes (or `ExprStmt` wrapping an expression).

- [ ] **Step 1: Create packages/blocks/src/definitions/statements.ts**

```ts
import * as Blockly from 'blockly/node';

export function registerStatementBlocks(): void {
  Blockly.Blocks['sprout_forward'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DISTANCE').setCheck('Number').appendField('forward');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_turn'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DEGREES').setCheck('Number').appendField('turn');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_pen_up'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('pen up');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_pen_down'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('pen down');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_puts'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALUE').appendField('puts');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
    },
  };

  Blockly.Blocks['sprout_repeat'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('COUNT').setCheck('Number').appendField('repeat');
      this.appendStatementInput('BODY').appendField('do');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
    },
  };

  Blockly.Blocks['sprout_on_event'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('on')
        .appendField(
          new Blockly.FieldDropdown([
            ['click', 'click'],
            ['load', 'load'],
            ['keydown', 'keydown'],
          ]),
          'EVENT',
        );
      this.appendStatementInput('BODY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(65);
    },
  };

  // def name(param0, param1, param2) — up to 3 params (empty string = absent)
  Blockly.Blocks['sprout_def'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('def')
        .appendField(new Blockly.FieldTextInput('myFunc'), 'NAME');
      this.appendDummyInput()
        .appendField('params:')
        .appendField(new Blockly.FieldTextInput(''), 'PARAM0')
        .appendField(new Blockly.FieldTextInput(''), 'PARAM1')
        .appendField(new Blockly.FieldTextInput(''), 'PARAM2');
      this.appendStatementInput('BODY');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
    },
  };

  // Generic function call as statement: callee(arg0, arg1) — up to 2 args
  Blockly.Blocks['sprout_call_stmt'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('func'), 'CALLEE');
      this.appendValueInput('ARG0').setCheck(null);
      this.appendValueInput('ARG1').setCheck(null);
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(210);
    },
  };

  // beside(left, right) as a top-level statement
  Blockly.Blocks['sprout_beside'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck(null).appendField('beside(');
      this.appendValueInput('RIGHT').setCheck(null).appendField(',');
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };

  // above(top, bottom) as a top-level statement
  Blockly.Blocks['sprout_above'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TOP').setCheck(null).appendField('above(');
      this.appendValueInput('BOTTOM').setCheck(null).appendField(',');
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };

  // scale(factor, drawing) as a top-level statement
  Blockly.Blocks['sprout_scale'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('FACTOR').setCheck('Number').appendField('scale(');
      this.appendValueInput('DRAWING').setCheck(null).appendField(',');
      this.appendDummyInput().appendField(')');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
    },
  };
}
```

- [ ] **Step 2: Commit**

```
git add packages/blocks/src/definitions/statements.ts
git commit -m "feat(blocks): register statement block shapes with Blockly"
```

---

### Task 3: Block definitions — value blocks

**Files:**
- Create: `packages/blocks/src/definitions/values.ts`
- Create: `packages/blocks/src/definitions/index.ts`

Value blocks have an output connection. They map to `Expr` nodes.

- [ ] **Step 1: Create packages/blocks/src/definitions/values.ts**

```ts
import * as Blockly from 'blockly/node';

export function registerValueBlocks(): void {
  Blockly.Blocks['sprout_number'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(0), 'NUM');
      this.setOutput(true, 'Number');
      this.setColour(230);
    },
  };

  Blockly.Blocks['sprout_ident'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('n'), 'NAME');
      this.setOutput(true, null);
      this.setColour(330);
    },
  };

  // Function call that produces a value (e.g., square(), polygon(6, 80) used as expression)
  // Up to 2 positional args; leave ARG0/ARG1 unconnected for zero-arg calls.
  Blockly.Blocks['sprout_call_expr'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('func'), 'CALLEE');
      this.appendValueInput('ARG0').setCheck(null);
      this.appendValueInput('ARG1').setCheck(null);
      this.setOutput(true, null);
      this.setInputsInline(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks['sprout_infix'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('LEFT').setCheck('Number');
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([['+', '+'], ['-', '-'], ['*', '*'], ['/', '/']]),
        'OP',
      );
      this.appendValueInput('RIGHT').setCheck('Number');
      this.setOutput(true, 'Number');
      this.setInputsInline(true);
      this.setColour(230);
    },
  };
}
```

- [ ] **Step 2: Create packages/blocks/src/definitions/index.ts**

```ts
import { registerStatementBlocks } from './statements.js';
import { registerValueBlocks } from './values.js';

let registered = false;

export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  registerStatementBlocks();
  registerValueBlocks();
}
```

- [ ] **Step 3: Verify definitions compile (typecheck only)**

```
pnpm --filter @sprout/blocks typecheck
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```
git add packages/blocks/src/definitions/values.ts packages/blocks/src/definitions/index.ts
git commit -m "feat(blocks): register value block shapes (number, ident, call_expr, infix)"
```

---

### Task 4: Compiler — workspace → Program AST

**Files:**
- Create: `packages/blocks/src/compiler.ts`
- Create: `packages/blocks/tests/compiler.test.ts`

The compiler traverses Blockly's block graph and produces a `Program` that deep-equals the Phase 1 hand-built fixtures.

- [ ] **Step 1: Write the failing tests**

Create `packages/blocks/tests/compiler.test.ts`:

```ts
import * as Blockly from 'blockly/node';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllBlocks } from '../src/definitions/index.js';
import { compileWorkspace } from '../src/compiler.js';
import { program as squareProgram } from '../../examples/square.fixture.js';
import { program as polygonProgram } from '../../examples/polygon.fixture.js';
import { program as besideProgram } from '../../examples/beside.fixture.js';
import { program as repeatProgram } from '../../examples/repeat-loop.fixture.js';
import { program as clickProgram } from '../../examples/click-event.fixture.js';

beforeAll(() => {
  registerAllBlocks();
});

function makeWorkspace(): Blockly.Workspace {
  return new Blockly.Workspace();
}

// ---------------------------------------------------------------------------
// Fixture 1: square — repeat 4 do forward(100); turn(90) end
// ---------------------------------------------------------------------------
function buildSquareWorkspace(ws: Blockly.Workspace): void {
  const repeatBlock = ws.newBlock('sprout_repeat');
  const count4 = ws.newBlock('sprout_number');
  count4.setFieldValue('4', 'NUM');
  repeatBlock.getInput('COUNT')!.connection!.connect(count4.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const fwd100 = ws.newBlock('sprout_number');
  fwd100.setFieldValue('100', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd100.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const turn90 = ws.newBlock('sprout_number');
  turn90.setFieldValue('90', 'NUM');
  turnBlock.getInput('DEGREES')!.connection!.connect(turn90.outputConnection!);

  repeatBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 2: polygon — def polygon(sides, size) + polygon(6, 80)
// ---------------------------------------------------------------------------
function buildPolygonWorkspace(ws: Blockly.Workspace): void {
  const defBlock = ws.newBlock('sprout_def');
  defBlock.setFieldValue('polygon', 'NAME');
  defBlock.setFieldValue('sides', 'PARAM0');
  defBlock.setFieldValue('size', 'PARAM1');

  const repeatBlock = ws.newBlock('sprout_repeat');
  const sidesCount = ws.newBlock('sprout_ident');
  sidesCount.setFieldValue('sides', 'NAME');
  repeatBlock.getInput('COUNT')!.connection!.connect(sidesCount.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const sizeIdent = ws.newBlock('sprout_ident');
  sizeIdent.setFieldValue('size', 'NAME');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(sizeIdent.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const infixBlock = ws.newBlock('sprout_infix');
  const n360 = ws.newBlock('sprout_number');
  n360.setFieldValue('360', 'NUM');
  const sidesIdent2 = ws.newBlock('sprout_ident');
  sidesIdent2.setFieldValue('sides', 'NAME');
  infixBlock.setFieldValue('/', 'OP');
  infixBlock.getInput('LEFT')!.connection!.connect(n360.outputConnection!);
  infixBlock.getInput('RIGHT')!.connection!.connect(sidesIdent2.outputConnection!);
  turnBlock.getInput('DEGREES')!.connection!.connect(infixBlock.outputConnection!);

  repeatBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
  defBlock.getInput('BODY')!.connection!.connect(repeatBlock.previousConnection!);

  const callBlock = ws.newBlock('sprout_call_stmt');
  callBlock.setFieldValue('polygon', 'CALLEE');
  const arg6 = ws.newBlock('sprout_number');
  arg6.setFieldValue('6', 'NUM');
  const arg80 = ws.newBlock('sprout_number');
  arg80.setFieldValue('80', 'NUM');
  callBlock.getInput('ARG0')!.connection!.connect(arg6.outputConnection!);
  callBlock.getInput('ARG1')!.connection!.connect(arg80.outputConnection!);

  defBlock.nextConnection!.connect(callBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 3: beside — def square + beside(square(), square())
// ---------------------------------------------------------------------------
function buildBesideWorkspace(ws: Blockly.Workspace): void {
  const defBlock = ws.newBlock('sprout_def');
  defBlock.setFieldValue('square', 'NAME');
  // no params — PARAM0/PARAM1/PARAM2 stay empty string

  const repeatBlock = ws.newBlock('sprout_repeat');
  const count4 = ws.newBlock('sprout_number');
  count4.setFieldValue('4', 'NUM');
  repeatBlock.getInput('COUNT')!.connection!.connect(count4.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const fwd100 = ws.newBlock('sprout_number');
  fwd100.setFieldValue('100', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd100.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const turn90 = ws.newBlock('sprout_number');
  turn90.setFieldValue('90', 'NUM');
  turnBlock.getInput('DEGREES')!.connection!.connect(turn90.outputConnection!);

  repeatBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
  defBlock.getInput('BODY')!.connection!.connect(repeatBlock.previousConnection!);

  const besideBlock = ws.newBlock('sprout_beside');
  const sq1 = ws.newBlock('sprout_call_expr');
  sq1.setFieldValue('square', 'CALLEE');
  const sq2 = ws.newBlock('sprout_call_expr');
  sq2.setFieldValue('square', 'CALLEE');
  besideBlock.getInput('LEFT')!.connection!.connect(sq1.outputConnection!);
  besideBlock.getInput('RIGHT')!.connection!.connect(sq2.outputConnection!);

  defBlock.nextConnection!.connect(besideBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 4: repeat-loop — repeat 8 do forward(60); turn(45) end
// ---------------------------------------------------------------------------
function buildRepeatLoopWorkspace(ws: Blockly.Workspace): void {
  const repeatBlock = ws.newBlock('sprout_repeat');
  const count8 = ws.newBlock('sprout_number');
  count8.setFieldValue('8', 'NUM');
  repeatBlock.getInput('COUNT')!.connection!.connect(count8.outputConnection!);

  const fwdBlock = ws.newBlock('sprout_forward');
  const fwd60 = ws.newBlock('sprout_number');
  fwd60.setFieldValue('60', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd60.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const turn45 = ws.newBlock('sprout_number');
  turn45.setFieldValue('45', 'NUM');
  turnBlock.getInput('DEGREES')!.connection!.connect(turn45.outputConnection!);

  repeatBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Fixture 5: click-event — on :click do forward(20); turn(15) end
// ---------------------------------------------------------------------------
function buildClickEventWorkspace(ws: Blockly.Workspace): void {
  const onBlock = ws.newBlock('sprout_on_event');
  onBlock.setFieldValue('click', 'EVENT');

  const fwdBlock = ws.newBlock('sprout_forward');
  const fwd20 = ws.newBlock('sprout_number');
  fwd20.setFieldValue('20', 'NUM');
  fwdBlock.getInput('DISTANCE')!.connection!.connect(fwd20.outputConnection!);

  const turnBlock = ws.newBlock('sprout_turn');
  const turn15 = ws.newBlock('sprout_number');
  turn15.setFieldValue('15', 'NUM');
  turnBlock.getInput('DEGREES')!.connection!.connect(turn15.outputConnection!);

  onBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  fwdBlock.nextConnection!.connect(turnBlock.previousConnection!);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('compileWorkspace', () => {
  it('compiles square fixture', () => {
    const ws = makeWorkspace();
    buildSquareWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(squareProgram);
    ws.dispose();
  });

  it('compiles polygon fixture', () => {
    const ws = makeWorkspace();
    buildPolygonWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(polygonProgram);
    ws.dispose();
  });

  it('compiles beside fixture', () => {
    const ws = makeWorkspace();
    buildBesideWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(besideProgram);
    ws.dispose();
  });

  it('compiles repeat-loop fixture', () => {
    const ws = makeWorkspace();
    buildRepeatLoopWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(repeatProgram);
    ws.dispose();
  });

  it('compiles click-event fixture', () => {
    const ws = makeWorkspace();
    buildClickEventWorkspace(ws);
    expect(compileWorkspace(ws)).toEqual(clickProgram);
    ws.dispose();
  });
});
```

- [ ] **Step 2: Run the failing tests to confirm they fail for the right reason**

```
pnpm test packages/blocks/tests/compiler.test.ts
```

Expected: FAIL with "Cannot find module '../src/compiler.js'"

- [ ] **Step 3: Implement packages/blocks/src/compiler.ts**

```ts
import * as Blockly from 'blockly/node';
import type {
  Program, Stmt, Expr,
  DefStmt, ExprStmt,
  NumberLit, Ident, InfixExpr, CallExpr,
  BlockExpr, RepeatExpr, OnExpr, SymbolLit,
} from '@sprout/lang';

export function compileWorkspace(ws: Blockly.Workspace): Program {
  const stmts: Stmt[] = [];
  for (const top of ws.getTopBlocks(true)) {
    let current: Blockly.Block | null = top;
    while (current) {
      stmts.push(compileStmt(current));
      current = current.getNextBlock();
    }
  }
  return { kind: 'Program', stmts };
}

function compileStmt(block: Blockly.Block): Stmt {
  switch (block.type) {
    case 'sprout_def':
      return compileDef(block);
    case 'sprout_forward':
    case 'sprout_turn':
    case 'sprout_pen_up':
    case 'sprout_pen_down':
    case 'sprout_puts':
    case 'sprout_repeat':
    case 'sprout_on_event':
    case 'sprout_call_stmt':
    case 'sprout_beside':
    case 'sprout_above':
    case 'sprout_scale':
      return { kind: 'ExprStmt', expr: compileExprBlock(block) };
    default:
      throw new Error(`Unknown statement block type: ${block.type}`);
  }
}

function compileDef(block: Blockly.Block): DefStmt {
  const name = block.getFieldValue('NAME') as string;
  const rawParams = [
    block.getFieldValue('PARAM0') as string,
    block.getFieldValue('PARAM1') as string,
    block.getFieldValue('PARAM2') as string,
  ].filter(p => p.trim() !== '');
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileDefBody(firstBodyBlock);
  return { kind: 'DefStmt', name, params: rawParams, body };
}

/**
 * A def body is compiled as:
 * - A single sprout_repeat block (no next) → RepeatExpr directly
 *   (matches the Phase 1 fixture structure where def body = RepeatExpr)
 * - Otherwise → BlockExpr wrapping all statements
 */
function compileDefBody(firstBlock: Blockly.Block | null): Expr {
  if (!firstBlock) {
    return { kind: 'BlockExpr', body: [] };
  }
  if (firstBlock.type === 'sprout_repeat' && firstBlock.getNextBlock() === null) {
    return compileRepeatExpr(firstBlock);
  }
  return compileBlockExpr(firstBlock);
}

function compileBlockExpr(firstBlock: Blockly.Block | null): BlockExpr {
  const stmts: Stmt[] = [];
  let cur: Blockly.Block | null = firstBlock;
  while (cur) {
    stmts.push(compileStmt(cur));
    cur = cur.getNextBlock();
  }
  return { kind: 'BlockExpr', body: stmts };
}

function compileExprBlock(block: Blockly.Block): Expr {
  switch (block.type) {
    case 'sprout_forward': {
      const dist = compileExpr(mustGetInput(block, 'DISTANCE'));
      return { kind: 'CallExpr', callee: 'forward', args: [dist], block: null };
    }
    case 'sprout_turn': {
      const deg = compileExpr(mustGetInput(block, 'DEGREES'));
      return { kind: 'CallExpr', callee: 'turn', args: [deg], block: null };
    }
    case 'sprout_pen_up':
      return { kind: 'CallExpr', callee: 'penUp', args: [], block: null };
    case 'sprout_pen_down':
      return { kind: 'CallExpr', callee: 'penDown', args: [], block: null };
    case 'sprout_puts': {
      const val = compileExpr(mustGetInput(block, 'VALUE'));
      return { kind: 'CallExpr', callee: 'puts', args: [val], block: null };
    }
    case 'sprout_repeat':
      return compileRepeatExpr(block);
    case 'sprout_on_event':
      return compileOnExpr(block);
    case 'sprout_call_stmt':
      return compileCallFromBlock(block);
    case 'sprout_beside': {
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      return { kind: 'CallExpr', callee: 'beside', args: [left, right], block: null };
    }
    case 'sprout_above': {
      const top = compileExpr(mustGetInput(block, 'TOP'));
      const bottom = compileExpr(mustGetInput(block, 'BOTTOM'));
      return { kind: 'CallExpr', callee: 'above', args: [top, bottom], block: null };
    }
    case 'sprout_scale': {
      const factor = compileExpr(mustGetInput(block, 'FACTOR'));
      const drawing = compileExpr(mustGetInput(block, 'DRAWING'));
      return { kind: 'CallExpr', callee: 'scale', args: [factor, drawing], block: null };
    }
    default:
      throw new Error(`Block type cannot be compiled as expression: ${block.type}`);
  }
}

function compileRepeatExpr(block: Blockly.Block): RepeatExpr {
  const count = compileExpr(mustGetInput(block, 'COUNT'));
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileBlockExpr(firstBodyBlock);
  return { kind: 'RepeatExpr', count, body };
}

function compileOnExpr(block: Blockly.Block): OnExpr {
  const eventName = block.getFieldValue('EVENT') as string;
  const event: SymbolLit = { kind: 'SymbolLit', name: eventName };
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileBlockExpr(firstBodyBlock);
  return { kind: 'OnExpr', event, body };
}

function compileCallFromBlock(block: Blockly.Block): CallExpr {
  const callee = block.getFieldValue('CALLEE') as string;
  const args: Expr[] = [];
  const arg0 = block.getInputTargetBlock('ARG0');
  if (arg0) args.push(compileExpr(arg0));
  const arg1 = block.getInputTargetBlock('ARG1');
  if (arg1) args.push(compileExpr(arg1));
  return { kind: 'CallExpr', callee, args, block: null };
}

function compileExpr(block: Blockly.Block): Expr {
  switch (block.type) {
    case 'sprout_number': {
      const value = parseFloat(block.getFieldValue('NUM') as string);
      const lit: NumberLit = { kind: 'NumberLit', value };
      return lit;
    }
    case 'sprout_ident': {
      const name = block.getFieldValue('NAME') as string;
      const id: Ident = { kind: 'Ident', name };
      return id;
    }
    case 'sprout_infix': {
      const op = block.getFieldValue('OP') as '+' | '-' | '*' | '/';
      const left = compileExpr(mustGetInput(block, 'LEFT'));
      const right = compileExpr(mustGetInput(block, 'RIGHT'));
      const infix: InfixExpr = { kind: 'InfixExpr', op, left, right };
      return infix;
    }
    case 'sprout_call_expr':
      return compileCallExprValue(block);
    default:
      // Statement-typed blocks that also produce expressions (repeat, on, etc.)
      return compileExprBlock(block);
  }
}

function compileCallExprValue(block: Blockly.Block): CallExpr {
  const callee = block.getFieldValue('CALLEE') as string;
  const args: Expr[] = [];
  const arg0 = block.getInputTargetBlock('ARG0');
  if (arg0) args.push(compileExpr(arg0));
  const arg1 = block.getInputTargetBlock('ARG1');
  if (arg1) args.push(compileExpr(arg1));
  return { kind: 'CallExpr', callee, args, block: null };
}

function mustGetInput(block: Blockly.Block, inputName: string): Blockly.Block {
  const connected = block.getInputTargetBlock(inputName);
  if (!connected) {
    throw new Error(`Block ${block.type} missing required input "${inputName}"`);
  }
  return connected;
}
```

- [ ] **Step 4: Run the compiler tests**

```
pnpm test packages/blocks/tests/compiler.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```
git add packages/blocks/src/compiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): implement compiler — Blockly workspace → Program AST"
```

---

### Task 5: Generator and full integration

**Files:**
- Create: `packages/blocks/src/generator.ts`
- Create: `packages/blocks/tests/generator.test.ts`
- Modify: `packages/blocks/src/index.ts`

The generator compiles the workspace to a Program then calls the Phase 1 serializer. Text correctness is delegated entirely to `@sprout/lang`.

- [ ] **Step 1: Write the failing generator tests**

Create `packages/blocks/tests/generator.test.ts`:

```ts
import * as Blockly from 'blockly/node';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllBlocks } from '../src/definitions/index.js';
import { generateText } from '../src/generator.js';
import { expectedText as squareText } from '../../examples/square.fixture.js';
import { expectedText as polygonText } from '../../examples/polygon.fixture.js';
import { expectedText as besideText } from '../../examples/beside.fixture.js';
import { expectedText as repeatText } from '../../examples/repeat-loop.fixture.js';
import { expectedText as clickText } from '../../examples/click-event.fixture.js';

beforeAll(() => {
  registerAllBlocks();
});

// Re-use the same workspace builders from compiler.test.ts inline for isolation.
// (Each test file is independent — no shared module-level state between test files.)

function makeWs(): Blockly.Workspace { return new Blockly.Workspace(); }

function buildSquare(ws: Blockly.Workspace): void {
  const r = ws.newBlock('sprout_repeat');
  const c = ws.newBlock('sprout_number'); c.setFieldValue('4', 'NUM');
  r.getInput('COUNT')!.connection!.connect(c.outputConnection!);
  const f = ws.newBlock('sprout_forward');
  const f100 = ws.newBlock('sprout_number'); f100.setFieldValue('100', 'NUM');
  f.getInput('DISTANCE')!.connection!.connect(f100.outputConnection!);
  const t = ws.newBlock('sprout_turn');
  const t90 = ws.newBlock('sprout_number'); t90.setFieldValue('90', 'NUM');
  t.getInput('DEGREES')!.connection!.connect(t90.outputConnection!);
  r.getInput('BODY')!.connection!.connect(f.previousConnection!);
  f.nextConnection!.connect(t.previousConnection!);
}

function buildPolygon(ws: Blockly.Workspace): void {
  const def = ws.newBlock('sprout_def');
  def.setFieldValue('polygon', 'NAME');
  def.setFieldValue('sides', 'PARAM0');
  def.setFieldValue('size', 'PARAM1');
  const rep = ws.newBlock('sprout_repeat');
  const sc = ws.newBlock('sprout_ident'); sc.setFieldValue('sides', 'NAME');
  rep.getInput('COUNT')!.connection!.connect(sc.outputConnection!);
  const fwd = ws.newBlock('sprout_forward');
  const si = ws.newBlock('sprout_ident'); si.setFieldValue('size', 'NAME');
  fwd.getInput('DISTANCE')!.connection!.connect(si.outputConnection!);
  const trn = ws.newBlock('sprout_turn');
  const inf = ws.newBlock('sprout_infix'); inf.setFieldValue('/', 'OP');
  const n360 = ws.newBlock('sprout_number'); n360.setFieldValue('360', 'NUM');
  const si2 = ws.newBlock('sprout_ident'); si2.setFieldValue('sides', 'NAME');
  inf.getInput('LEFT')!.connection!.connect(n360.outputConnection!);
  inf.getInput('RIGHT')!.connection!.connect(si2.outputConnection!);
  trn.getInput('DEGREES')!.connection!.connect(inf.outputConnection!);
  rep.getInput('BODY')!.connection!.connect(fwd.previousConnection!);
  fwd.nextConnection!.connect(trn.previousConnection!);
  def.getInput('BODY')!.connection!.connect(rep.previousConnection!);
  const call = ws.newBlock('sprout_call_stmt'); call.setFieldValue('polygon', 'CALLEE');
  const a6 = ws.newBlock('sprout_number'); a6.setFieldValue('6', 'NUM');
  const a80 = ws.newBlock('sprout_number'); a80.setFieldValue('80', 'NUM');
  call.getInput('ARG0')!.connection!.connect(a6.outputConnection!);
  call.getInput('ARG1')!.connection!.connect(a80.outputConnection!);
  def.nextConnection!.connect(call.previousConnection!);
}

function buildBeside(ws: Blockly.Workspace): void {
  const def = ws.newBlock('sprout_def'); def.setFieldValue('square', 'NAME');
  const rep = ws.newBlock('sprout_repeat');
  const c4 = ws.newBlock('sprout_number'); c4.setFieldValue('4', 'NUM');
  rep.getInput('COUNT')!.connection!.connect(c4.outputConnection!);
  const fwd = ws.newBlock('sprout_forward');
  const f100 = ws.newBlock('sprout_number'); f100.setFieldValue('100', 'NUM');
  fwd.getInput('DISTANCE')!.connection!.connect(f100.outputConnection!);
  const trn = ws.newBlock('sprout_turn');
  const t90 = ws.newBlock('sprout_number'); t90.setFieldValue('90', 'NUM');
  trn.getInput('DEGREES')!.connection!.connect(t90.outputConnection!);
  rep.getInput('BODY')!.connection!.connect(fwd.previousConnection!);
  fwd.nextConnection!.connect(trn.previousConnection!);
  def.getInput('BODY')!.connection!.connect(rep.previousConnection!);
  const bd = ws.newBlock('sprout_beside');
  const sq1 = ws.newBlock('sprout_call_expr'); sq1.setFieldValue('square', 'CALLEE');
  const sq2 = ws.newBlock('sprout_call_expr'); sq2.setFieldValue('square', 'CALLEE');
  bd.getInput('LEFT')!.connection!.connect(sq1.outputConnection!);
  bd.getInput('RIGHT')!.connection!.connect(sq2.outputConnection!);
  def.nextConnection!.connect(bd.previousConnection!);
}

function buildRepeatLoop(ws: Blockly.Workspace): void {
  const rep = ws.newBlock('sprout_repeat');
  const c8 = ws.newBlock('sprout_number'); c8.setFieldValue('8', 'NUM');
  rep.getInput('COUNT')!.connection!.connect(c8.outputConnection!);
  const fwd = ws.newBlock('sprout_forward');
  const f60 = ws.newBlock('sprout_number'); f60.setFieldValue('60', 'NUM');
  fwd.getInput('DISTANCE')!.connection!.connect(f60.outputConnection!);
  const trn = ws.newBlock('sprout_turn');
  const t45 = ws.newBlock('sprout_number'); t45.setFieldValue('45', 'NUM');
  trn.getInput('DEGREES')!.connection!.connect(t45.outputConnection!);
  rep.getInput('BODY')!.connection!.connect(fwd.previousConnection!);
  fwd.nextConnection!.connect(trn.previousConnection!);
}

function buildClickEvent(ws: Blockly.Workspace): void {
  const on = ws.newBlock('sprout_on_event'); on.setFieldValue('click', 'EVENT');
  const fwd = ws.newBlock('sprout_forward');
  const f20 = ws.newBlock('sprout_number'); f20.setFieldValue('20', 'NUM');
  fwd.getInput('DISTANCE')!.connection!.connect(f20.outputConnection!);
  const trn = ws.newBlock('sprout_turn');
  const t15 = ws.newBlock('sprout_number'); t15.setFieldValue('15', 'NUM');
  trn.getInput('DEGREES')!.connection!.connect(t15.outputConnection!);
  on.getInput('BODY')!.connection!.connect(fwd.previousConnection!);
  fwd.nextConnection!.connect(trn.previousConnection!);
}

describe('generateText', () => {
  it('generates square text', () => {
    const ws = makeWs();
    buildSquare(ws);
    expect(generateText(ws)).toBe(squareText);
    ws.dispose();
  });

  it('generates polygon text', () => {
    const ws = makeWs();
    buildPolygon(ws);
    expect(generateText(ws)).toBe(polygonText);
    ws.dispose();
  });

  it('generates beside text', () => {
    const ws = makeWs();
    buildBeside(ws);
    expect(generateText(ws)).toBe(besideText);
    ws.dispose();
  });

  it('generates repeat-loop text', () => {
    const ws = makeWs();
    buildRepeatLoop(ws);
    expect(generateText(ws)).toBe(repeatText);
    ws.dispose();
  });

  it('generates click-event text', () => {
    const ws = makeWs();
    buildClickEvent(ws);
    expect(generateText(ws)).toBe(clickText);
    ws.dispose();
  });
});
```

- [ ] **Step 2: Run the failing tests**

```
pnpm test packages/blocks/tests/generator.test.ts
```

Expected: FAIL with "Cannot find module '../src/generator.js'"

- [ ] **Step 3: Implement packages/blocks/src/generator.ts**

```ts
import * as Blockly from 'blockly/node';
import { serialize } from '@sprout/lang';
import { compileWorkspace } from './compiler.js';

export function generateText(ws: Blockly.Workspace): string {
  const program = compileWorkspace(ws);
  return serialize(program);
}
```

- [ ] **Step 4: Update packages/blocks/src/index.ts**

```ts
export { registerAllBlocks } from './definitions/index.js';
export { compileWorkspace } from './compiler.js';
export { generateText } from './generator.js';
```

- [ ] **Step 5: Run all blocks tests**

```
pnpm test --project packages/blocks
```

Or more precisely:
```
pnpm test
```

Expected: all tests in `packages/lang` AND `packages/blocks` pass. Zero failures.

- [ ] **Step 6: Typecheck**

```
pnpm --filter @sprout/blocks typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```
git add packages/blocks/src/generator.ts packages/blocks/src/index.ts packages/blocks/tests/generator.test.ts
git commit -m "feat(blocks): implement generator and wire up public API"
```

---

### Task 6: Clean up smoke test and final verification

The smoke test (`packages/blocks/tests/smoke.test.ts`) was scaffolding; its `test_noop` block registration is now redundant. Remove it.

- [ ] **Step 1: Delete the smoke test**

Delete `packages/blocks/tests/smoke.test.ts`.

- [ ] **Step 2: Run the full test suite one final time**

```
pnpm test
```

Expected: `packages/lang` (15 tests) + `packages/blocks` (10 tests) all pass. No skips, no failures.

- [ ] **Step 3: Final commit**

```
git add -u packages/blocks/tests/smoke.test.ts
git commit -m "chore(blocks): remove bootstrap smoke test"
```

---

## Self-Review

### Spec coverage

| Requirement | Covered by |
|-------------|-----------|
| All 5 examples as block workspaces | Task 4 compiler tests + Task 5 generator tests |
| `compiler` output deep-equals Phase 1 fixtures | Task 4 |
| `generator` output string-equals fixture `expectedText` | Task 5 |
| `pnpm test` green across both packages | Task 6 final run |
| Zero `any` in TypeScript strict | `compiler.ts` uses typed imports; `blockly/node` types used throughout |

### Placeholder scan

No TBD, TODO, or "implement later" found. All code blocks are complete.

### Type consistency

- `compileWorkspace` → `Program` ✓
- `compileStmt` → `Stmt` ✓
- `compileExpr` → `Expr` ✓
- `compileBlockExpr` → `BlockExpr` ✓
- `compileRepeatExpr` → `RepeatExpr` ✓
- `compileOnExpr` → `OnExpr` ✓
- `generateText` → `string` ✓
- `registerAllBlocks` → `void` ✓
