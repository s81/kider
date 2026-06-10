# Sound Design

**Date:** 2026-06-10
**Status:** Approved

## Goal

Give kids audio feedback for their games and programs: a zero-friction `beep()` for
game events (pairs with the just-shipped collision detection — beep when you catch
something) and `playNote(note, seconds)` for melodies.

## Approach

Sound reuses the existing effect pipeline that `wait` proved out:
Drawing node → renderer command → IDE playback segment. A sound behaves like a
`wait` that also makes noise: during animated playback the IDE plays the tone AND
holds for its duration, so consecutive `playNote` calls become a melody with no
extra sequencing concepts.

Rejected alternatives:
- **Fire-and-forget sounds in the main program** (no hold) — overlapping tones turn
  melodies into chords; kids can't sequence notes without learning `wait`.
- **Sample/clip playback (`playSound(:pop)`)** — needs bundled audio assets in the
  IDE; oscillator tones need zero assets and teach pitch. Presets can come later.

## Language semantics

- `playNote(note, seconds)` — exactly 2 args.
  - `note` is a string note name (`"C4"`, `"F#3"`, `"Bb2"` — letter A–G, optional
    `#`/`b`, octave digit 0–8) or a number (frequency in Hz, must be > 0).
  - `seconds` is a number >= 0.
  - Note names convert to frequency at interpret time via equal temperament
    (A4 = 440 Hz; `freq = 440 * 2^((midi - 69) / 12)`). Bad note names throw
    `SproutRuntimeError` (`playNote: unknown note 'X9'`).
  - Returns a drawing value `{ kind: 'sound', frequency, seconds }` — composable
    like any drawing (sequences, repeat bodies, handler bodies).
- `beep()` — exactly 0 args. Shorthand for an 880 Hz, 0.2 s blip:
  `{ kind: 'sound', frequency: 880, seconds: 0.2 }`.
- No parser or serializer changes (ordinary call expressions).

## Pipeline changes

- **values.ts**: `SoundDrawing { kind: 'sound'; frequency; seconds }`, `mkSound()`,
  added to the `Drawing` union. Export from index.
- **interpreter.ts**: `playNote` + `beep` builtins; `noteToFrequency()` helper;
  add `'sound'` to the drawing-kind case lists (same spots `'wait'` appears).
- **renderer.ts**: `CanvasCommand` gains
  `{ kind: 'sound'; frequency; durationMs }`; `renderInto` emits it;
  `scaleDrawing` passes it through unchanged (scale affects geometry, not audio).
- **stage-utils.ts (IDE)**: `drawUpTo` ignores `'sound'` (like `'wait'`);
  `PlaybackSegment` gains `{ kind: 'sound'; frequency; durationMs }`;
  `buildPlayback` flushes the draw segment and pushes a sound segment (same
  control flow as `wait`).
- **App.tsx (IDE)**:
  - `startPlayback`: a `'sound'` segment plays a tone via Web Audio and holds
    `durationMs` (same setTimeout pattern as `wait`).
  - `handleRun`: trigger playback when commands contain `'sound'` OR `'wait'`.
  - `applyHandlerDelta`: event/timer handler deltas don't run playback, so any
    `'sound'` commands in the delta fire immediately (fire-and-forget). This is
    the game path: beep on collision inside an `on click` / timer handler.
  - Audio: one lazily-created shared `AudioContext` (created on first sound —
    always downstream of a user gesture since Run/click/key starts everything).
    Tone = oscillator (triangle wave, gentler than square) + gain envelope with a
    short release to avoid clicks. Volume fixed at a modest level.
- **Toolbox**: `sprout_beep` and `sprout_play_note` next to `sprout_wait`.

## Blocks

- `sprout_beep` — statement block, dummy field "beep", colour 330 (wait's colour).
  Compiles to `CallExpr beep []`.
- `sprout_play_note` — statement block: "play note [NOTE dropdown] for [SECS] seconds",
  NOTE dropdown covering C4–C5 (C4 D4 E4 F4 G4 A4 B4 C5), SECS a Number value
  input, colour 330. Compiles to `CallExpr playNote [StringLit note, secs]`.
  (Text mode accepts the full note grammar; the dropdown keeps blocks simple.)

## Testing

- lang: playNote("A4", 0.5) → frequency 440; "C4" ≈ 261.63 (closeTo);
  numeric frequency passes through; "F#3"/"Bb2" accidentals; unknown note throws;
  arity errors; beep() → 880 Hz / 0.2 s; sounds sequence inside repeat;
  renderer emits `{kind:'sound', frequency, durationMs}` in order between draw
  commands; scaleDrawing leaves sound untouched.
- blocks: both blocks compile to the right CallExpr.
- ide: buildPlayback splits draw/sound segments correctly (mirrors wait behavior).
  Web Audio itself is not unit-tested (no audio device in test env).
