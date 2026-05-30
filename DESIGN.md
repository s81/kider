# Sprout — Design Document (Phase 0)

> **Status:** Awaiting approval on two open decisions before Phase 1 begins.
> Open decisions are listed at the bottom of this document.

---

## A. Whether: Build vs. Fork

Building from scratch is the right call here — but "from scratch" means **writing the language and interpreter ourselves while using Blockly as the block-UI library**. Hedy is a text-progressive language with a parser and level system; it has no drag-and-drop block surface, so it does not give us what we need. Scratch/Blockly sample extensions still require us to write every custom block definition, a complete interpreter, and the immutable value model — we would keep none of their runtime logic. The functional + immutable constraint is novel enough that no existing kids' language provides it; we would spend as much time fighting a fork's assumptions as writing cleanly. The conclusion: take Blockly as a UI dependency for the authoring canvas, write the rest (AST types, interpreter, value model, serializer, block definitions) ourselves.

---

## B. Execution Model — **DECISION REQUIRED**

### (i) Command-sequence (Logo / Scratch style)

Programs are ordered lists of imperative commands. `forward 100` moves the turtle; `turn 90` rotates it. State lives in the turtle object.

**Pros**
- Matches every kid's prior Scratch / Logo intuition.
- Cause-and-effect is immediate: "I told the turtle to move, it moved."
- Easier first-hour on-ramp for ages 8–10.

**Cons**
- The turtle carries mutable state (`x`, `y`, `heading`, `penDown`). That state is threaded through every step.
- Composition is awkward: to reuse a shape you effectively write a subroutine that *mutates* the turtle. That's a procedure, not a function.
- Constraint 3 (functional + declarative) becomes a polite fiction — the language *looks* functional but the turtle is secretly a mutable object.
- Later extension to composable layouts (`beside`, `above`, `stack`) requires retrofitting a new abstraction onto an imperative core.

---

### (ii) Composable-value ← **RECOMMENDED**

A drawing is an **immutable value** — a description of marks, not an act of marking. `forward(100)` does not move a turtle; it *constructs* a `Drawing` value meaning "a line of length 100 in the current direction." `turn(90)` constructs a `Drawing` meaning "rotate 90°." These compose:

```ruby
square = repeat 4 do
  forward 100
  turn 90
end

two_squares = beside(square, square)
```

`square` is a value. `beside` is a pure function: `beside(a, b) → Drawing`. The program evaluates to a single `Drawing` value. The **renderer** then walks that value, tracking turtle state internally, and emits canvas draw calls. The *language* never sees mutable state.

**Pros**
- Fully honors constraint 3 without a reactive engine.
- Composition (`beside`, `above`, `stack`, `scale`) is natural and powerful.
- Functions are genuinely pure: `square` always produces the same drawing.
- Ages 11–14 leave with a real mental model of functional composition.
- Extending to parametric art (`polygon(sides, size)`) is trivial.

**Cons**
- More abstract for ages 8–10: "What IS `forward 100` if the turtle didn't move yet?"
  - Mitigation: the block palette labels it **"Draw line"**, not "move forward." The turtle on screen animates *after* the program finishes evaluating, making the two-phase model concrete.
- `beside` requires a coordinate model (how wide is a `Drawing`?). We need a bounding-box concept. This is solvable with a `size(drawing) → {w, h}` primitive.

**Age-bracket assessment**

| Age | Model (i) | Model (ii) |
|-----|-----------|------------|
| 8–9 | Natural from Scratch | Needs "describe first, draw second" framing |
| 10–11 | Fine, but hits ceiling fast | Reachable with good block labels |
| 12–14 | Feels limited once they want layout | Rewarding; maps to real FP concepts |

**Recommendation: choose (ii).** The bounding-box complexity is a one-time interpreter concern, invisible to kids. The pedagogical payoff — real functions, real composition, no hidden state — justifies the slightly steeper first hour.

> **→ STOP. Please confirm (i) or (ii) before Phase 1.**

---

## C. Grammar / Text Shape

The text panel is **read-only output** from the AST serializer. This grammar describes what the serializer emits, not what a parser consumes. There is no parser in the MVP.

```ebnf
program     ::= statement*

statement   ::= def_stmt
             |  expr_stmt

def_stmt    ::= "def" ident params? "=" expr
             |  "def" ident params? newline block_body "end"

params      ::= "(" ident ("," ident)* ")"

expr        ::= literal
             |  ident
             |  call_expr
             |  block_expr
             |  infix_expr

call_expr   ::= ident "(" args? ")"           (* function call     *)
             |  ident block_expr               (* trailing block    *)
             |  ident "(" args? ")" block_expr (* call + block      *)

block_expr  ::= "do" newline statement* "end"

args        ::= expr ("," expr)*

infix_expr  ::= expr op expr
op          ::= "+" | "-" | "*" | "/"

literal     ::= number | string | symbol | bool
number      ::= [0-9]+ ("." [0-9]+)?
string      ::= '"' [^"]* '"'
symbol      ::= ":" ident
bool        ::= "true" | "false"
ident       ::= [a-z][a-z0-9_]*
```

**No OOP is structural.** There is simply no `class`, `new`, `self`, `@var`, `def` on a receiver, or prototype syntax. The grammar does not contain those tokens. A kid cannot write object-oriented code because the blocks do not exist — and the serializer cannot emit those tokens because the AST has no node for them.

---

## D. Five Worked Examples

Each example shows the block layout a kid would author, then the generated text.

---

### 1. Draw a Square

**Block layout**
```
[ repeat ] [ 4 ] [ do ]
  [ forward ] [ 100 ]
  [ turn ] [ 90 ]
[ end ]
```

**Generated text**
```ruby
repeat 4 do
  forward 100
  turn 90
end
```

---

### 2. Parameterized Function — Regular Polygon

**Block layout**
```
[ def ] [ polygon ] ( [ sides ] , [ size ] )
  [ repeat ] [ sides ] [ do ]
    [ forward ] [ size ]
    [ turn ] [ 360 / sides ]
  [ end ]
[ end ]

[ polygon ] ( [ 6 ] , [ 80 ] )
```

**Generated text**
```ruby
def polygon(sides, size)
  repeat sides do
    forward size
    turn 360 / sides
  end
end

polygon(6, 80)
```

---

### 3. Composing Two Pictures

**Block layout**
```
[ def ] [ square ]
  [ repeat ] [ 4 ] [ do ]
    [ forward ] [ 100 ]
    [ turn ] [ 90 ]
  [ end ]
[ end ]

[ beside ] ( [ square ] , [ square ] )
```

**Generated text**
```ruby
def square
  repeat 4 do
    forward 100
    turn 90
  end
end

beside(square, square)
```

---

### 4. Repeat Loop (standalone)

**Block layout**
```
[ repeat ] [ 8 ] [ do ]
  [ forward ] [ 60 ]
  [ turn ] [ 45 ]
[ end ]
```

**Generated text**
```ruby
repeat 8 do
  forward 60
  turn 45
end
```

---

### 5. Event Handler

**Block layout**
```
[ on ] [ :click ] [ do ]
  [ forward ] [ 20 ]
  [ turn ] [ 15 ]
[ end ]
```

**Generated text**
```ruby
on :click do
  forward 20
  turn 15
end
```

> Note: Events do not introduce mutable state. `on :click` registers a handler that evaluates to a `Drawing` delta each time the event fires; the renderer composites it onto the stage. Detailed semantics deferred to Phase 1.

---

## E. Value Model

### What is a value?

Every expression in Sprout evaluates to one of these value types:

| Type | Description | Example |
|------|-------------|---------|
| `Number` | 64-bit float | `100`, `3.14` |
| `String` | Immutable text | `"hello"` |
| `Symbol` | Named constant | `:click`, `:red` |
| `Bool` | `true` / `false` | `true` |
| `Drawing` | An immutable canvas description | result of `forward`, `beside`, `repeat` |
| `Function` | A closure (pure) | result of `def` |

There are no mutable values. There are no objects. There is no `nil` in the MVP.

### What is a Drawing?

A `Drawing` is a **value** that describes marks on a canvas. It is an algebraic data type:

```
Drawing =
  | Forward(distance: Number)
  | Turn(degrees: Number)
  | PenUp
  | PenDown
  | Sequence(steps: Drawing[])
  | Beside(left: Drawing, right: Drawing)
  | Above(top: Drawing, bottom: Drawing)
  | Scale(factor: Number, drawing: Drawing)
  | Empty
```

`forward(100)` does not move a turtle. It constructs `Forward(100)`. `turn(90)` constructs `Turn(90)`. `repeat 4 do ... end` constructs `Sequence([..., ..., ..., ...])`. The language stays pure.

### How are drawing effects sequenced?

A `do…end` block is sugar for `Sequence`. The interpreter evaluates each statement in the block, collects the resulting `Drawing` values, and wraps them in `Sequence([d1, d2, ...])`. This is how effects are sequenced without mutation: the sequence is itself a value.

### How are values composed?

```ruby
square = repeat 4 do
  forward 100
  turn 90
end

big_square = scale(2, square)
row        = beside(square, big_square)
```

`beside(a, b)` is a pure function: `Drawing × Drawing → Drawing`. It places `b`'s origin to the right of `a`'s bounding box. No state changes. `row` is a new `Drawing` value.

### What does the renderer do?

After the interpreter fully evaluates the program to a `Drawing`, the renderer walks the `Drawing` tree depth-first, tracking a `TurtleState { x, y, heading, penDown }` in a local mutable variable **inside the renderer** (not visible to the language). For each node it emits canvas draw calls. This mutable state is entirely inside the renderer — the Sprout language never observes it.

### Bounding boxes

`beside` and `above` need to know the size of a `Drawing`. The interpreter computes a bounding box during evaluation using a lightweight `measure(drawing) → { width, height }` function that walks the `Drawing` tree geometrically. No rendering required for measurement.

---

## F. Blocks Library — **DECISION REQUIRED**

### Option A: Blockly ← **RECOMMENDED**

[google/blockly](https://github.com/google/blockly) — Apache 2.0, actively maintained by Google.

**Pros**
- First-class TypeScript support (`@blockly/...` packages on npm).
- Excellent documentation; large community; extensive custom-block API.
- Appearance is configurable: colors, shapes, fonts are all themeable.
- Code generation API (`blockToCode`) maps naturally to our AST compiler.
- Integrates cleanly with Vite + React via `react-blockly`.

**Cons**
- Default look is "App Inventor" — not the Scratch aesthetic kids recognize.
- Some block shape customization requires touching Blockly internals.

---

### Option B: scratch-blocks

[scratchfoundation/scratch-blocks](https://github.com/scratchfoundation/scratch-blocks) — Apache 2.0, forked from Blockly by the Scratch team.

**Pros**
- Authentic Scratch look: rounded shapes, larger hit targets, familiar to kids who know Scratch.

**Cons**
- The project has had periods of low maintenance; last major activity was 2023.
- Far less documentation for custom block definitions.
- No TypeScript types; heavier bundle.
- Custom code generators are less ergonomic than Blockly's.

**Recommendation: Blockly**, unless you specifically need the Scratch visual appearance. We can theme Blockly to use rounded shapes and Scratch-like colors with a custom theme — achieving ~80% of the look without the maintenance and documentation cost.

> **→ STOP. Please confirm Blockly or scratch-blocks (or "Scratch look is essential") before Phase 1.**

---

## G. Repository Layout + Phase Plan

### Monorepo structure

```
sprout/
├── pnpm-workspace.yaml
├── package.json               # root dev deps: TypeScript, Vitest, ESLint
├── tsconfig.base.json
│
├── packages/
│   ├── lang/                  # Zero UI deps. Pure TypeScript.
│   │   ├── src/
│   │   │   ├── ast.ts         # AST node type definitions
│   │   │   ├── values.ts      # Drawing, Number, Symbol … value types
│   │   │   ├── interpreter.ts # Tree-walking interpreter (AST → Drawing)
│   │   │   ├── renderer.ts    # Drawing → canvas draw-command list
│   │   │   └── serializer.ts  # AST → Ruby-like display text
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── blocks/                # Depends on lang + blockly.
│       ├── src/
│       │   ├── definitions/   # Block shape + color definitions
│       │   ├── compiler.ts    # Blockly workspace → AST
│       │   └── generator.ts   # Blockly workspace → display text (wraps serializer)
│       ├── tests/
│       └── package.json
│
├── apps/
│   └── ide/                   # Vite + React. Depends on blocks + lang.
│       ├── src/
│       │   ├── App.tsx
│       │   ├── BlockWorkspace.tsx
│       │   ├── TextPanel.tsx  # Read-only; displays serializer output
│       │   └── Stage.tsx      # HTML Canvas turtle stage
│       └── package.json
│
└── examples/
    ├── square.fixture.ts
    ├── polygon.fixture.ts
    ├── beside.fixture.ts
    ├── repeat.fixture.ts
    └── click-event.fixture.ts
```

---

### Phase Plan

#### Phase 1 — `packages/lang` core
**Scope:** AST types; immutable value model; tree-walking interpreter for numbers, arithmetic, `def`/calls, `repeat`, turtle ops (`forward`, `turn`, `penUp`, `penDown`), `beside`, `above`, `scale`; AST→text serializer.

**Definition of done:**
- [ ] All 5 example programs expressed as hand-built AST fixtures in `examples/`.
- [ ] `interpreter` reduces each fixture to a `Drawing` value with no runtime errors.
- [ ] `renderer` converts each `Drawing` to a deterministic list of canvas draw commands (snapshot-tested).
- [ ] `serializer` emits valid display text for each fixture (snapshot-tested).
- [ ] Zero `any` in TypeScript strict mode. `pnpm test` is green.

---

#### Phase 2 — `packages/blocks`
**Scope:** Blockly block definitions for every Phase 1 construct; `compiler` (workspace → AST); `generator` (workspace → display text via serializer).

**Definition of done:**
- [ ] All 5 examples can be authored by dragging blocks (verified via programmatic workspace construction in tests).
- [ ] `compiler` output matches the hand-built AST fixtures from Phase 1 (deep-equal).
- [ ] `generator` output matches Phase 1 serializer output (string-equal).
- [ ] `pnpm test` is green across both packages.

---

#### Phase 3 — `apps/ide`
**Scope:** React shell wiring block workspace + read-only text panel + Run button + Canvas turtle stage. No text editing. No parser.

**Definition of done:**
- [ ] All 5 examples run end-to-end in the browser: author blocks → see generated text update live → press Run → see turtle draw on canvas.
- [ ] Text panel is visually read-only (no cursor, no edits accepted).
- [ ] No console errors on happy path.
- [ ] `pnpm build` produces a shippable static bundle.

---

#### Later (do not build until requested)
- Text editor + parser (text → AST sync).
- Reactive derived values.
- Sprites, sound, multiplayer, accounts.
- Mobile layout.

---

## Open Decisions — Confirm Before Phase 1

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | **Execution model** | (i) Command-sequence · (ii) Composable-value | **(ii) Composable-value** |
| 2 | **Blocks library** | Blockly · scratch-blocks | **Blockly** |

Please reply with your choices for both. Once confirmed, Phase 1 begins with `packages/lang`.
