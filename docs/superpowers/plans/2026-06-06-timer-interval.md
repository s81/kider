# Custom Timer Interval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let kids write `on timer every 500 do...end` to control how fast the timer fires, instead of being locked to a hardcoded 200ms.

**Architecture:** Extend `OnExpr` with `interval: Expr | null`. The parser handles both old `:timer` form (backward compat) and new `timer [every N]` form. The interpreter evaluates the interval at registration and surfaces `timerInterval: number` through `interpretFull`. The IDE reads it instead of the hardcoded constant. A dedicated `sprout_on_timer` block replaces the "timer" option in `sprout_on_event`.

**Tech Stack:** TypeScript, Blockly 10, Vitest/bun test, React/Vite

---

## File Map

| File | Change |
|------|--------|
| `packages/lang/src/ast.ts` | Add `interval: Expr | null` to `OnExpr` |
| `packages/lang/src/serializer.ts` | Update `OnExpr` case to emit `on timer every N` when interval present |
| `packages/lang/src/interpreter.ts` | Add `_timerInterval`, update `evalStmtWithEnv`, update `interpretFull` return type |
| `packages/parser/src/parser.ts` | Add `on timer [every N] do...end` parsing path; fix existing `OnExpr` literal |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_on_timer` block; remove `timer` from `sprout_on_event` dropdown |
| `packages/blocks/src/compiler.ts` | Fix `compileOnExpr` (add `interval: null`); add `sprout_on_timer` case + function |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_on_timer` to toolbox |
| `apps/ide/src/App.tsx` | Use `result.timerInterval` for `setInterval`; update badge |
| `packages/lang/tests/interpreter.test.ts` | Update `onExpr` builder; add `timerInterval` tests |
| `packages/lang/tests/serializer.test.ts` | Update `onExpr` builder; add timer-interval serialization test |
| `packages/parser/tests/parser.test.ts` | Update `onE` builder; add new timer parsing tests |
| `packages/blocks/tests/compiler.test.ts` | Update existing `OnExpr` assertions; add `sprout_on_timer` test |

---

### Task 1: Add `interval` to `OnExpr` and fix all existing usages

This task adds the new field to the AST and updates every file that creates an `OnExpr` literal, so the TypeScript build stays green throughout the remaining tasks. No behavior changes yet.

**Files:**
- Modify: `packages/lang/src/ast.ts`
- Modify: `packages/lang/src/serializer.ts`
- Modify: `packages/lang/tests/serializer.test.ts`
- Modify: `packages/parser/src/parser.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`
- Modify: `packages/parser/tests/parser.test.ts`
- Modify: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Add `interval` to `OnExpr` in `packages/lang/src/ast.ts`**

Replace the existing `OnExpr` interface (lines 83–90):

```typescript
/** Event handler: `on :<event> do ... end` or `on timer every N do ... end` */
export interface OnExpr {
  readonly kind: 'OnExpr';
  readonly event: SymbolLit;
  readonly body: BlockExpr;
  readonly interval: Expr | null;  // null = default (200ms); only used for timer
}
```

- [ ] **Step 2: Update `OnExpr` case in serializer — `packages/lang/src/serializer.ts`**

Replace the existing `OnExpr` case (lines 75–79):

```typescript
case 'OnExpr': {
  const body = serializeBlock(expr.body, indentLevel + 1);
  if (expr.interval !== null) {
    const intervalStr = serializeExpr(expr.interval, indentLevel);
    return `on timer every ${intervalStr} do\n${body}\n${indent(indentLevel)}end`;
  }
  const eventStr = serializeExpr(expr.event, indentLevel);
  return `on ${eventStr} do\n${body}\n${indent(indentLevel)}end`;
}
```

- [ ] **Step 3: Update `onExpr` builder in serializer test — `packages/lang/tests/serializer.test.ts`**

Find the `onExpr` builder (near the top of the file, in the helpers section) and update it to accept an optional `interval` parameter:

```typescript
const onExpr = (event: string, bodyStmts: Stmt[], interval: Expr | null = null): Expr =>
  ({ kind: 'OnExpr', event: { kind: 'SymbolLit', name: event }, body: { kind: 'BlockExpr', body: bodyStmts }, interval });
```

Then add a new test inside the `describe('OnExpr')` block:

```typescript
it('serializes on timer every N do...end when interval is present', () => {
  const result = serializeExpr(
    onExpr('timer', [exprStmt(call('forward', [numLit(10)]))], numLit(500)),
  );
  expect(result).toBe('on timer every 500 do\n  forward(10)\nend');
});
```

- [ ] **Step 4: Fix existing `OnExpr` literal in parser — `packages/parser/src/parser.ts`**

Find the `on` branch in `parseAtom` (around line 255–261). Replace the return statement:

```typescript
if (name === 'on') {
  this.advance();
  const symTok = this.eat('SYMBOL') as { kind: 'SYMBOL'; name: string };
  const event = { kind: 'SymbolLit' as const, name: symTok.name };
  const body = this.parseDoBlock();
  return { kind: 'OnExpr', event, body, interval: null } satisfies OnExpr;
}
```

- [ ] **Step 5: Fix `compileOnExpr` in blocks compiler — `packages/blocks/src/compiler.ts`**

Find `compileOnExpr` (around line 263–269). Add `interval: null` to the return value:

```typescript
function compileOnExpr(block: Blockly.Block): OnExpr {
  const eventName = block.getFieldValue('EVENT') as string;
  const event: SymbolLit = { kind: 'SymbolLit', name: eventName };
  const firstBodyBlock = block.getInputTargetBlock('BODY');
  const body = compileBlockExpr(firstBodyBlock);
  return { kind: 'OnExpr', event, body, interval: null };
}
```

- [ ] **Step 6: Update `onExpr` builder in interpreter test — `packages/lang/tests/interpreter.test.ts`**

Find the `onExpr` builder (around line 486) and add `interval: null = null` parameter:

```typescript
const onExpr = (eventName: string, bodyStmts: Stmt[], interval: Expr | null = null): Expr => ({
  kind: 'OnExpr',
  event: { kind: 'SymbolLit', name: eventName },
  body: { kind: 'BlockExpr', body: bodyStmts },
  interval,
});
```

- [ ] **Step 7: Update `onE` builder in parser test — `packages/parser/tests/parser.test.ts`**

Find the `onE` builder (around line 19) and add `interval: null`:

```typescript
const onE = (name: string, body: object[]) =>
  ({ kind: 'OnExpr' as const, event: sym(name), body: blockE(body), interval: null });
```

- [ ] **Step 8: Update existing `OnExpr` assertions in blocks compiler test — `packages/blocks/tests/compiler.test.ts`**

Find the `describe('on event block — new events')` block. Its `toEqual` check expects an `OnExpr` shape — add `interval: null` to the expected `expr`:

```typescript
expr: {
  kind: 'OnExpr',
  event: { kind: 'SymbolLit', name: event },
  body: { kind: 'BlockExpr', body: [] },
  interval: null,
},
```

Also find the click-event fixture test (Fixture 5, around the `buildClickEventWorkspace` / `describe('click-event fixture')`) and add `interval: null` to its expected `OnExpr` shape.

- [ ] **Step 9: Run tests to verify all pass**

```
bun test
```

Expected: all existing tests pass. No new tests yet; just confirming the AST change compiles and existing behavior is preserved.

- [ ] **Step 10: Commit**

```
git add packages/lang/src/ast.ts packages/lang/src/serializer.ts packages/lang/tests/serializer.test.ts packages/parser/src/parser.ts packages/blocks/src/compiler.ts packages/lang/tests/interpreter.test.ts packages/parser/tests/parser.test.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(lang): add interval field to OnExpr AST node"
```

---

### Task 2: Interpreter — evaluate interval and expose `timerInterval` in `interpretFull`

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/tests/interpreter.test.ts`

- [ ] **Step 1: Write failing interpreter tests**

In `packages/lang/tests/interpreter.test.ts`, add a new `describe('on timer interval')` block after the existing `describe('interpretFull')` block:

```typescript
describe('on timer interval', () => {
  it('timerInterval defaults to 200 when no timer handler', () => {
    const prog = program(exprStmt(call('forward', [numLit(10)])));
    expect(interpretFull(prog).timerInterval).toBe(200);
  });

  it('timerInterval defaults to 200 when timer handler has null interval', () => {
    const prog = program(
      exprStmt(onExpr('timer', [exprStmt(call('forward', [numLit(10)]))])),
    );
    expect(interpretFull(prog).timerInterval).toBe(200);
  });

  it('timerInterval is set from on timer every N', () => {
    const prog = program(
      exprStmt(onExpr('timer', [exprStmt(call('forward', [numLit(10)]))], numLit(500))),
    );
    expect(interpretFull(prog).timerInterval).toBe(500);
  });

  it('timerInterval 1 is the minimum valid value', () => {
    const prog = program(
      exprStmt(onExpr('timer', [], numLit(1))),
    );
    expect(interpretFull(prog).timerInterval).toBe(1);
  });

  it('throws when interval is not a number', () => {
    const prog = program(
      exprStmt(onExpr('timer', [], { kind: 'StringLit', value: 'fast' } as Expr)),
    );
    expect(() => interpretFull(prog)).toThrow('on timer: interval must be a positive number, got string');
  });

  it('throws when interval is zero', () => {
    const prog = program(
      exprStmt(onExpr('timer', [], numLit(0))),
    );
    expect(() => interpretFull(prog)).toThrow('on timer: interval must be a positive number, got 0');
  });

  it('throws when interval is negative', () => {
    const prog = program(
      exprStmt(onExpr('timer', [], numLit(-100))),
    );
    expect(() => interpretFull(prog)).toThrow('on timer: interval must be a positive number, got -100');
  });

  it('non-timer events do not affect timerInterval', () => {
    const prog = program(
      exprStmt(onExpr('click', [exprStmt(call('forward', [numLit(10)]))])),
    );
    expect(interpretFull(prog).timerInterval).toBe(200);
  });
});
```

Make sure `Expr` is in the type import from `'../src/ast.js'` (it already should be).

- [ ] **Step 2: Run tests to verify they fail**

```
bun test packages/lang
```

Expected: FAIL — `timerInterval` does not exist on `interpretFull`'s return type.

- [ ] **Step 3: Add `_timerInterval` module-level mutable in `packages/lang/src/interpreter.ts`**

After the existing `let _hudValues` line (around line 86), add:

```typescript
// Module-level timer interval — set during interpretFull when on timer every N is registered.
let _timerInterval: number = 200;
```

- [ ] **Step 4: Reset `_timerInterval` in `interpret()` and `interpretFull()`**

In `interpret()` (around line 1163), add the reset alongside `_hudValues`:

```typescript
export function interpret(program: Program, initialEnv: Env = EMPTY_ENV): Drawing {
  _hudValues = new Map();
  _timerInterval = 200;
  // ... rest unchanged
```

In `interpretFull()` (around line 1194), do the same:

```typescript
export function interpretFull(
  program: Program,
  initialEnv: Env = EMPTY_ENV,
): { drawing: Drawing; handlers: Map<string, SproutFunction>; hud: Record<string, string>; variables: Record<string, string>; timerInterval: number } {
  _hudValues = new Map();
  _timerInterval = 200;
  // ... rest unchanged
```

- [ ] **Step 5: Evaluate interval in `evalStmtWithEnv` when registering a timer `OnExpr`**

In `evalStmtWithEnv`, find the `OnExpr` handling block (around line 1062). Update it to evaluate and validate the interval:

```typescript
if (stmt.expr.kind === 'OnExpr') {
  const onExpr = stmt.expr;
  // Evaluate custom timer interval if present.
  if (onExpr.event.name === 'timer' && onExpr.interval !== null) {
    const val = evalExpr(onExpr.interval, env);
    if (val.kind !== 'number' || val.value <= 0) {
      throw new SproutRuntimeError(
        `on timer: interval must be a positive number, got ${
          val.kind === 'number' ? val.value : val.kind
        }`
      );
    }
    _timerInterval = val.value;
  }
  const key = ':' + onExpr.event.name;
  const handler: SproutFunction = {
    kind: 'function',
    params: [],
    body: onExpr.body,
    env,
  };
  const newEnv = envExtend(env, [[key, handler]]);
  return [null, newEnv];
}
```

- [ ] **Step 6: Add `timerInterval` to `interpretFull`'s return value**

In `interpretFull`, update the return statement (around line 1213):

```typescript
return {
  drawing: drawings.length === 0 ? EMPTY : mkSequence(drawings),
  handlers,
  hud: Object.fromEntries(_hudValues),
  variables: extractVariables(env),
  timerInterval: _timerInterval,
};
```

- [ ] **Step 7: Run tests to verify they pass**

```
bun test packages/lang
```

Expected: all lang tests pass including the new `on timer interval` suite.

- [ ] **Step 8: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/interpreter.test.ts
git commit -m "feat(lang): add timerInterval to interpretFull — evaluates on timer every N interval"
```

---

### Task 3: Parser — `on timer [every N] do...end`

**Files:**
- Modify: `packages/parser/src/parser.ts`
- Modify: `packages/parser/tests/parser.test.ts`

- [ ] **Step 1: Write failing parser tests**

In `packages/parser/tests/parser.test.ts`, add to the existing `describe('parse — on event')` block (or add a new `describe('parse — on timer')` block after it):

```typescript
describe('parse — on timer (new ident form)', () => {
  it('parses on timer do...end with null interval', () => {
    expect(parse('on timer do\n  forward(10)\nend')).toEqual(
      prog(exprS(onE('timer', [exprS(callE('forward', [num(10)]))])))
    );
  });

  it('parses on timer every 500 do...end', () => {
    expect(parse('on timer every 500 do\n  forward(10)\nend')).toEqual(
      prog(exprS({
        kind: 'OnExpr' as const,
        event: sym('timer'),
        interval: num(500),
        body: blockE([exprS(callE('forward', [num(10)]))]),
      }))
    );
  });

  it('parses on timer every expr do...end (expression as interval)', () => {
    const result = parse('on timer every 100 do\n  forward(1)\nend');
    const expr = (result.stmts[0] as { expr: { interval: { value: number } } }).expr;
    expect(expr.interval).toEqual(num(100));
  });

  it('on :timer do...end (old symbol form) still parses with null interval', () => {
    const result = parse('on :timer do\n  forward(10)\nend');
    const expr = (result.stmts[0] as { expr: { kind: string; interval: unknown } }).expr;
    expect(expr.kind).toBe('OnExpr');
    expect(expr.interval).toBeNull();
  });
});
```

Make sure `ForEachExpr` is still in the import (it already is). `num` here refers to the `num` builder already in the test file (creates `NumberLit`).

- [ ] **Step 2: Run tests to verify they fail**

```
bun test packages/parser
```

Expected: FAIL — `on timer` without a colon throws a ParseError.

- [ ] **Step 3: Add `on timer [every N] do...end` parsing path in `packages/parser/src/parser.ts`**

In `parseAtom`, find the existing `on` branch (around line 255). Replace it with the new version that handles both the old symbol form and the new ident form:

```typescript
if (name === 'on') {
  this.advance();
  // New ident form: on timer [every N] do...end
  if (this.checkIdent('timer')) {
    this.advance(); // consume 'timer'
    let interval: Expr | null = null;
    if (this.checkIdent('every')) {
      this.advance(); // consume 'every'
      const prevNoBlock = this.noBlockCall;
      this.noBlockCall = true;
      interval = this.parseExpr();
      this.noBlockCall = prevNoBlock;
    }
    const event = { kind: 'SymbolLit' as const, name: 'timer' };
    const body = this.parseDoBlock();
    return { kind: 'OnExpr', event, body, interval } satisfies OnExpr;
  }
  // Old symbol form: on :event do...end
  const symTok = this.eat('SYMBOL') as { kind: 'SYMBOL'; name: string };
  const event = { kind: 'SymbolLit' as const, name: symTok.name };
  const body = this.parseDoBlock();
  return { kind: 'OnExpr', event, body, interval: null } satisfies OnExpr;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
bun test packages/parser
```

Expected: all parser tests pass including the new timer parsing suite.

- [ ] **Step 5: Commit**

```
git add packages/parser/src/parser.ts packages/parser/tests/parser.test.ts
git commit -m "feat(parser): add on timer every N parsing — supports custom timer interval"
```

---

### Task 4: Blocks + IDE — `sprout_on_timer` block and wire up App.tsx

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `apps/ide/src/BlockWorkspace.tsx`
- Modify: `apps/ide/src/App.tsx`
- Modify: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write failing blocks compiler test**

In `packages/blocks/tests/compiler.test.ts`, add after the existing `describe('on event block — new events')` block:

```typescript
describe('on timer block', () => {
  it('sprout_on_timer compiles to OnExpr with interval', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_on_timer');
    block.setFieldValue('500', 'INTERVAL');
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];
    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'ExprStmt',
      expr: {
        kind: 'OnExpr',
        event: { kind: 'SymbolLit', name: 'timer' },
        interval: { kind: 'NumberLit', value: 500 },
        body: { kind: 'BlockExpr', body: [] },
      },
    });
  });

  it('sprout_on_timer with default 200 interval', () => {
    const ws = makeWorkspace();
    const block = ws.newBlock('sprout_on_timer');
    // FieldNumber default is 200, no setFieldValue needed
    (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];
    const result = compileWorkspace(ws);
    const expr = (result.stmts[0] as { expr: { interval: { value: number } } }).expr;
    expect(expr.interval).toEqual({ kind: 'NumberLit', value: 200 });
  });
});
```

Also update `describe('on event block — new events')` to remove `'timer'` from the `NEW_EVENTS` array, since `sprout_on_event` will no longer offer a timer option:

```typescript
const NEW_EVENTS = ['left', 'right', 'up', 'down', 'space'] as const;
```

- [ ] **Step 2: Run tests to verify the new tests fail**

```
bun test packages/blocks
```

Expected: FAIL — `sprout_on_timer` block type is unknown.

- [ ] **Step 3: Add `sprout_on_timer` block to `packages/blocks/src/definitions/statements.ts`**

After the existing `sprout_on_event` block definition (around line 197), add:

```typescript
Blockly.Blocks['sprout_on_timer'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('on timer every')
      .appendField(new Blockly.FieldNumber(200, 1) as unknown as Blockly.Field, 'INTERVAL')
      .appendField('ms');
    this.appendStatementInput('BODY').appendField('do');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(65);
  },
};
```

Also remove `['timer', 'timer'],` from the `sprout_on_event` dropdown options (around line 189).

- [ ] **Step 4: Add `sprout_on_timer` to compiler — `packages/blocks/src/compiler.ts`**

In `compileStmt`, add `case 'sprout_on_timer':` to the fall-through list alongside `sprout_on_event` (around line 37):

```typescript
case 'sprout_on_event':
case 'sprout_on_timer':
```

In `compileExprBlock`, add a new case for `sprout_on_timer` (after the `sprout_on_event` case, around line 173):

```typescript
case 'sprout_on_event':
  return compileOnExpr(block);
case 'sprout_on_timer':
  return compileOnTimerExpr(block);
```

Add a new `compileOnTimerExpr` function after `compileOnExpr` (around line 270):

```typescript
function compileOnTimerExpr(block: Blockly.Block): OnExpr {
  const interval = Number(block.getFieldValue('INTERVAL'));
  return {
    kind: 'OnExpr',
    event: { kind: 'SymbolLit', name: 'timer' },
    interval: { kind: 'NumberLit', value: interval },
    body: compileBlockExpr(block.getInputTargetBlock('BODY')),
  };
}
```

- [ ] **Step 5: Run blocks tests**

```
bun test packages/blocks
```

Expected: all blocks tests pass including the new `on timer block` suite.

- [ ] **Step 6: Add `sprout_on_timer` to toolbox in `apps/ide/src/BlockWorkspace.tsx`**

Find the Events section of the toolbox (where `sprout_on_event` appears). Add `sprout_on_timer` alongside it:

```typescript
{ kind: 'block', type: 'sprout_on_event' },
{ kind: 'block', type: 'sprout_on_timer' },
```

- [ ] **Step 7: Wire `timerInterval` into App.tsx**

In `apps/ide/src/App.tsx`:

**a)** Remove the `TIMER_INTERVAL_MS` constant (line 24):
```typescript
// DELETE: const TIMER_INTERVAL_MS = 200;
```

**b)** Add `timerIntervalMs` state near the other state declarations (around line 40):
```typescript
const [timerIntervalMs, setTimerIntervalMs] = useState<number>(200);
```

**c)** In the `useEffect` where `interpretFullWithInputs` is called (around line 180), destructure `timerInterval` from the result and save it to state:
```typescript
const { drawing, handlers: h, hud: newHud, variables: newVars, timerInterval } = interpretFullWithInputs(program, inputMap);
accDrawingRef.current = drawing;
handlersRef.current = h;
setHandlers(h);
setCommands(render(drawing));
setHud(newHud);
setVariables(newVars);
setTimerIntervalMs(timerInterval);
```

**d)** In the `setInterval` call (around line 202), replace `TIMER_INTERVAL_MS` with `timerInterval`:
```typescript
timerRef.current = setInterval(() => {
  // ... body unchanged
}, timerInterval);
```

**e)** In the status badge (around line 473), replace `TIMER_INTERVAL_MS` with `timerIntervalMs`:
```typescript
handlers.has(':timer') ? `timer active (${timerIntervalMs}ms)` : '',
```

- [ ] **Step 8: Run full test suite**

```
bun test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts apps/ide/src/BlockWorkspace.tsx apps/ide/src/App.tsx packages/blocks/tests/compiler.test.ts
git commit -m "feat(ide): add sprout_on_timer block and wire timerInterval into App"
```
