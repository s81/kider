# More Events Design

**Date:** 2026-06-04  
**Status:** Approved

## Goal

Add keyboard events (`:left`, `:right`, `:up`, `:down`, `:space`) and a timer event (`:timer`) to the IDE. These follow the existing `on(:click, fn)` pattern — zero-arg handlers, accumulated drawing output.

## User Experience

- User writes `on(:left, do...end)` (text) or uses the `on` block with "left" selected (blocks).
- After clicking Run, pressing the left arrow key fires the handler and appends its drawing to the canvas.
- `on(:timer, do...end)` fires every 200ms automatically after Run, accumulating drawing deltas — useful for animation loops.
- A hint line appears below the animation controls when key or timer handlers are active.

## Syntax

```
on(:left,  do forward(10) end)
on(:right, do forward(10) end)
on(:up,    do turn(-10) end)
on(:down,  do turn(10) end)
on(:space, do color(:red) end)
on(:timer, do forward(5) end)
```

All six work identically to `on(:click, fn)` in the lang layer — zero-arg `SproutFunction` stored in env keyed by `':left'`, `':right'`, etc.

## Key Mapping

| Symbol | Browser `e.key` value |
|--------|----------------------|
| `:left`  | `'ArrowLeft'`  |
| `:right` | `'ArrowRight'` |
| `:up`    | `'ArrowUp'`    |
| `:down`  | `'ArrowDown'`  |
| `:space` | `' '`          |

## Architecture

### No Lang Changes

`callHandler`, `interpretFull`, and `evalStmtWithEnv` require no changes. `on(:left, fn)` and `on(:timer, fn)` are registered as zero-arg functions under `':left'` and `':timer'` keys in the environment — same mechanism as `':click'`.

### `packages/blocks/src/definitions/statements.ts`

Update the `sprout_on_event` dropdown. Replace `keydown` with five named key options; append `timer`:

```typescript
new Blockly.FieldDropdown([
  ['click',  'click'],
  ['load',   'load'],
  ['left',   'left'],
  ['right',  'right'],
  ['up',     'up'],
  ['down',   'down'],
  ['space',  'space'],
  ['timer',  'timer'],
]) as unknown as Blockly.Field,
```

### `apps/ide/src/App.tsx`

**New ref for timer interval:**
```typescript
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

**Clear interval at start of `handleRun` (before new run):**
```typescript
if (timerRef.current !== null) {
  clearInterval(timerRef.current);
  timerRef.current = null;
}
```

**After interpretFull in `handleRun`, start timer if handler exists:**
```typescript
const timerFn = h.get(':timer');
if (timerFn) {
  timerRef.current = setInterval(() => {
    if (accDrawingRef.current === null) return;
    try {
      const delta = callHandler(timerFn);
      const next = mkSequence([accDrawingRef.current, delta]);
      accDrawingRef.current = next;
      setCommands(render(next));
    } catch (e) {
      setError(e instanceof SproutRuntimeError ? e.message : String(e));
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, 200);
}
```

**Cleanup interval on unmount:**
```typescript
useEffect(() => {
  return () => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
  };
}, []);
```

**Keydown effect (mount/unmount):**
```typescript
useEffect(() => {
  const KEY_MAP: Record<string, string> = {
    ArrowLeft:  ':left',
    ArrowRight: ':right',
    ArrowUp:    ':up',
    ArrowDown:  ':down',
    ' ':        ':space',
  };
  function onKeyDown(e: KeyboardEvent) {
    const handlerKey = KEY_MAP[e.key];
    if (!handlerKey) return;
    const fn = handlersRef.current.get(handlerKey);
    if (!fn || accDrawingRef.current === null) return;
    e.preventDefault();
    try {
      const delta = callHandler(fn);
      const next = mkSequence([accDrawingRef.current, delta]);
      accDrawingRef.current = next;
      setCommands(render(next));
    } catch (err) {
      setError(err instanceof SproutRuntimeError ? err.message : String(err));
    }
  }
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, []);
```

**`handlersRef`** — a stable ref that tracks the current handlers map so the keydown closure doesn't go stale:
```typescript
const handlersRef = useRef<Map<string, SproutFunction>>(new Map());
// in handleRun, after setHandlers(h):
handlersRef.current = h;
```

**Hint line** — shown when any key or timer handler is active:
```tsx
{(handlers.has(':left') || handlers.has(':right') || handlers.has(':up') ||
  handlers.has(':down') || handlers.has(':space') || handlers.has(':timer')) && (
  <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
    {[
      handlers.has(':left') || handlers.has(':right') || handlers.has(':up') ||
      handlers.has(':down') || handlers.has(':space') ? '← → ↑ ↓ space active' : '',
      handlers.has(':timer') ? 'timer active (200ms)' : '',
    ].filter(Boolean).join(' · ')}
  </div>
)}
```

## Testing

### `packages/blocks/tests/compiler.test.ts` — `describe('on event block — new events')`

Six tests, one per new dropdown value, each verifying the compiled `OnExpr` has the correct event name symbol:

- `sprout_on_event` with EVENT="left" → `OnExpr { event: { name: 'left' }, body: ... }`
- Same for `right`, `up`, `down`, `space`, `timer`

No lang tests needed (event names are arbitrary strings; the existing `on(:click)` tests cover the mechanism).

App.tsx changes are visual — verified manually.

## Files Changed

| File | Change |
|---|---|
| `packages/blocks/src/definitions/statements.ts` | Replace `keydown` with `left`, `right`, `up`, `down`, `space`; add `timer` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('on event block — new events')` |
| `apps/ide/src/App.tsx` | Add `handlersRef`, keydown effect, timer interval, hint line |

## Out of Scope

- Passing the key name as an argument to the handler
- Configurable timer interval
- `on(:load, fn)` wiring (already in dropdown, left for a future pass)
- `on(:keydown, fn)` generic handler (replaced by named key events)
