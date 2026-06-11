# Multiple Sprites Design

**Date:** 2026-06-11
**Status:** Approved direction — retained sprites via host-state registry (Approach A)

## Goal

Let kids create multiple named game entities ("sprites") that each keep their
own position, heading, and appearance, and that the stage redraws
automatically every frame. Today games fake entities with `let` variables
plus a manual `clearCanvas()` + redraw on every timer tick (see the Catch
Game example); sprites remove that whole dance.

## Decisions made during brainstorming

1. **Retained sprites, not multi-turtle pens.** Sprites are persistent scene
   objects, not extra drawing cursors. Multi-turtle pens may come later; this
   design must not preclude them (and doesn't — sprites never touch the
   stroke renderer, and no builtin name collides with a future
   `with "pen" do … end`).
2. **Name registry, not first-class values.** `sprite("cat", …)` creates;
   every sprite builtin takes the name string. Matches existing host-state
   patterns (`show("score", …)`, `textInput("name")`), keeps all Sprout
   values immutable, and blocks/decompiler handle plain strings trivially.
3. **Costume = any Drawing, drawn upright.** `circle(15)`,
   `text("🐱", 40)`, composed shapes, even `fill do … end` results. Heading
   steers movement only; the costume never rotates (Scratch's "don't rotate"
   default — no transform math, emoji never tilt).
4. **Collision is automatic.** `spritesTouching("cat", "dog")` takes no
   radius; each sprite's radius derives from its costume's bounding box.

## Architecture (Approach A: host-state registry + snapshot)

Sprite state lives in a module-level `Map` inside `packages/lang/src/interpreter.ts`
— the same pattern as `_keysDown`, `_mouseX`, `_textInputValues`, and
`_stopTimer`. Sprite builtins are ordinary calls that mutate the registry and
return the empty drawing (statement-shaped) or a number/bool (getters).
Interpreter entry points return a snapshot of the registry; the IDE stage
draws the snapshot as a layer above the strokes.

Zero changes to AST, parser, serializer, or the stroke renderer: every sprite
operation is a plain `CallExpr`, so text↔blocks round-trips need only
decompiler table entries.

### Interpreter state

```ts
// interpreter.ts (module level, host-state section)
type SpriteState = {
  x: number;
  y: number;
  /** Degrees clockwise from north (0 = up) — same convention as the turtle. */
  heading: number;
  costume: Drawing;
  visible: boolean;
};

const _sprites = new Map<string, SpriteState>();
```

- Insertion order is draw order: later-created sprites render on top.
- `interpretFull` clears `_sprites` at the start of each run (like the
  `_stopTimer` reset), so re-running a program starts clean. `callHandler`
  does NOT reset it — sprite state persists across handler invocations
  within a run; that persistence is the feature.
- Coordinates match the turtle: origin at canvas center, y grows downward,
  heading 0 = up, degrees clockwise.

### Snapshot type (exported from @sprout/lang)

```ts
export type SpriteSnapshot = {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly costume: Drawing;
  readonly visible: boolean;
};
```

`interpretFull`, `interpretFullWithInputs`, and `callHandler` result types
each gain `sprites: SpriteSnapshot[]` — a freshly copied array in registry
insertion order, taken after evaluation completes.

## Builtins (12)

| Builtin | Arity | Returns | Behavior |
|---|---|---|---|
| `sprite(name, costume)` | 2 | empty | Create at (0, 0), heading 0, visible. If `name` already exists: replace costume only, keeping position/heading/visibility — this doubles as the costume-change verb. |
| `moveSprite(name, dist)` | 2 | empty | Move `dist` along the sprite's heading (same trig as turtle `forward`). |
| `turnSprite(name, deg)` | 2 | empty | Rotate heading clockwise; normalize into [0, 360). |
| `gotoSprite(name, x, y)` | 3 | empty | Teleport to (x, y). |
| `changeSpriteX(name, amt)` | 2 | empty | `x += amt`. |
| `changeSpriteY(name, amt)` | 2 | empty | `y += amt` (positive = down, matching turtle space). |
| `spriteX(name)` | 1 | number | Current x. |
| `spriteY(name)` | 1 | number | Current y. |
| `spritesTouching(a, b)` | 2 | bool | See collision below. |
| `hideSprite(name)` | 1 | empty | `visible = false` (not drawn, never collides). |
| `showSprite(name)` | 1 | empty | `visible = true`. |
| `removeSprite(name)` | 1 | empty | Delete from the registry. |

### Collision

Each sprite's collision radius derives from its costume:

```ts
const { width, height } = measure(costume);
const radius = Math.max(width, height) / 2;
```

`spritesTouching(a, b)` is true when both sprites exist, both are visible,
and `Math.hypot(bx - ax, by - ay) <= radiusA + radiusB`. A zero-size costume
(e.g. `penUp()` as costume) yields radius 0 — two point sprites touch only
at distance 0. No minimum-radius floor; document, don't magic.

The radius is computed on demand inside `spritesTouching` (no caching —
costumes are small and `measure` is cheap; revisit only if profiling says so).

The existing coordinate builtin `touching(x1, y1, x2, y2, r)` is unchanged.

### Errors (house style, lines for free via evalCall annotation)

- Unknown name: `moveSprite: no sprite named 'cat'` — thrown by every
  builtin that looks up a sprite, including both args of `spritesTouching`.
- Name not a string: `sprite: expected string, got number` (via `assertString`).
- Costume not a drawing: `sprite: expected drawing, got number` (reuse the
  isDrawing check used by composition builtins).
- Arity: `gotoSprite expects 3 arguments, got 2`.
- `removeSprite`/`hideSprite`/`showSprite` on unknown names also throw —
  consistency beats leniency; typos should fail loudly for kids.

## Stage rendering (apps/ide)

Layer order per frame: **strokes → sprites → turtle icon → HUD**.

`stage-utils.ts` gains:

```ts
export function drawSprites(
  ctx: CanvasRenderingContext2D,
  sprites: readonly SpriteSnapshot[],
): void
```

For each visible sprite (in array order): `ctx.save()`,
`ctx.translate(sprite.x, sprite.y)` (on top of the existing center-origin
transform), replay `render(sprite.costume)` commands, `ctx.restore()`.

The CanvasCommand-replay logic currently inside `drawUpTo` is extracted into
a shared helper used by both `drawUpTo` and `drawSprites`, so the two can't
drift. Costume replay handles the same command set playback does: stroke
paths (moveTo/lineTo/pen), shapes, fillPath, text. `wait`/`sound` commands
inside a costume are ignored (a costume is a picture, not a performance);
`hideTurtle`/`showTurtle`/`clearCanvas`/`fillBackground` inside costumes are
likewise no-ops in the sprite layer.

### App.tsx flow

- Run: `interpretFull` result's `sprites` goes into React state; stage draws it.
- Handlers (timer/key/click): `callHandler` result's `sprites` replaces that
  state — same immediate path `applyHandlerDelta` uses for strokes/sounds.
- **Playback caveat (v1, accepted):** during the initial timed playback of
  programs with `wait`/sounds, the sprite layer shows the final registry
  state rather than animating in sync with stroke segments. Handler-driven
  games — the actual use case — always see the up-to-date snapshot.

## Blocks (packages/blocks)

New **Sprites** toolbox category, colour 330. Sprite names are free-text
fields (`field_input`, default `"cat"`) — precedent: `sprout_text_input`.

Statement blocks:

| Block | Shape |
|---|---|
| `sprout_sprite` | `make sprite [NAME] look like (COSTUME)` — NAME field, COSTUME value input |
| `sprout_move_sprite` | `move sprite [NAME] by (DIST)` |
| `sprout_turn_sprite` | `turn sprite [NAME] by (DEG)` |
| `sprout_goto_sprite` | `send sprite [NAME] to x (X) y (Y)` |
| `sprout_change_sprite_x` | `change sprite [NAME] x by (AMOUNT)` |
| `sprout_change_sprite_y` | `change sprite [NAME] y by (AMOUNT)` |
| `sprout_hide_sprite` | `hide sprite [NAME]` |
| `sprout_show_sprite` | `show sprite [NAME]` |
| `sprout_remove_sprite` | `remove sprite [NAME]` |

Value blocks:

| Block | Shape | Output |
|---|---|---|
| `sprout_sprite_x` | `x of sprite [NAME]` | Number |
| `sprout_sprite_y` | `y of sprite [NAME]` | Number |
| `sprout_sprites_touching` | `sprite [NAME_A] touching sprite [NAME_B]?` | Boolean |

Compiler: each block compiles to the corresponding `CallExpr` with the NAME
field as a `StringLit` first arg. Decompiler: field-backed mapping when the
name arg is a `StringLit` (any string — free-text field, not dropdown-gated);
when the name is a computed expression, fall back to the generic call blocks
(≤2 args) or text fallback — the exact gating pattern `textInput` uses.

## IDE toolbox + example

- `BlockWorkspace.tsx`: add the Sprites category with all 12 blocks.
- `examples.ts`: add **"Sprite Chase"** — cat chases a randomly-jumping
  mouse with arrow keys, beep + score on catch, win at 5. Demonstrates the
  no-`clearCanvas` idiom:

```text
# Catch the mouse! Arrow keys. Catch 5 to win.
sprite("cat", text("🐱", 40))
sprite("mouse", text("🐭", 30))
gotoSprite("mouse", random(-200, 200), random(-200, 200))
let score = 0

on timer every 50 do
  if keyDown(:left) do
    changeSpriteX("cat", -5)
  end
  if keyDown(:right) do
    changeSpriteX("cat", 5)
  end
  if keyDown(:up) do
    changeSpriteY("cat", -5)
  end
  if keyDown(:down) do
    changeSpriteY("cat", 5)
  end

  if spritesTouching("cat", "mouse") do
    beep()
    set score = score + 1
    gotoSprite("mouse", random(-200, 200), random(-200, 200))
  end

  show("score", score)

  if score == 5 do
    text("YOU WIN!", 40)
    stopTimer()
  end
end
```

The existing Catch Game example stays unchanged as a regression test for the
let-variable idiom.

## Testing

- **lang** (`tests/sprites.test.ts`): every builtin — create, costume swap
  preserves position, move trig, turn normalization, goto, changeX/Y,
  getters, touching (true/false/hidden/zero-size), hide/show/remove, all
  error paths (unknown name, wrong types, arity); `interpretFull` resets the
  registry between runs; `callHandler` mutations appear in its snapshot;
  snapshot is a copy (mutating it doesn't affect the registry).
- **blocks**: compile test per block; decompiler round-trips for the
  field-backed path and the computed-name fallback; the Sprite Chase program
  round-trips.
- **ide**: `drawSprites` unit tests (translate called per sprite, hidden
  sprites skipped, draw order, restore balanced — extend the existing mock
  ctx); Sprite Chase joins the examples parse/interpret/decompile suite.

## Out of scope (explicitly)

- Costume rotation with heading.
- Sprite-layer animation during initial timed playback.
- Multi-turtle drawing pens (`with "pen" do … end`) — future arc.
- Per-sprite event handlers (`on click("cat")`) — future arc.
- Sprite speech bubbles, layers/z-order control, scaling builtins.
