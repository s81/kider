# Five Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sprite rotation, toolbox categories, `bounceSprite` builtin + block, and a Bouncing Ball example to the Sprout IDE.

**Architecture:** Five independent changes applied in sequence: (1) fix `drawSprites` to rotate costumes around their centre using a compound canvas transform; (2) restructure the flat Blockly toolbox into collapsible named categories; (3) add `bounceSprite(name)` as a lang builtin with wall-clamping and heading reflection; (4) expose `bounceSprite` through a Blockly block, compiler case, and decompiler entry; (5) add a Bouncing Ball example that exercises the new builtin.

**Tech Stack:** TypeScript, Blockly, Vitest, canvas 2D API

> **Note on textInput:** `sprout_text_input` is already fully implemented (block definition in `packages/blocks/src/definitions/values.ts:130`, compiler at `packages/blocks/src/compiler.ts:538`, decompiler at `packages/blocks/src/decompiler.ts:439`, toolbox entry at `apps/ide/src/BlockWorkspace.tsx:97`). No work needed.

---

### Task 1: Sprite rotation

**Files:**
- Modify: `apps/ide/src/stage-utils.ts:298-312`
- Modify: `apps/ide/tests/stage-utils.test.ts:544-552`

The current `drawSprites` does `ctx.translate(s.x, s.y)` then `replayCommands`, which shifts the entire canvas by the sprite offset. Adding `ctx.rotate` there would rotate around the raw canvas origin, not the sprite centre. The fix is a three-transform sequence that rotates around the sprite's canvas position, then undoes the shift so `replayCommands`' `STAGE_W/2 + cmd.x` coordinates land correctly.

- [ ] **Step 1: Write the failing test**

Add this test to the `describe('drawSprites', ...)` block in `apps/ide/tests/stage-utils.test.ts`:

```ts
it('rotates costume around sprite centre by heading', () => {
  const ctx = makeShapeMockCtx();
  drawSprites(ctx, [snap({ name: 'cat', x: 10, y: -20, heading: 90 })]);
  // Compound transform: translate to canvas position, rotate, translate back
  expect(ctx.translate).toHaveBeenNthCalledWith(1, STAGE_W / 2 + 10, STAGE_H / 2 + (-20));
  expect(ctx.rotate).toHaveBeenNthCalledWith(1, 90 * Math.PI / 180);
  expect(ctx.translate).toHaveBeenNthCalledWith(2, -STAGE_W / 2, -STAGE_H / 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- stage-utils
```

Expected: FAIL — rotate assertion fails because `drawSprites` currently doesn't call `ctx.rotate`.

- [ ] **Step 3: Update existing translate test**

The existing `'translates to each sprite position in order'` test checks `ctx.translate` with `(10, -20)` and `(-5, 5)`. With the compound transform, translate is now called FOUR times (2 per sprite). Update it:

```ts
it('translates to each sprite position in order, save/restore balanced', () => {
  const ctx = makeShapeMockCtx();
  drawSprites(ctx, [
    snap({ name: 'cat', x: 10, y: -20 }),
    snap({ name: 'dog', x: -5, y: 5 }),
  ]);
  // Two translates per sprite: to canvas pos, then back-offset
  expect(ctx.translate).toHaveBeenNthCalledWith(1, STAGE_W / 2 + 10, STAGE_H / 2 - 20);
  expect(ctx.translate).toHaveBeenNthCalledWith(2, -STAGE_W / 2, -STAGE_H / 2);
  expect(ctx.translate).toHaveBeenNthCalledWith(3, STAGE_W / 2 - 5, STAGE_H / 2 + 5);
  expect(ctx.translate).toHaveBeenNthCalledWith(4, -STAGE_W / 2, -STAGE_H / 2);
  expect(calls(ctx.save).length).toBe(calls(ctx.restore).length);
});
```

- [ ] **Step 4: Implement the compound transform in `drawSprites`**

In `apps/ide/src/stage-utils.ts`, replace the body of the `ctx.save() … ctx.restore()` block inside `drawSprites`:

```ts
export function drawSprites(
  ctx: CanvasRenderingContext2D,
  sprites: readonly SpriteSnapshot[],
): void {
  for (const s of sprites) {
    if (!s.visible) continue;
    const cmds = render(s.costume).filter(
      c => c.kind !== 'clearCanvas' && c.kind !== 'fillBackground',
    );
    ctx.save();
    ctx.translate(STAGE_W / 2 + s.x, STAGE_H / 2 + s.y);
    ctx.rotate(s.heading * Math.PI / 180);
    ctx.translate(-STAGE_W / 2, -STAGE_H / 2);
    replayCommands(ctx, cmds, cmds.length);
    ctx.restore();
  }
}
```

- [ ] **Step 5: Run all tests**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add apps/ide/src/stage-utils.ts apps/ide/tests/stage-utils.test.ts
git commit -m "feat(ide): rotate sprite costumes around their centre by heading"
```

---

### Task 2: Toolbox categories

**Files:**
- Modify: `apps/ide/src/BlockWorkspace.tsx:5-140`

Change `kind: 'flyoutToolbox'` to `kind: 'categoryToolbox'` and wrap each group in a `{ kind: 'category', name, colour, contents }` object. The colour string is a hue (0–360) for the category header.

- [ ] **Step 1: No tests needed** — this is pure UI configuration with no logic.

- [ ] **Step 2: Replace the TOOLBOX constant**

In `apps/ide/src/BlockWorkspace.tsx`, replace the entire `TOOLBOX` constant:

```ts
const TOOLBOX: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Motion', colour: '210',
      contents: [
        { kind: 'block', type: 'sprout_forward' },
        { kind: 'block', type: 'sprout_turn' },
        { kind: 'block', type: 'sprout_arc' },
        { kind: 'block', type: 'sprout_goto' },
        { kind: 'block', type: 'sprout_home' },
        { kind: 'block', type: 'sprout_get_x' },
        { kind: 'block', type: 'sprout_get_y' },
        { kind: 'block', type: 'sprout_get_heading' },
        { kind: 'block', type: 'sprout_stamp' },
        { kind: 'block', type: 'sprout_hide_turtle' },
        { kind: 'block', type: 'sprout_show_turtle' },
      ],
    },
    {
      kind: 'category', name: 'Pen', colour: '240',
      contents: [
        { kind: 'block', type: 'sprout_pen_up' },
        { kind: 'block', type: 'sprout_pen_down' },
        { kind: 'block', type: 'sprout_color' },
        { kind: 'block', type: 'sprout_random_color' },
        { kind: 'block', type: 'sprout_background' },
        { kind: 'block', type: 'sprout_clear_canvas' },
        { kind: 'block', type: 'sprout_pen_width' },
      ],
    },
    {
      kind: 'category', name: 'Sprites', colour: '20',
      contents: [
        { kind: 'block', type: 'sprout_sprite' },
        { kind: 'block', type: 'sprout_move_sprite' },
        { kind: 'block', type: 'sprout_turn_sprite' },
        { kind: 'block', type: 'sprout_goto_sprite' },
        { kind: 'block', type: 'sprout_change_sprite_x' },
        { kind: 'block', type: 'sprout_change_sprite_y' },
        { kind: 'block', type: 'sprout_bounce_sprite' },
        { kind: 'block', type: 'sprout_sprite_x' },
        { kind: 'block', type: 'sprout_sprite_y' },
        { kind: 'block', type: 'sprout_sprites_touching' },
        { kind: 'block', type: 'sprout_hide_sprite' },
        { kind: 'block', type: 'sprout_show_sprite' },
        { kind: 'block', type: 'sprout_remove_sprite' },
      ],
    },
    {
      kind: 'category', name: 'Control', colour: '120',
      contents: [
        { kind: 'block', type: 'sprout_repeat' },
        { kind: 'block', type: 'sprout_repeat_with' },
        { kind: 'block', type: 'sprout_repeat_index' },
        { kind: 'block', type: 'sprout_if' },
        { kind: 'block', type: 'sprout_while' },
        { kind: 'block', type: 'sprout_for_each' },
        { kind: 'block', type: 'sprout_wait' },
        { kind: 'block', type: 'sprout_beep' },
        { kind: 'block', type: 'sprout_play_note' },
        { kind: 'block', type: 'sprout_on_event' },
        { kind: 'block', type: 'sprout_on_timer' },
        { kind: 'block', type: 'sprout_stop_timer' },
      ],
    },
    {
      kind: 'category', name: 'Variables', colour: '330',
      contents: [
        { kind: 'block', type: 'sprout_let' },
        { kind: 'block', type: 'sprout_set' },
      ],
    },
    {
      kind: 'category', name: 'Functions', colour: '290',
      contents: [
        { kind: 'block', type: 'sprout_def' },
        { kind: 'block', type: 'sprout_call_stmt' },
        { kind: 'block', type: 'sprout_return' },
      ],
    },
    {
      kind: 'category', name: 'Shapes', colour: '160',
      contents: [
        { kind: 'block', type: 'sprout_circle' },
        { kind: 'block', type: 'sprout_rect' },
        { kind: 'block', type: 'sprout_ellipse' },
        { kind: 'block', type: 'sprout_triangle' },
        { kind: 'block', type: 'sprout_polygon' },
        { kind: 'block', type: 'sprout_fill' },
        { kind: 'block', type: 'sprout_text' },
      ],
    },
    {
      kind: 'category', name: 'Composition', colour: '180',
      contents: [
        { kind: 'block', type: 'sprout_beside' },
        { kind: 'block', type: 'sprout_above' },
        { kind: 'block', type: 'sprout_scale' },
      ],
    },
    {
      kind: 'category', name: 'Lists', colour: '260',
      contents: [
        { kind: 'block', type: 'sprout_list' },
        { kind: 'block', type: 'sprout_range' },
        { kind: 'block', type: 'sprout_at' },
        { kind: 'block', type: 'sprout_get' },
        { kind: 'block', type: 'sprout_first' },
        { kind: 'block', type: 'sprout_last' },
        { kind: 'block', type: 'sprout_pick' },
        { kind: 'block', type: 'sprout_index_of' },
        { kind: 'block', type: 'sprout_slice' },
        { kind: 'block', type: 'sprout_size' },
        { kind: 'block', type: 'sprout_is_empty' },
        { kind: 'block', type: 'sprout_contains' },
        { kind: 'block', type: 'sprout_push' },
        { kind: 'block', type: 'sprout_pop' },
        { kind: 'block', type: 'sprout_concat' },
        { kind: 'block', type: 'sprout_reverse' },
        { kind: 'block', type: 'sprout_sort' },
        { kind: 'block', type: 'sprout_map' },
        { kind: 'block', type: 'sprout_filter' },
        { kind: 'block', type: 'sprout_reduce' },
      ],
    },
    {
      kind: 'category', name: 'Text', colour: '185',
      contents: [
        { kind: 'block', type: 'sprout_string' },
        { kind: 'block', type: 'sprout_join' },
        { kind: 'block', type: 'sprout_length' },
      ],
    },
    {
      kind: 'category', name: 'Values', colour: '0',
      contents: [
        { kind: 'block', type: 'sprout_number' },
        { kind: 'block', type: 'sprout_input' },
        { kind: 'block', type: 'sprout_text_input' },
        { kind: 'block', type: 'sprout_mouse_x' },
        { kind: 'block', type: 'sprout_mouse_y' },
        { kind: 'block', type: 'sprout_key_down' },
        { kind: 'block', type: 'sprout_bool' },
        { kind: 'block', type: 'sprout_ident' },
        { kind: 'block', type: 'sprout_infix' },
        { kind: 'block', type: 'sprout_compare' },
        { kind: 'block', type: 'sprout_not' },
        { kind: 'block', type: 'sprout_and' },
        { kind: 'block', type: 'sprout_or' },
        { kind: 'block', type: 'sprout_call_expr' },
      ],
    },
    {
      kind: 'category', name: 'Math', colour: '230',
      contents: [
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
        { kind: 'block', type: 'sprout_distance' },
        { kind: 'block', type: 'sprout_touching' },
      ],
    },
    {
      kind: 'category', name: 'Display', colour: '30',
      contents: [
        { kind: 'block', type: 'sprout_show' },
        { kind: 'block', type: 'sprout_puts' },
      ],
    },
  ],
};
```

- [ ] **Step 3: Run all tests**

```
npm test
```

Expected: all tests pass (toolbox config is not tested in unit tests — visual verification comes when running the app).

- [ ] **Step 4: Commit**

```
git add apps/ide/src/BlockWorkspace.tsx
git commit -m "feat(ide): collapsible category toolbox (Motion/Pen/Sprites/Control/...)"
```

---

### Task 3: `bounceSprite` lang builtin

**Files:**
- Modify: `packages/lang/src/interpreter.ts` — add `bounceSprite` entry to the builtins map
- Modify: `packages/lang/tests/sprites.test.ts` — add tests

`bounceSprite(name)` inspects the sprite's current x/y. If x is outside ±250 the sprite is clamped and its heading is reflected around the vertical axis: `heading → (360 - heading) % 360`. If y is outside ±250 the sprite is clamped and heading is reflected around the horizontal axis: `heading → (180 - heading + 360) % 360`. The two checks are independent so corner hits (x AND y out of bounds) reflect both axes.

- [ ] **Step 1: Write the failing tests**

Add a new `describe('bounceSprite', ...)` block at the end of `packages/lang/tests/sprites.test.ts`:

```ts
describe('bounceSprite', () => {
  it('no-op when sprite is inside bounds', () => {
    const result = interpretFull(prog(
      mkSprite('b'),
      exprStmt(call('gotoSprite', [strLit('b'), numLit(100), numLit(50)])),
      exprStmt(call('bounceSprite', [strLit('b')])),
    ));
    expect(result.sprites[0]).toMatchObject({ x: 100, y: 50, heading: 0 });
  });

  it('reflects heading off left wall and clamps x', () => {
    // heading 270 = facing left → after bounce: (360 - 270) % 360 = 90 (facing right)
    const result = interpretFull(prog(
      mkSprite('b'),
      exprStmt(call('gotoSprite', [strLit('b'), numLit(-260), numLit(0)])),
      exprStmt(call('turnSprite', [strLit('b'), numLit(270)])),
      exprStmt(call('bounceSprite', [strLit('b')])),
    ));
    expect(result.sprites[0].x).toBe(-250);
    expect(result.sprites[0].heading).toBeCloseTo(90);
  });

  it('reflects heading off right wall and clamps x', () => {
    // heading 90 = facing right → after bounce: (360 - 90) % 360 = 270 (facing left)
    const result = interpretFull(prog(
      mkSprite('b'),
      exprStmt(call('gotoSprite', [strLit('b'), numLit(260), numLit(0)])),
      exprStmt(call('turnSprite', [strLit('b'), numLit(90)])),
      exprStmt(call('bounceSprite', [strLit('b')])),
    ));
    expect(result.sprites[0].x).toBe(250);
    expect(result.sprites[0].heading).toBeCloseTo(270);
  });

  it('reflects heading off top wall and clamps y', () => {
    // heading 0 = facing up → after bounce: (180 - 0 + 360) % 360 = 180 (facing down)
    const result = interpretFull(prog(
      mkSprite('b'),
      exprStmt(call('gotoSprite', [strLit('b'), numLit(0), numLit(-260)])),
      exprStmt(call('bounceSprite', [strLit('b')])),
    ));
    expect(result.sprites[0].y).toBe(-250);
    expect(result.sprites[0].heading).toBeCloseTo(180);
  });

  it('reflects heading off bottom wall and clamps y', () => {
    // heading 180 = facing down → after bounce: (180 - 180 + 360) % 360 = 0 (facing up)
    const result = interpretFull(prog(
      mkSprite('b'),
      exprStmt(call('gotoSprite', [strLit('b'), numLit(0), numLit(260)])),
      exprStmt(call('turnSprite', [strLit('b'), numLit(180)])),
      exprStmt(call('bounceSprite', [strLit('b')])),
    ));
    expect(result.sprites[0].y).toBe(250);
    expect(result.sprites[0].heading).toBeCloseTo(0);
  });

  it('corner hit reflects both axes', () => {
    // heading 45 (NE) hits top-right corner
    // x-reflect: (360 - 45) % 360 = 315 (NW)
    // y-reflect of 315: (180 - 315 + 360) % 360 = 225 (SW)
    const result = interpretFull(prog(
      mkSprite('b'),
      exprStmt(call('gotoSprite', [strLit('b'), numLit(260), numLit(-260)])),
      exprStmt(call('turnSprite', [strLit('b'), numLit(45)])),
      exprStmt(call('bounceSprite', [strLit('b')])),
    ));
    expect(result.sprites[0].x).toBe(250);
    expect(result.sprites[0].y).toBe(-250);
    expect(result.sprites[0].heading).toBeCloseTo(225);
  });

  it('throws for wrong arity', () => {
    expect(() => interpretValue(prog(exprStmt(call('bounceSprite', [])))))
      .toThrow('bounceSprite expects 1 argument, got 0');
  });

  it('throws for unknown sprite', () => {
    expect(() => interpretValue(prog(exprStmt(call('bounceSprite', [strLit('ghost')])))))
      .toThrow("bounceSprite: no sprite named 'ghost'");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- packages/lang
```

Expected: FAIL — `bounceSprite` is not defined as a builtin yet.

- [ ] **Step 3: Add `bounceSprite` to the builtins map in `interpreter.ts`**

Find the `['removeSprite', ...]` entry (around line 599). Insert immediately after the closing `}],` of that entry:

```ts
  ['bounceSprite', (args) => {
    if (args.length !== 1) throw new SproutRuntimeError(`bounceSprite expects 1 argument, got ${args.length}`);
    const s = getSprite(args[0], 'bounceSprite');
    const HALF_W = 250;
    const HALF_H = 250;
    if (s.x < -HALF_W) {
      s.x = -HALF_W;
      s.heading = ((360 - s.heading) % 360 + 360) % 360;
    } else if (s.x > HALF_W) {
      s.x = HALF_W;
      s.heading = ((360 - s.heading) % 360 + 360) % 360;
    }
    if (s.y < -HALF_H) {
      s.y = -HALF_H;
      s.heading = ((180 - s.heading) % 360 + 360) % 360;
    } else if (s.y > HALF_H) {
      s.y = HALF_H;
      s.heading = ((180 - s.heading) % 360 + 360) % 360;
    }
    return EMPTY;
  }],
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- packages/lang
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add packages/lang/src/interpreter.ts packages/lang/tests/sprites.test.ts
git commit -m "feat(lang): bounceSprite builtin — reflects heading off stage walls"
```

---

### Task 4: `bounceSprite` block, compiler, and decompiler

**Files:**
- Modify: `packages/blocks/src/definitions/sprites.ts` — add block definition
- Modify: `packages/blocks/src/compiler.ts` — add fall-through case + expression case
- Modify: `packages/blocks/src/decompiler.ts` — add to SPRITE_STMT_BLOCKS table
- Modify: `packages/blocks/tests/sprites.test.ts` — add compile + round-trip tests

- [ ] **Step 1: Write the failing tests**

In `packages/blocks/tests/sprites.test.ts`, add `'sprout_bounce_sprite'` to the existing `it.each` for single-name statement blocks:

```ts
it.each([
  ['sprout_hide_sprite',    'hideSprite'],
  ['sprout_show_sprite',    'showSprite'],
  ['sprout_remove_sprite',  'removeSprite'],
  ['sprout_bounce_sprite',  'bounceSprite'],   // add this line
])('%s → %s("cat")', (blockType, callee) => {
```

Also add a round-trip test at the end of the file's decompile describe block:

```ts
it('bounceSprite round-trips through decompile→compile', () => {
  const src = 'bounceSprite("ball")';
  const prog = parse(src);
  const ws = makeWorkspace();
  decompileProgram(prog, ws);
  const result = compileWorkspace(ws);
  expect(serialize(result)).toBe(src);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- packages/blocks
```

Expected: FAIL — `sprout_bounce_sprite` block is not registered yet.

- [ ] **Step 3: Add the block definition to `sprites.ts`**

In `packages/blocks/src/definitions/sprites.ts`, inside `registerSpriteBlocks()`, add after the `sprout_remove_sprite` block (before the closing `}`):

```ts
  Blockly.Blocks['sprout_bounce_sprite'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('bounce sprite').appendField(nameField(), 'NAME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(SPRITE_COLOUR);
      this.setTooltip('Reflect a sprite off the stage edges');
    },
  };
```

- [ ] **Step 4: Add compiler fall-through and expression cases**

In `packages/blocks/src/compiler.ts`:

**a)** In the `compileStmt` switch, add `'sprout_bounce_sprite'` to the fall-through group (after `'sprout_remove_sprite'` around line 71):

```ts
    case 'sprout_remove_sprite':
    case 'sprout_bounce_sprite':
      return { kind: 'ExprStmt', expr: compileExprBlock(block) };
```

**b)** In `compileExprBlock`, add the case after `'sprout_remove_sprite'` (around line 319):

```ts
    case 'sprout_remove_sprite':
      return spriteCall(block, 'removeSprite', []);
    case 'sprout_bounce_sprite':
      return spriteCall(block, 'bounceSprite', []);
```

- [ ] **Step 5: Add decompiler table entry**

In `packages/blocks/src/decompiler.ts`, add `bounceSprite` to `SPRITE_STMT_BLOCKS`:

```ts
const SPRITE_STMT_BLOCKS: Record<string, SpriteBlockSpec> = {
  sprite:        { type: 'sprout_sprite',           fields: ['NAME'], inputs: ['COSTUME'] },
  moveSprite:    { type: 'sprout_move_sprite',      fields: ['NAME'], inputs: ['DIST'] },
  turnSprite:    { type: 'sprout_turn_sprite',      fields: ['NAME'], inputs: ['DEG'] },
  gotoSprite:    { type: 'sprout_goto_sprite',      fields: ['NAME'], inputs: ['X', 'Y'] },
  changeSpriteX: { type: 'sprout_change_sprite_x',  fields: ['NAME'], inputs: ['AMOUNT'] },
  changeSpriteY: { type: 'sprout_change_sprite_y',  fields: ['NAME'], inputs: ['AMOUNT'] },
  hideSprite:    { type: 'sprout_hide_sprite',      fields: ['NAME'], inputs: [] },
  showSprite:    { type: 'sprout_show_sprite',      fields: ['NAME'], inputs: [] },
  removeSprite:  { type: 'sprout_remove_sprite',    fields: ['NAME'], inputs: [] },
  bounceSprite:  { type: 'sprout_bounce_sprite',    fields: ['NAME'], inputs: [] },
};
```

- [ ] **Step 6: Run tests to verify they pass**

```
npm test -- packages/blocks
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```
git add packages/blocks/src/definitions/sprites.ts packages/blocks/src/compiler.ts packages/blocks/src/decompiler.ts packages/blocks/tests/sprites.test.ts
git commit -m "feat(blocks): sprout_bounce_sprite block with compiler and decompiler"
```

---

### Task 5: Bouncing Ball example

**Files:**
- Modify: `apps/ide/src/examples.ts`

The example uses `clearCanvas()` at the top of the timer to clear the previous frame, then `moveSprite` + `bounceSprite` to advance the ball. Sprites render on top of canvas commands, so the ball is always visible even after `clearCanvas`.

- [ ] **Step 1: Add the example**

In `apps/ide/src/examples.ts`, append a new entry to the `EXAMPLES` array (after the `'Sprite Chase'` entry):

```ts
  {
    name: 'Bouncing Ball',
    code: `# A ball bouncing around the stage
hideTurtle()
sprite("ball", circle(20))
turnSprite("ball", 45)

on timer every 30 do
  clearCanvas()
  moveSprite("ball", 5)
  bounceSprite("ball")
end`,
  },
```

- [ ] **Step 2: Run tests to verify the example parses and interprets**

```
npm test
```

The examples test suite in `apps/ide/tests/examples.test.ts` parses and runs every example — this verifies `bounceSprite` works end-to-end in the full stack.

Expected: all tests pass.

- [ ] **Step 3: Commit**

```
git add apps/ide/src/examples.ts
git commit -m "feat(ide): Bouncing Ball example using bounceSprite"
```

---

## Self-Review

**Spec coverage:**
- ✅ Sprite rotation — Task 1 (compound transform in `drawSprites`)
- ✅ Toolbox categories — Task 2 (categoryToolbox in BlockWorkspace)
- ✅ `bounceSprite` builtin — Task 3 (interpreter) + Task 4 (blocks)
- ✅ `textInput` block — already complete (noted in header)
- ✅ Bouncing Ball example — Task 5

**Placeholder scan:** None found.

**Type consistency:**
- `SpriteState` has `x`, `y`, `heading` fields (mutable) — used directly in Task 3 implementation ✓
- `getSprite` helper returns `SpriteState` — same helper used by existing builtins ✓
- `spriteCall` helper in compiler takes `(block, callee, inputs[])` — Task 4 uses same signature ✓
- `SpriteBlockSpec.fields/inputs` — Task 4 adds `{ fields: ['NAME'], inputs: [] }` matching existing no-input entries ✓
