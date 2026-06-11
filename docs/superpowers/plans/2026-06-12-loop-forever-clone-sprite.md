# Loop Forever & Clone Sprite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `loop forever do...end` (60fps game loop sugar) and `cloneSprite(name)` (sprite duplication returning the clone name) to the Sprout language, blocks, and IDE.

**Architecture:** Both features follow the existing AST → parser → interpreter → serializer → blocks pipeline. `LoopForeverExpr` is a new AST node handled identically to `on timer every 16`. `cloneSprite` is a new builtin that copies sprite state and returns the clone's auto-generated name.

**IMPORTANT — exhaustiveness constraint:** `evalExpr` (interpreter.ts:1084) and `serializeExpr` (serializer.ts:131) both end with `const _never: never = expr` exhaustiveness checks. The moment `LoopForeverExpr` joins the `Expr` union, BOTH files fail typecheck until they handle the new kind. Task 1 therefore lands AST + interpreter + serializer together in one commit.

**Tech Stack:** TypeScript, Vitest, Blockly. Run `npm test` from repo root after each commit.

---

## File Map

| File | Change |
|---|---|
| `packages/lang/src/ast.ts` | Add `LoopForeverExpr` interface + add to `Expr` union |
| `packages/lang/src/index.ts` | Export `LoopForeverExpr` type |
| `packages/lang/src/interpreter.ts` | `evalExpr` throw-case; `evalStmtWithEnv` ExprStmt handling; `walkExpr` case in `collectInputNames`; `_cloneCounters`; `cloneSprite` builtin |
| `packages/lang/src/serializer.ts` | Serialize `LoopForeverExpr` |
| `packages/parser/src/parser.ts` | Parse `loop forever do...end` |
| `packages/blocks/src/compiler.ts` | Handle `sprout_loop_forever`, `sprout_clone_sprite` |
| `packages/blocks/src/decompiler.ts` | Route `LoopForeverExpr`; add `cloneSprite` to `SPRITE_EXPR_BLOCKS` |
| `packages/blocks/src/definitions/statements.ts` | `sprout_loop_forever` block definition |
| `packages/blocks/src/definitions/sprites.ts` | `sprout_clone_sprite` block definition |
| `apps/ide/src/BlockWorkspace.tsx` | Toolbox entries for both new blocks |
| `apps/ide/src/examples.ts` | Bouncing Ball uses `loop forever` |
| `packages/lang/tests/loop-forever.test.ts` | New: interpreter + serializer tests (hand-built ASTs) |
| `packages/lang/tests/clone-sprite.test.ts` | New: cloneSprite tests |
| `packages/parser/tests/loop-forever.test.ts` | New: parse + round-trip tests |
| `packages/blocks/tests/compiler.test.ts` | `sprout_loop_forever` round-trip test |
| `packages/blocks/tests/sprites.test.ts` | `sprout_clone_sprite` round-trip test |

Convention note: `packages/lang/tests/` never imports the parser — those tests hand-build AST nodes (see `sprites.test.ts` for the pattern). Parse-dependent tests live in `packages/parser/tests/`.

---

### Task 1: `LoopForeverExpr` in the lang package (AST + interpreter + serializer, one commit)

**Files:**
- Modify: `packages/lang/src/ast.ts`
- Modify: `packages/lang/src/index.ts`
- Modify: `packages/lang/src/interpreter.ts`
- Modify: `packages/lang/src/serializer.ts`
- Test: `packages/lang/tests/loop-forever.test.ts`

- [ ] **Step 1: Add the interface to `packages/lang/src/ast.ts`**

After the `ForEachExpr` interface (ends around line 126), insert:

```ts
/** `loop forever do ... end` — registers a ~60fps timer loop; stops with stopTimer() */
export interface LoopForeverExpr {
  readonly kind: 'LoopForeverExpr';
  readonly body: BlockExpr;
  /** 1-based source line; set by the text parser, absent for block-built ASTs. */
  readonly line?: number;
}
```

- [ ] **Step 2: Add `LoopForeverExpr` to the `Expr` union in ast.ts**

```ts
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
  | FillExpr
  | OnExpr
  | IfExpr
  | WhileExpr
  | ForEachExpr
  | LoopForeverExpr;
```

- [ ] **Step 3: Export the type from `packages/lang/src/index.ts`**

In the AST type-export block, after `ForEachExpr,` add:

```ts
  LoopForeverExpr,
```

- [ ] **Step 4: Add the expression-position throw in `evalExpr` (interpreter.ts)**

`evalOn` (line 1360) already throws for `OnExpr` in expression position. Mirror it: in `evalExpr`'s switch, after `case 'WhileExpr': return evalWhile(expr, env);` (line 1082) and before the `default:` block, insert:

```ts
    case 'LoopForeverExpr':
      throw new SproutRuntimeError('loop forever may only appear as a top-level statement');
```

- [ ] **Step 5: Handle statement position in `evalStmtWithEnv` (interpreter.ts)**

Inside `case 'ExprStmt':`, directly after the `if (stmt.expr.kind === 'OnExpr') { ... return [null, newEnv]; }` block (ends around line 1403), insert:

```ts
      if (stmt.expr.kind === 'LoopForeverExpr') {
        _timerInterval = 16;
        const handler: SproutFunction = {
          kind: 'function',
          params: [],
          body: stmt.expr.body,
          env,
        };
        const newEnv = envExtend(env, [[':timer', handler]]);
        return [null, newEnv];
      }
```

- [ ] **Step 6: Walk the body in `collectInputNames`'s `walkExpr` (interpreter.ts)**

The `walkExpr` switch (around line 1630) handles `OnExpr` with `walkBlock(expr.body); break;`. Without a matching case, `input()`/`textInput()` calls inside a `loop forever` body would not be collected and the IDE would never prompt for them. After the `case 'OnExpr':` case, insert:

```ts
      case 'LoopForeverExpr':
        walkBlock(expr.body);
        break;
```

(This switch has no `never` check, so the compiler won't remind you — do not skip this step.)

- [ ] **Step 7: Add the serializer case (serializer.ts)**

In `serializeExpr`'s switch, after the `case 'OnExpr':` block (ends around line 109), insert:

```ts
    case 'LoopForeverExpr': {
      const body = serializeBlock(expr.body, indentLevel + 1);
      return `loop forever do\n${body}\n${indent(indentLevel)}end`;
    }
```

- [ ] **Step 8: Write the tests (hand-built ASTs, no parser import)**

Create `packages/lang/tests/loop-forever.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { interpretFull, collectInputNames, SproutRuntimeError } from '../src/interpreter.js';
import { serialize } from '../src/serializer.js';
import type { Program, Stmt, Expr, LoopForeverExpr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

const loopForeverExpr = (...stmts: Stmt[]): LoopForeverExpr => ({
  kind: 'LoopForeverExpr',
  body: { kind: 'BlockExpr', body: stmts },
});

describe('loop forever interpreter', () => {
  it('registers a :timer handler', () => {
    const { handlers } = interpretFull(prog(
      exprStmt(loopForeverExpr(exprStmt(call('forward', [numLit(10)])))),
    ));
    expect(handlers.has(':timer')).toBe(true);
    expect(handlers.get(':timer')!.kind).toBe('function');
    expect(handlers.get(':timer')!.params).toHaveLength(0);
  });

  it('sets timerInterval to 16', () => {
    const { timerInterval } = interpretFull(prog(
      exprStmt(loopForeverExpr(exprStmt(call('forward', [numLit(10)])))),
    ));
    expect(timerInterval).toBe(16);
  });

  it('produces no immediate drawing output', () => {
    const { drawing } = interpretFull(prog(
      exprStmt(loopForeverExpr(exprStmt(call('forward', [numLit(10)])))),
    ));
    expect(drawing).toEqual({ kind: 'empty' });
  });

  it('throws when used in expression position', () => {
    const letStmt: Stmt = { kind: 'LetStmt', name: 'x', init: loopForeverExpr() };
    expect(() => interpretFull(prog(letStmt))).toThrow(SproutRuntimeError);
  });

  it('collectInputNames finds input() inside the body', () => {
    const names = collectInputNames(prog(
      exprStmt(loopForeverExpr(exprStmt(call('input', [strLit('speed')])))),
    ));
    expect(names).toContain('speed');
  });
});

describe('loop forever serializer', () => {
  it('serializes to loop forever do...end', () => {
    const text = serialize(prog(
      exprStmt(loopForeverExpr(exprStmt(call('forward', [numLit(10)])))),
    ));
    expect(text).toBe('loop forever do\n  forward(10)\nend');
  });
});
```

Note: if the `drawing` assertion `{ kind: 'empty' }` fails because `EMPTY` has a different shape, import `EMPTY` from `../src/values.js` and compare with `toEqual(EMPTY)` instead.

- [ ] **Step 9: Run tests and typecheck**

```bash
npm test 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

Expected: all tests pass, no type errors.

- [ ] **Step 10: Commit**

```bash
git add packages/lang/src/ast.ts packages/lang/src/index.ts packages/lang/src/interpreter.ts packages/lang/src/serializer.ts packages/lang/tests/loop-forever.test.ts
git commit -m "feat(lang): LoopForeverExpr — AST node, interpreter (timerInterval=16), serializer"
```

---

### Task 2: Parse `loop forever do...end`

**Files:**
- Modify: `packages/parser/src/parser.ts`
- Test: `packages/parser/tests/loop-forever.test.ts`

Context: The parser's IDENT dispatch (around line 268) checks `name === 'repeat'`, `name === 'while'`, `name === 'on'`, `name === 'for'` in sequence. The parser imports AST types from `@sprout/lang` — check the existing import at the top of parser.ts and follow its exact form.

- [ ] **Step 1: Add `LoopForeverExpr` to the parser's AST type import**

Find the `import type { ... } from '@sprout/lang'` (or equivalent path) at the top of `packages/parser/src/parser.ts` and add `LoopForeverExpr` to the imported names.

- [ ] **Step 2: Add the parse branch**

After the `if (name === 'on') { ... }` block (ends around line 312) and before `if (name === 'for') {`, insert:

```ts
      if (name === 'loop') {
        this.advance();
        this.eatIdent('forever');
        const body = this.parseDoBlock();
        return { kind: 'LoopForeverExpr', body } satisfies LoopForeverExpr;
      }
```

- [ ] **Step 3: Write the failing tests**

Create `packages/parser/tests/loop-forever.test.ts`. The round-trip test imports `serialize` via the `@sprout/lang` alias (resolved by the root `vitest.config.ts`, same as the blocks tests do); the serializer case already exists from Task 1, so the whole file goes green at once:

```ts
import { describe, it, expect } from 'vitest';
import { serialize } from '@sprout/lang';
import { parse } from '../src/index.js';

describe('loop forever parsing', () => {
  it('parses loop forever do...end', () => {
    const prog = parse('loop forever do\n  forward(10)\nend');
    expect(prog.stmts).toHaveLength(1);
    const stmt = prog.stmts[0];
    expect(stmt.kind).toBe('ExprStmt');
    if (stmt.kind !== 'ExprStmt') return;
    expect(stmt.expr.kind).toBe('LoopForeverExpr');
    if (stmt.expr.kind !== 'LoopForeverExpr') return;
    expect(stmt.expr.body.body).toHaveLength(1);
  });

  it('rejects loop 5 do (wrong keyword after loop)', () => {
    expect(() => parse('loop 5 do\n  forward(10)\nend')).toThrow();
  });

  it('round-trips through parse → serialize', () => {
    const src = 'loop forever do\n  forward(10)\nend';
    expect(serialize(parse(src))).toBe(src);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/parser/src/parser.ts packages/parser/tests/loop-forever.test.ts
git commit -m "feat(parser): parse loop forever do...end"
```

---

### Task 3: `cloneSprite` builtin

**Files:**
- Modify: `packages/lang/src/interpreter.ts`
- Test: `packages/lang/tests/clone-sprite.test.ts`

Context: The `_sprites` map (line 170) is cleared via `_sprites.clear()` in exactly three places: `interpret()`, `interpretFull()`, and `interpretValue()` — search for every occurrence. A new `_cloneCounters` map must be declared next to `_sprites` and cleared at every one of those sites.

- [ ] **Step 1: Add `_cloneCounters` module-level state**

After `const _sprites = new Map<string, SpriteState>();` (line 170), add:

```ts
// Per-base-name clone counters for cloneSprite() — reset alongside _sprites.
const _cloneCounters = new Map<string, number>();
```

- [ ] **Step 2: Clear `_cloneCounters` at every reset site**

Search for every `_sprites.clear();` in interpreter.ts and add `_cloneCounters.clear();` on the next line at each occurrence:

```ts
  _sprites.clear();
  _cloneCounters.clear();
```

- [ ] **Step 3: Add the `cloneSprite` builtin**

In the `BUILTINS` map, after the `'bounceSprite'` entry (ends around line 635), insert:

```ts
  ['cloneSprite', (args) => {
    if (args.length !== 1)
      throw new SproutRuntimeError(`cloneSprite expects 1 argument, got ${args.length}`);
    const name = assertString(args[0], 'cloneSprite');
    const s = _sprites.get(name.value);
    if (!s) throw new SproutRuntimeError(`cloneSprite: no sprite named '${name.value}'`);
    const n = (_cloneCounters.get(name.value) ?? 0) + 1;
    _cloneCounters.set(name.value, n);
    const cloneName = `${name.value}-${n}`;
    _sprites.set(cloneName, { ...s });
    return { kind: 'string' as const, value: cloneName };
  }],
```

- [ ] **Step 4: Write the failing tests**

Create `packages/lang/tests/clone-sprite.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { interpretFull, SproutRuntimeError } from '../src/interpreter.js';
import type { Program, Stmt, Expr } from '../src/ast.js';

const numLit = (value: number): Expr => ({ kind: 'NumberLit', value });
const strLit = (value: string): Expr => ({ kind: 'StringLit', value });
const call = (callee: string, args: Expr[]): Expr =>
  ({ kind: 'CallExpr', callee, args, block: null });
const exprStmt = (expr: Expr): Stmt => ({ kind: 'ExprStmt', expr });
const letStmt = (name: string, init: Expr): Stmt =>
  ({ kind: 'LetStmt', name, init });
const prog = (...stmts: Stmt[]): Program => ({ kind: 'Program', stmts });

const mkSprite = (name: string): Stmt =>
  exprStmt(call('sprite', [strLit(name), call('circle', [numLit(15)])]));

describe('cloneSprite', () => {
  it('clone name is "<base>-1" for first clone', () => {
    const { variables } = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    expect(variables['c']).toBe('ball-1');
  });

  it('second clone is "<base>-2"', () => {
    const { variables } = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c1', call('cloneSprite', [strLit('ball')])),
      letStmt('c2', call('cloneSprite', [strLit('ball')])),
    ));
    expect(variables['c1']).toBe('ball-1');
    expect(variables['c2']).toBe('ball-2');
  });

  it('clone inherits position and heading from original', () => {
    const { sprites } = interpretFull(prog(
      mkSprite('ball'),
      exprStmt(call('gotoSprite', [strLit('ball'), numLit(30), numLit(-40)])),
      exprStmt(call('turnSprite', [strLit('ball'), numLit(90)])),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    const clone = sprites.find(s => s.name === 'ball-1');
    expect(clone).toBeDefined();
    expect(clone!.x).toBe(30);
    expect(clone!.y).toBe(-40);
    expect(clone!.heading).toBe(90);
    expect(clone!.visible).toBe(true);
  });

  it('clone is independent — moving it does not move the original', () => {
    const { sprites } = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
      exprStmt(call('gotoSprite', [strLit('ball-1'), numLit(100), numLit(100)])),
    ));
    const original = sprites.find(s => s.name === 'ball')!;
    const clone = sprites.find(s => s.name === 'ball-1')!;
    expect(original.x).toBe(0);
    expect(clone.x).toBe(100);
  });

  it('clone appears in interpretFull sprite snapshots', () => {
    const { sprites } = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    expect(sprites.map(s => s.name)).toEqual(['ball', 'ball-1']);
  });

  it('throws on unknown sprite', () => {
    expect(() => interpretFull(prog(
      letStmt('c', call('cloneSprite', [strLit('ghost')])),
    ))).toThrow(SproutRuntimeError);
  });

  it('throws on wrong arity', () => {
    expect(() => interpretFull(prog(
      letStmt('c', call('cloneSprite', [])),
    ))).toThrow(SproutRuntimeError);
  });

  it('counter resets between runs', () => {
    const first = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    expect(first.variables['c']).toBe('ball-1');
    const second = interpretFull(prog(
      mkSprite('ball'),
      letStmt('c', call('cloneSprite', [strLit('ball')])),
    ));
    expect(second.variables['c']).toBe('ball-1');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/lang/src/interpreter.ts packages/lang/tests/clone-sprite.test.ts
git commit -m "feat(lang): cloneSprite builtin — duplicates sprite, returns clone name"
```

---

### Task 4: `sprout_loop_forever` block (definition + compiler + decompiler)

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/src/decompiler.ts`
- Test: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Add block definition to `statements.ts`**

In `registerStatementBlocks()`, after the `sprout_on_timer` definition (ends around line 266), insert:

```ts
  Blockly.Blocks['sprout_loop_forever'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('loop forever');
      this.appendStatementInput('BODY').appendField('do');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('Repeat the body forever at ~60fps. Use stop timer to stop.');
    },
  };
```

- [ ] **Step 2: Add `LoopForeverExpr` to the compiler's type import**

In `packages/blocks/src/compiler.ts`, the import from `'@sprout/lang'` lists AST types. Add `LoopForeverExpr`:

```ts
  BlockExpr, RepeatExpr, FillExpr, OnExpr, IfExpr, WhileExpr, ForEachExpr, LoopForeverExpr, SymbolLit, BoolLit, StringLit,
```

- [ ] **Step 3: Add the statement fall-through case in `compileStmt`**

In the big fall-through case list ending with `return { kind: 'ExprStmt', expr: compileExprBlock(block) };`, add a line next to `case 'sprout_on_timer':`:

```ts
    case 'sprout_on_timer':
    case 'sprout_loop_forever':
```

- [ ] **Step 4: Add the `compileExprBlock` case**

After `case 'sprout_on_timer': return compileOnTimerExpr(block);` (around line 205), insert:

```ts
    case 'sprout_loop_forever':
      return {
        kind: 'LoopForeverExpr',
        body: compileBlockExpr(block.getInputTargetBlock('BODY')),
      } satisfies LoopForeverExpr;
```

- [ ] **Step 5: Handle `LoopForeverExpr` in the decompiler**

In `packages/blocks/src/decompiler.ts`:

(a) Add `LoopForeverExpr` to the type import from `'@sprout/lang'`:

```ts
  BlockExpr, RepeatExpr, FillExpr, OnExpr, IfExpr, WhileExpr, ForEachExpr, LoopForeverExpr,
```

(b) In `decompileExprStmt`'s switch, after `case 'OnExpr': return decompileOn(ws, expr);`, add:

```ts
    case 'LoopForeverExpr':
      return decompileLoopForever(ws, expr);
```

(c) After the `decompileOn` function, add:

```ts
function decompileLoopForever(ws: Blockly.Workspace, expr: LoopForeverExpr): Blockly.Block {
  const block = ws.newBlock('sprout_loop_forever');
  connectBody(ws, block, 'BODY', expr.body.body);
  return block;
}
```

- [ ] **Step 6: Write round-trip tests in `packages/blocks/tests/compiler.test.ts`**

`decompileProgram` may or may not be imported in this file already — check the imports at the top and add `import { decompileProgram } from '../src/decompiler.js';` if missing. Then append:

```ts
describe('sprout_loop_forever round-trips', () => {
  function buildLoopForeverWorkspace(ws: Blockly.Workspace): void {
    const loopBlock = ws.newBlock('sprout_loop_forever');
    const fwdBlock = ws.newBlock('sprout_forward');
    const dist = ws.newBlock('sprout_number');
    dist.setFieldValue('5', 'NUM');
    fwdBlock.getInput('DISTANCE')!.connection!.connect(dist.outputConnection!);
    loopBlock.getInput('BODY')!.connection!.connect(fwdBlock.previousConnection!);
  }

  it('compiles sprout_loop_forever → LoopForeverExpr', () => {
    const ws = makeWorkspace();
    buildLoopForeverWorkspace(ws);
    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'ExprStmt',
      expr: {
        kind: 'LoopForeverExpr',
        body: {
          kind: 'BlockExpr',
          body: [{
            kind: 'ExprStmt',
            expr: { kind: 'CallExpr', callee: 'forward', args: [{ kind: 'NumberLit', value: 5 }], block: null },
          }],
        },
      },
    });
  });

  it('decompiles LoopForeverExpr → sprout_loop_forever with body intact', () => {
    const source = makeWorkspace();
    buildLoopForeverWorkspace(source);
    const ast = compileWorkspace(source);

    const target = makeWorkspace();
    decompileProgram(target, ast);
    const top = target.getTopBlocks(true)[0];
    expect(top.type).toBe('sprout_loop_forever');
    expect(top.getInputTargetBlock('BODY')?.type).toBe('sprout_forward');
    // Round-trip: recompiling yields the identical AST
    expect(compileWorkspace(target)).toEqual(ast);
  });
});
```

- [ ] **Step 7: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/blocks/src/definitions/statements.ts packages/blocks/src/compiler.ts packages/blocks/src/decompiler.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): sprout_loop_forever block with compiler and decompiler"
```

---

### Task 5: `sprout_clone_sprite` block (definition + compiler + decompiler)

**Files:**
- Modify: `packages/blocks/src/definitions/sprites.ts`
- Modify: `packages/blocks/src/compiler.ts`
- Modify: `packages/blocks/src/decompiler.ts`
- Test: `packages/blocks/tests/sprites.test.ts`

- [ ] **Step 1: Add block definition to `sprites.ts`**

In `registerSpriteBlocks()`, after the `sprout_bounce_sprite` definition, add:

```ts
  Blockly.Blocks['sprout_clone_sprite'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('clone sprite')
        .appendField(nameField(), 'NAME');
      this.setOutput(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Create a copy of a sprite and return its name as a string');
    },
  };
```

- [ ] **Step 2: Add the `compileExprBlock` case in compiler.ts**

After `case 'sprout_sprite_y': return spriteCall(block, 'spriteY', []);` (around line 672), add:

```ts
    case 'sprout_clone_sprite':
      return spriteCall(block, 'cloneSprite', []);
```

- [ ] **Step 3: Add `cloneSprite` to `SPRITE_EXPR_BLOCKS` in decompiler.ts**

```ts
const SPRITE_EXPR_BLOCKS: Record<string, SpriteBlockSpec> = {
  spriteX:         { type: 'sprout_sprite_x',         fields: ['NAME'], inputs: [] },
  spriteY:         { type: 'sprout_sprite_y',         fields: ['NAME'], inputs: [] },
  spritesTouching: { type: 'sprout_sprites_touching', fields: ['NAME_A', 'NAME_B'], inputs: [] },
  cloneSprite:     { type: 'sprout_clone_sprite',     fields: ['NAME'], inputs: [] },
};
```

- [ ] **Step 4: Write round-trip tests in `packages/blocks/tests/sprites.test.ts`**

`parse` is already imported at the top of this file (`import { parse } from '@sprout/parser';`) — verify, and add it if missing. Then at the end of the file, add:

```ts
describe('sprout_clone_sprite round-trips', () => {
  it('compiles sprout_clone_sprite inside sprout_let → LetStmt { init: cloneSprite("cat") }', () => {
    const ws = makeWorkspace();
    const letBlock = ws.newBlock('sprout_let');
    letBlock.setFieldValue('c', 'NAME');
    const cloneBlock = ws.newBlock('sprout_clone_sprite');
    cloneBlock.setFieldValue('cat', 'NAME');
    letBlock.getInput('INIT')!.connection!.connect(cloneBlock.outputConnection!);

    const result = compileWorkspace(ws);
    expect(result.stmts[0]).toEqual({
      kind: 'LetStmt',
      name: 'c',
      init: {
        kind: 'CallExpr',
        callee: 'cloneSprite',
        args: [{ kind: 'StringLit', value: 'cat' }],
        block: null,
      },
    });
  });

  it('decompiles cloneSprite("cat") → sprout_clone_sprite', () => {
    const ast = parse('let c = cloneSprite("cat")');
    const ws = makeWorkspace();
    decompileProgram(ws, ast);
    const top = ws.getTopBlocks(true)[0];
    expect(top.type).toBe('sprout_let');
    const initBlock = top.getInputTargetBlock('INIT');
    expect(initBlock?.type).toBe('sprout_clone_sprite');
    expect(initBlock?.getFieldValue('NAME')).toBe('cat');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/blocks/src/definitions/sprites.ts packages/blocks/src/compiler.ts packages/blocks/src/decompiler.ts packages/blocks/tests/sprites.test.ts
git commit -m "feat(blocks): sprout_clone_sprite expression block with compiler and decompiler"
```

---

### Task 6: Toolbox + Bouncing Ball example

**Files:**
- Modify: `apps/ide/src/BlockWorkspace.tsx`
- Modify: `apps/ide/src/examples.ts`

- [ ] **Step 1: Add `sprout_loop_forever` to the Control category in `BlockWorkspace.tsx`**

In the Control category contents array, add it as the first entry, above `sprout_repeat`:

```ts
    {
      kind: 'category', name: 'Control', colour: '120',
      contents: [
        { kind: 'block', type: 'sprout_loop_forever' },
        { kind: 'block', type: 'sprout_repeat' },
```

- [ ] **Step 2: Add `sprout_clone_sprite` to the Sprites category**

After the `sprout_bounce_sprite` entry:

```ts
        { kind: 'block', type: 'sprout_bounce_sprite' },
        { kind: 'block', type: 'sprout_clone_sprite' },
```

- [ ] **Step 3: Update the Bouncing Ball example in `examples.ts`**

Replace the Bouncing Ball entry's code (currently `on timer every 30 do`):

```ts
  {
    name: 'Bouncing Ball',
    code: `# A ball bouncing around the stage
hideTurtle()
sprite("ball", circle(20))
turnSprite("ball", 45)

loop forever do
  clearCanvas()
  moveSprite("ball", 5)
  bounceSprite("ball")
end`,
  },
```

- [ ] **Step 4: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass — `apps/ide/tests/examples.test.ts` parses, interprets, and round-trips every example, so it exercises the whole new pipeline end-to-end.

- [ ] **Step 5: Commit**

```bash
git add apps/ide/src/BlockWorkspace.tsx apps/ide/src/examples.ts
git commit -m "feat(ide): loop forever and clone sprite in toolbox; Bouncing Ball uses loop forever"
```
