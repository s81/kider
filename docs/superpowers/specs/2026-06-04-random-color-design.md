# Random Color Design

**Date:** 2026-06-04  
**Status:** Approved

## Goal

Add `randomColor()` as a Drawing primitive — picks a random color and applies it to the current pen, exactly like `color(:red)`. Two modes: palette (9 named colors) or any hex (16M+ colors).

## Function

| Call | Args | Returns |
|---|---|---|
| `randomColor()` | none | color Drawing — random from 9-color palette |
| `randomColor(:any)` | `:any` symbol | color Drawing — random full hex (`#rrggbb`) |

- No other arguments accepted; throws `SproutRuntimeError` for any other arg count or symbol.
- Both forms return the same type as `color(:red)` — a Drawing that sets the pen color for subsequent steps in a sequence.
- `randomColor()` picks uniformly at random from the 9 palette hex values: `#dc2626`, `#2563eb`, `#16a34a`, `#ea580c`, `#9333ea`, `#000000`, `#ffffff`, `#ca8a04`, `#db2777`.
- `randomColor(:any)` generates a random hex string in the form `#rrggbb` where each channel is 0–255.

## Architecture

Only `packages/lang/src/interpreter.ts` changes in `@sprout/lang`. No changes to `values.ts`, `renderer.ts`, or `index.ts` — `mkColor` already accepts arbitrary hex strings, and there is no new Drawing variant.

### `packages/lang/src/interpreter.ts`

New BUILTINS entry after `color`:

```typescript
['randomColor', (args) => {
  if (args.length === 0) {
    const keys = Object.keys(COLOR_MAP);
    const hex = COLOR_MAP[keys[Math.floor(Math.random() * keys.length)]];
    return mkColor(hex);
  }
  if (args.length === 1) {
    const sym = args[0];
    if (sym.kind !== 'symbol' || sym.name !== 'any') {
      throw new SproutRuntimeError(
        `randomColor: expected no arguments or :any, got ${sym.kind === 'symbol' ? ':' + sym.name : sym.kind}`
      );
    }
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return mkColor(hex);
  }
  throw new SproutRuntimeError(`randomColor expects 0 or 1 arguments, got ${args.length}`);
}],
```

### `packages/blocks/src/definitions/statements.ts`

New `sprout_random_color` block after `sprout_color`, using a dropdown with two options:

```typescript
Blockly.Blocks['sprout_random_color'] = {
  init(this: Blockly.Block) {
    this.appendDummyInput()
      .appendField('random color')
      .appendField(
        new Blockly.FieldDropdown([
          ['palette', 'palette'],
          ['any',     'any'],
        ]) as unknown as Blockly.Field,
        'MODE',
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(20);
  },
};
```

### `packages/blocks/src/compiler.ts`

Add `'sprout_random_color'` to the `compileStmt` case group (alongside `'sprout_color'`). Add case in `compileExprBlock`:

```typescript
case 'sprout_random_color': {
  const mode = block.getFieldValue('MODE') as string;
  const args = mode === 'any'
    ? [{ kind: 'SymbolLit' as const, name: 'any' }]
    : [];
  return { kind: 'CallExpr', callee: 'randomColor', args, block: null };
}
```

### `apps/ide/src/BlockWorkspace.tsx`

Add `{ kind: 'block', type: 'sprout_random_color' }` after `sprout_color` in the toolbox.

## Testing

### `packages/lang/tests/interpreter.test.ts` — `describe('randomColor builtin')`

- `randomColor()` result equals one of the 9 `mkColor(paletteHex)` values (the Drawing has field `color`, not `hex`)
- `randomColor(:any)` result's `.color` field matches `/^#[0-9a-f]{6}$/`
- `randomColor(:bad)` throws `SproutRuntimeError` matching `/randomColor/`
- `randomColor(1, 2)` throws `SproutRuntimeError` matching `/randomColor/`

### `packages/blocks/tests/compiler.test.ts` — `describe('randomColor block')`

- `sprout_random_color` with MODE="palette" → `ExprStmt { expr: CallExpr { callee: 'randomColor', args: [] } }`
- `sprout_random_color` with MODE="any" → `ExprStmt { expr: CallExpr { callee: 'randomColor', args: [SymbolLit('any')] } }`

## Files Changed

| File | Change |
|---|---|
| `packages/lang/src/interpreter.ts` | Add `randomColor` builtin |
| `packages/lang/tests/interpreter.test.ts` | Add `describe('randomColor builtin')` |
| `packages/blocks/src/definitions/statements.ts` | Add `sprout_random_color` block |
| `packages/blocks/src/compiler.ts` | Add `sprout_random_color` to `compileStmt` and `compileExprBlock` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('randomColor block')` |
| `apps/ide/src/BlockWorkspace.tsx` | Add `sprout_random_color` to toolbox |

## Out of Scope

- Named color generation beyond the 9-color palette (use `:any` for that)
- Seeded randomness / reproducible sequences
- `randomColor` accepting a list of specific colors to choose from
