# Loop Forever & Clone Sprite Design

## Goal

Add two language features: `loop forever do ... end` as ergonomic syntax for a 60fps game loop, and `cloneSprite(name)` to duplicate a sprite and return the clone's name.

## Architecture

Both features follow the existing language pipeline: AST → parser → interpreter → serializer → blocks compiler/decompiler. No new packages or cross-package dependencies. Tests live alongside each package.

---

## Feature 1: `loop forever do ... end`

### Syntax

```
loop forever do
  clearCanvas()
  moveSprite("ball", 5)
  bounceSprite("ball")
end
```

### Semantics

- Registers a `:timer` handler that fires every 16ms (~60fps).
- `stopTimer()` stops it — same as stopping any timer.
- Only one timer handler can be active at a time (existing constraint inherited from `on timer every N`).
- `loop forever` and `on timer every N` are mutually exclusive in a single program (same `:timer` slot).

### AST

New node in `packages/lang/src/ast.ts`:

```ts
export interface LoopForeverExpr {
  kind: 'LoopForeverExpr';
  body: Stmt[];
  line?: number;
}
```

Add `LoopForeverExpr` to the `Expr` union.

### Parser (`packages/parser/src/parser.ts`)

In the IDENT dispatch block, after the `on` branch:

```ts
if (name === 'loop') {
  this.advance();
  this.eatIdent('forever');
  const body = this.parseDoBlock();
  return { kind: 'LoopForeverExpr', body } satisfies LoopForeverExpr;
}
```

### Interpreter (`packages/lang/src/interpreter.ts`)

In the `ExprStmt` handler, after the `OnExpr` branch:

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

### Serializer (`packages/lang/src/serializer.ts`)

In the `serializeExpr` switch:

```ts
case 'LoopForeverExpr': {
  const body = expr.body.map(s => indent(indentLevel + 1) + serializeStmt(s, indentLevel + 1)).join('\n');
  return `loop forever do\n${body}\n${indent(indentLevel)}end`;
}
```

### Blocks definition (`packages/blocks/src/definitions/control.ts`)

```ts
Blockly.Blocks['sprout_loop_forever'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput().appendField('loop forever');
    this.appendStatementInput('BODY');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(120);
    this.setTooltip('Repeat forever at ~60fps. Use stopTimer() to stop.');
  },
};
```

Place in Control category in `BlockWorkspace.tsx`, above `sprout_on_timer`.

### Compiler (`packages/blocks/src/compiler.ts`)

Add to the statement fall-through group and the `compileExprBlock` dispatch:

```ts
case 'sprout_loop_forever': {
  const body = compileBody(block.getInputTargetBlock('BODY'));
  return { kind: 'LoopForeverExpr', body };
}
```

### Decompiler (`packages/blocks/src/decompiler.ts`)

In the `ExprStmt` handler (same location as `OnExpr`), add a branch for `LoopForeverExpr`:

```ts
if (expr.kind === 'LoopForeverExpr') {
  const block = ws.newBlock('sprout_loop_forever');
  decompileBody((expr as LoopForeverExpr).body, block, 'BODY', ws);
  return block;
}
```

### Example update (`apps/ide/src/examples.ts`)

Change Bouncing Ball from `on timer every 30 do` to `loop forever do`.

---

## Feature 2: `cloneSprite(name)` → string

### Syntax

```
let b = cloneSprite("ball")
moveSprite(b, 10)
bounceSprite(b)
```

### Semantics

- Copies sprite `name`'s current state (x, y, heading, costume, visible) into `_sprites` under an auto-generated key.
- Clone name format: `"<baseName>-<n>"` where n increments from 1 per base name per run. e.g. first clone of `"ball"` → `"ball-1"`, second → `"ball-2"`.
- Returns the clone's name as a `SproutString`.
- Throws `SproutRuntimeError` if the named sprite doesn't exist.
- Clone counter state lives in `_cloneCounters: Map<string, number>`, cleared at the start of each run alongside `_sprites`.

### Interpreter (`packages/lang/src/interpreter.ts`)

Module-level state (next to `_sprites`):

```ts
const _cloneCounters = new Map<string, number>();
```

Clear it in all three reset sites (`interpretFull`, `callHandler`, `interpret`):

```ts
_cloneCounters.clear();
```

Builtin (after `removeSprite`):

```ts
['cloneSprite', (args) => {
  if (args.length !== 1)
    throw new SproutRuntimeError(`cloneSprite expects 1 argument, got ${args.length}`);
  const s = getSprite(args[0], 'cloneSprite');
  const baseName = (args[0] as SproutString).value;
  const n = (_cloneCounters.get(baseName) ?? 0) + 1;
  _cloneCounters.set(baseName, n);
  const cloneName = `${baseName}-${n}`;
  _sprites.set(cloneName, { ...s });
  return mkString(cloneName);
}],
```

### Block definition (`packages/blocks/src/definitions/sprites.ts`)

`cloneSprite` is an expression (returns a value), used inside `sprout_let`:

```ts
Blockly.Blocks['sprout_clone_sprite'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('clone sprite')
      .appendField(nameField(), 'NAME');
    this.setOutput(true, null);
    this.setColour(SPRITE_COLOUR);
    this.setTooltip('Create a copy of a sprite and return its name');
  },
};
```

### Compiler (`packages/blocks/src/compiler.ts`)

```ts
case 'sprout_clone_sprite':
  return spriteCall(block, 'cloneSprite', []);
```

### Decompiler (`packages/blocks/src/decompiler.ts`)

```ts
cloneSprite: { type: 'sprout_clone_sprite', fields: ['NAME'], inputs: [] },
```

---

## Testing

**`packages/lang/tests/loop-forever.test.ts`** — new file:
- `loop forever` registers a `:timer` handler
- `interpretFull` result has `timerInterval === 16`
- `stopTimer()` works after `loop forever`
- Parser rejects `loop 5 do` (wrong keyword after loop)

**`packages/lang/tests/clone-sprite.test.ts`** — new file:
- Clone inherits x, y, heading, costume, visible
- Clone name is `"ball-1"` for first clone of `"ball"`
- Second clone of `"ball"` is `"ball-2"`
- Returns a string value
- Throws on unknown sprite
- Clones appear in `interpretFull` sprite snapshots
- Counter resets between runs

**`packages/blocks/tests/sprites.test.ts`** — add `cloneSprite` round-trip test

**`packages/blocks/tests/compiler.test.ts`** — add `sprout_loop_forever` compile test
