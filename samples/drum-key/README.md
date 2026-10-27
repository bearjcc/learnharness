# Drum key notation samples

These ABC snippets show **one quarter note** per kit voice on a single 4/4 percussion staff, rendered through the same `abcjs` pipeline as groove cards (`%%percmap`, `%%score` not needed for single-voice bars).

## Authority

Head shapes and staff positions follow the **Percussive Arts Society / Norman Weinberg** *Guide to Standardized Drumset Notation* in broad strokes, with Wikipedia’s [Percussion notation](https://en.wikipedia.org/wiki/Percussion_notation) and [Drum kit](https://en.wikipedia.org/wiki/Drum_kit) articles as secondary references. Each imported entry cites those sources.

## Deviations from method books

- **Pitch letters** (`F`, `^c`, `^^g`, …) are ABC **placement** on a five-line staff, not literal concert pitches; `%%percmap` binds them to General MIDI-style noteheads for rendering.
- **Open hi-hat** uses abcjs’s `!open!` decoration on an `x` notehead rather than a separate “open circle” glyph some books draw by hand.
- **Ghost notes** use ABC parentheses `(^c)`; abcjs renders them softer/smaller—close to, but not identical to, every published ghost symbol.
- **Ride bell** uses a **diamond** notehead on the same staff line as the ride cymbal (`^f`), matching “same line, different head” conventions.
- **Cross-stick** uses an **x** notehead on the snare line (`%%percmap … x`); PAS “circle-x” is not available in abcjs, so we use a plain x on C5.
- **Rimshot** uses abcjs **`rhythm`** (slash) noteheads, not a separate “slash” percmap token.

Re-import drum-key entries after changing ABC so Choice media tokens refresh.
