# More Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard events (`:left`, `:right`, `:up`, `:down`, `:space`) and a timer event (`:timer`) that fire zero-arg handlers and accumulate drawing output, following the existing `:click` pattern.

**Architecture:** The `sprout_on_event` Blockly block dropdown gains 6 new options (replacing `keydown`). App.tsx gains a stable `handlersRef` to avoid stale closures, a `keydown` window listener, and a `setInterval`-based timer that starts after Run and is cleared at the next Run. No lang changes needed — all new events register as zero-arg `SproutFunction` handlers under their symbol key (e.g. `':left'`).

**Tech Stack:** TypeScript, React, Vitest, Blockly 10, pnpm monorepo (`@sprout/blocks`, `@sprout/ide`)

---

## File Map

| File | Change |
|---|---|
| `packages/blocks/src/definitions/statements.ts` | Replace `keydown` dropdown option with `left`, `right`, `up`, `down`, `space`; add `timer` |
| `packages/blocks/tests/compiler.test.ts` | Add `describe('on event block — new events')` with 6 tests |
| `apps/ide/src/App.tsx` | Add `handlersRef`, `timerRef`, update `handleRun`, add keydown/timer effects, add hint line |

---

### Task 1: `sprout_on_event` block dropdown + compiler tests

**Files:**
- Modify: `packages/blocks/src/definitions/statements.ts`
- Test: `packages/blocks/tests/compiler.test.ts`

- [ ] **Step 1: Write the failing tests**

Append after the last `describe` block at the end of `packages/blocks/tests/compiler.test.ts` (after the closing `});` of `describe('randomColor block', ...)`):

```typescript
describe('on event block — new events', () => {
  const NEW_EVENTS = ['left', 'right', 'up', 'down', 'space', 'timer'] as const;

  for (const event of NEW_EVENTS) {
    it(`sprout_on_event with EVENT="${event}" compiles to OnExpr(:${event})`, () => {
      const ws = makeWorkspace();
      const block = ws.newBlock('sprout_on_event');
      block.setFieldValue(event, 'EVENT');
      (ws as unknown as { topBlocks_: Blockly.Block[] }).topBlocks_ = [block];

      const result = compileWorkspace(ws);
      expect(result).toEqual({
        kind: 'Program',
        stmts: [{
          kind: 'ExprStmt',
          expr: {
            kind: 'OnExpr',
            event: { kind: 'SymbolLit', name: event },
            body: { kind: 'BlockExpr', body: [] },
          },
        }],
      });
      ws.dispose();
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd D:\Projects\kider\packages\blocks && bun test tests/compiler.test.ts
```

Expected: 6 FAIL — `setFieldValue(event, 'EVENT')` silently keeps `'click'` (the first dropdown option) when the value isn't in the dropdown, so compiled `event.name` is `'click'` not the expected value.

- [ ] **Step 3: Update the `sprout_on_event` dropdown in `statements.ts`**

In `packages/blocks/src/definitions/statements.ts`, find the `sprout_on_event` block (around line 108). Replace the `FieldDropdown` array:

**Old:**
```typescript
          new Blockly.FieldDropdown([
            ['click', 'click'],
            ['load', 'load'],
            ['keydown', 'keydown'],
          ]) as unknown as Blockly.Field,
```

**New:**
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

- [ ] **Step 4: Run tests to verify they pass**

```
cd D:\Projects\kider\packages\blocks && bun test tests/compiler.test.ts
```

Expected: All compiler tests PASS (existing + 6 new).

- [ ] **Step 5: Commit**

```
git add packages/blocks/src/definitions/statements.ts packages/blocks/tests/compiler.test.ts
git commit -m "feat(blocks): add left/right/up/down/space/timer options to on_event block"
```

---

### Task 2: Wire keyboard events and timer in `App.tsx`

**Files:**
- Modify: `apps/ide/src/App.tsx`

This task has no failing unit tests — App.tsx is a React component not covered by unit tests. After implementation, verify manually that:
- Pressing arrow keys and space fires the corresponding handler
- `on(:timer, ...)` accumulates drawing at ~5fps after Run
- The hint line appears when key/timer handlers are active

- [ ] **Step 1: Add `handlersRef` and `timerRef` refs**

In `apps/ide/src/App.tsx`, after line 85 (`const [handlers, setHandlers] = useState...`), add two refs:

```typescript
  const handlersRef = useRef<Map<string, SproutFunction>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

- [ ] **Step 2: Replace `handleRun` to clear/start timer and update `handlersRef`**

Replace the entire `handleRun` function (lines 87–112) with:

```typescript
  function handleRun() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      setError(null);
      let program;
      if (sourceMode === 'blocks') {
        const ws = wsRef.current;
        if (!ws) return;
        program = compileWorkspace(ws);
      } else {
        program = parse(editorText);
      }
      const { drawing, handlers: h } = interpretFull(program);
      accDrawingRef.current = drawing;
      handlersRef.current = h;
      setHandlers(h);
      setCommands(render(drawing));
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
    } catch (e) {
      if (e instanceof SproutRuntimeError || e instanceof ParseError) {
        setError(e.message);
      } else {
        setError(String(e));
      }
      setCommands([]);
      setHandlers(new Map());
      handlersRef.current = new Map();
      accDrawingRef.current = null;
    }
  }
```

- [ ] **Step 3: Add keydown and timer-cleanup `useEffect`s**

After the last `useEffect` in `App.tsx` (the URL share effect, around line 81), append these two effects:

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

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);
```

- [ ] **Step 4: Add hint line for keyboard/timer handlers**

In the JSX, find the existing click-handler hint (around line 361–365):

```tsx
        {hasClickHandler && (
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            Click the canvas to fire the :click handler
          </div>
        )}
```

After that block, add:

```tsx
        {(handlers.has(':left') || handlers.has(':right') || handlers.has(':up') ||
          handlers.has(':down') || handlers.has(':space') || handlers.has(':timer')) && (
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            {[
              (handlers.has(':left') || handlers.has(':right') || handlers.has(':up') ||
               handlers.has(':down') || handlers.has(':space')) ? '← → ↑ ↓ space active' : '',
              handlers.has(':timer') ? 'timer active (200ms)' : '',
            ].filter(Boolean).join(' · ')}
          </div>
        )}
```

- [ ] **Step 5: Run the full test suite**

```
cd D:\Projects\kider && bun test
```

Expected: All tests PASS (393+ tests, 0 failures).

- [ ] **Step 6: Commit**

```
git add apps/ide/src/App.tsx
git commit -m "feat(ide): add keyboard events (left/right/up/down/space) and timer event"
```
