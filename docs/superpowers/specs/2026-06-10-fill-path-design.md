# Fill Path Design (custom filled shapes)

**Date:** 2026-06-10
**Status:** Approved

## Goal

Let kids make their own filled shapes by tracing them with the turtle:

```
fill do
  forward(100)
  turn(120)
  forward(100)
  turn(120)
  forward(100)
end
```

draws a filled triangle. Today only the built-in shapes (circle, rect, polygon, …)
are filled; anything traced with `forward`/`turn`/`arc` is outline-only. This was
the last gap from the brainstorm (sound and collision shipped earlier today).

## Approach

A dedicated AST node, mirroring `RepeatExpr` end to end:

- **AST**: `FillExpr { kind: 'FillExpr'; body: BlockExpr }`.
- **Parser**: contextual keyword with lookahead — an IDENT `fill` followed by
  `do` parses as `FillExpr`; otherwise `fill` stays an ordinary identifier
  (variable or function name). Same approach as `repeat ... with`.
- **Interpreter**: evaluates the body to a Drawing and wraps it:
  `FillPathDrawing { kind: 'fillPath'; drawing: Drawing }` (new Drawing variant,
  constructor `mkFillPath`).
- **Serializer**: `fill do\n<body>\nend`.

Rejected alternatives:
- **`beginFill()` / `endFill()` imperative pair** — stateful bracketing fights
  Sprout's declarative drawing tree; unmatched pairs are a new error class.
- **`fill() do ... end` via the existing CallExpr block slot** — works in the
  parser today, but the empty parens are noise for kids and evalCall's
  "blocks not supported" guard usefully protects every other builtin.
  A dedicated node also gives the serializer and compiler obvious homes.

## Renderer semantics

- `renderInto` case `'fillPath'`: walk the inner drawing with a point collector
  that simulates only turtle movement — `forward`, `turn`, `arc`, `goto`,
  `home`, and `sequence` recursion. Each position change appends a vertex;
  the start position is the first vertex. All other node kinds inside the body
  (color, penUp, shapes, wait, sound, nested fillPath, beside/above/scale) are
  ignored for the outline — the fill is the traced path, nothing else.
- Emits `CanvasCommand { kind: 'fillPath'; points: {x,y}[] }`, then updates the
  real turtle state to the path's end position and heading (the turtle really
  moved) and emits a `moveTo` so subsequent strokes start from there.
- `scaleDrawing`: recurses into the inner drawing (forwards scale, the shape
  scales with them).
- `measureInto`: recurses into the inner drawing so bounding boxes (used by
  `beside`/`above`) account for the traced path.

## Stage rendering (IDE)

`drawUpTo` case `'fillPath'`: flush the current stroke; if the command has at
least 3 points, draw the closed polygon filled at `globalAlpha 0.35` with the
current pen color and stroke its outline — identical styling to the built-in
shapes. Fewer than 3 points draws nothing. Either way the working path resumes
with `moveTo` at the last point.

## Blocks

- `sprout_fill` — statement block: label "fill", statement input `BODY` with
  field "do", colour 160 (the drawing-command colour, like circle/forward).
  Compiler: `case 'sprout_fill'` in `compileStmt`'s ExprStmt list, dispatching
  to `compileFillExpr` (mirrors `compileRepeatExpr` minus the count input).
- Toolbox: after `sprout_polygon` in the Shapes group.

## Testing

- lang: interpret `fill do forward/turn end` → `{kind:'fillPath', drawing:…}`;
  renderer emits points for a traced square corner; turtle continues from the
  path end; goto inside fill adds a vertex; non-movement nodes ignored;
  `scale(2, fill…)` doubles point coordinates; serializer round-trips.
- parser: `fill do … end` parses to FillExpr; bare `fill` still parses as an
  identifier; parse(serialize(ast)) round-trip.
- blocks: `sprout_fill` with a body compiles to FillExpr.
- ide: `drawUpTo` fills and outlines a 3-point fillPath; skips a 2-point one.
