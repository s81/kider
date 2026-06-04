# Background Color Design

**Date:** 2026-06-04  
**Status:** Approved

## Goal

Add a `background()` builtin that fills the canvas with a solid color. Works like `color()` for the palette, but also accepts arbitrary hex strings for power users.

## Function

| Call | Arg | Effect |
|---|---|---|
| `background(:red)` | palette symbol | fills canvas with `#dc2626` |
| `background("#ff4400")` | hex string | fills canvas with that color |

No other argument types accepted — throws `SproutRuntimeError` for numbers, bools, or unknown symbols.

### Palette

Same 9 colors as `color()`: red, blue, green, orange, purple, black, white, yellow, pink.

### Hex strings

Any string argument is used as-is as a CSS color value. No format validation — invalid values are passed to the canvas and silently produce no fill (browser behavior). The `sprout_background` block tooltip mentions hex support in text mode.

## Architecture

`background` is a Drawing like any other — its position in the program determines when the canvas fill is applied relative to other drawing steps. Typical use is at the top of the program. It does not move the turtle.

### `packages/lang/src/values.ts`

New Drawing variant:
```typescript
| { readonly kind: 'background'; readonly color: string }
```

New constructor:
```typescript
export function mkBackground(color: string): Drawing {
  return { kind: 'background', color };
}
```

Update the INVARIANT comment to include `'background'`.

### `packages/lang/src/renderer.ts`

New CanvasCommand:
```typescript
| { readonly kind: 'fillBackground'; readonly color: string }
```

`renderInto` — new case: emit `fillBackground`, do not move turtle:
```typescript
case 'background':
  cmds.push({ kind: 'fillBackground', color: d.color });
  break;
```

`scaleDrawing` — new case: pass through unchanged (background always fills full canvas):
```typescript
case 'background':
  return d;
```

`measureInto` — new case: background contributes no bounding box movement:
```typescript
case 'background':
  break;
```

### `packages/lang/src/interpreter.ts`

New BUILTINS entry after `color`:
```typescript
['background', (args) => {
  if (args.length !== 1) throw new SproutRuntimeError(`background expects 1 argument, got ${args.length}`);
  const arg = args[0];
  if (arg.kind === 'symbol') {
    const hex = COLOR_MAP[arg.name];
    if (hex === undefined) {
      throw new SproutRuntimeError(
        `Unknown color: :${arg.name}. Available: ${Object.keys(COLOR_MAP).map(k => ':' + k).join(', ')}`
      );
    }
    return mkBackground(hex);
  }
  if (arg.kind === 'string') {
    return mkBackground(arg.value);
  }
  throw new SproutRuntimeError(`background expects a color symbol or hex string, got ${arg.kind}`);
}],
```

`isDrawing` switch: add `'background'`.

Import `mkBackground` from `values.js`.

### `apps/ide/src/stage-utils.ts`

New case in `drawUpTo`:
```typescript
case 'fillBackground': {
  ctx.save();
  ctx.fillStyle = cmd.color;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.restore();
  break;
}
```

### `packages/blocks/src/definitions/statements.ts`

New `sprout_background` block after `sprout_color`:
```typescript
Blockly.Blocks['sprout_background'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('background')
      .appendField(
        new Blockly.FieldDropdown([
          ['white',  'white'],
          ['black',  'black'],
          ['red',    'red'],
          ['blue',   'blue'],
          ['green',  'green'],
          ['orange', 'orange'],
          ['purple', 'purple'],
          ['yellow', 'yellow'],
          ['pink',   'pink'],
        ]) as unknown as Blockly.Field,
        'COLOR',
      );
    this.setTooltip('Sets the canvas background color. In text mode, hex strings like "#ff4400" are also accepted.');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(20);
  },
};
```

### `packages/blocks/src/compiler.ts`

Add `'sprout_background'` to the `compileStmt` case group (after `'sprout_color'`).

Add case in `compileExprBlock`:
```typescript
case 'sprout_background': {
  const color = block.getFieldValue('COLOR') as string;
  return { kind: 'CallExpr', callee: 'background', args: [{ kind: 'SymbolLit', name: color }], block: null };
}
```

### `apps/ide/src/BlockWorkspace.tsx`

Add `{ kind: 'block', type: 'sprout_background' }` after `sprout_color` in the Pen section.

## Testing

### `packages/lang/tests/interpreter.test.ts` — `describe('background builtin')`

- `background(:red)` returns a `background` Drawing with `color === '#dc2626'`
- `background(:white)` returns `color === '#ffffff'`
- `background("#ff4400")` returns `color === '#ff4400'`
- `background(:unknown)` throws `SproutRuntimeError` matching `/background/`
- `background(1)` throws `SproutRuntimeError` matching `/background/`
- `background()` throws `SproutRuntimeError` matching `/background/`

### `packages/lang/tests/renderer.test.ts` — `describe('background rendering')`

- `background(:red)` renders to `[{ kind: 'fillBackground', color: '#dc2626' }]`
- `scale(2, background(:blue))` renders to `[{ kind: 'fillBackground', color: '#2563eb' }]` (unchanged by scale)
- `sequence([background(:red), forward(50)])` renders fillBackground first, then forward steps

### `apps/ide/tests/stage-utils.test.ts` — `describe('background drawing')`

- `fillBackground` command calls `ctx.fillRect(0, 0, STAGE_W, STAGE_H)` with correct `fillStyle`
- `ctx.save()` and `ctx.restore()` are called around the fill

### `packages/blocks/tests/compiler.test.ts` — `describe('background block')`

- `sprout_background` with COLOR="red" → `ExprStmt { expr: CallExpr { callee: 'background', args: [SymbolLit('red')] } }`
- `sprout_background` with COLOR="white" → same shape with `name: 'white'`

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/values.ts` | Add `background` Drawing variant and `mkBackground` |
| `packages/lang/src/renderer.ts` | Add `fillBackground` CanvasCommand; handle in renderInto/scaleDrawing/measureInto |
| `packages/lang/src/interpreter.ts` | Add `background` builtin; update `isDrawing` |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('background builtin')` |
| `packages/lang/tests/renderer.test.ts` | Add `describe('background rendering')` |
| `apps/ide/src/stage-utils.ts` | Handle `fillBackground` in `drawUpTo` |
| `apps/ide/tests/stage-utils.test.ts` | Add `describe('background drawing')` |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_background` block |
| `packages/blocks/src/compiler.ts` | Add `sprout_background` to compileStmt and compileExprBlock |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('background block')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_background` to toolbox |

## Out of Scope

- Gradient backgrounds
- Image/pattern backgrounds
- Persisting background across `clearCanvas()` calls (handled when clearCanvas is designed)
- Background opacity / transparency
