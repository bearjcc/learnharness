# Drum key notation samples

These ABC snippets show **one quarter note** per kit voice on a single 4/4 percussion staff, rendered through the same `abcjs` pipeline as groove cards (`%%percmap`, `%%score` not needed for single-voice bars).

## Authority

Head shapes and staff positions follow the **Percussive Arts Society / Norman Weinberg** *Guide to Standardized Drumset Notation* in broad strokes, with Wikipedia’s [Percussion notation](https://en.wikipedia.org/wiki/Percussion_notation) and [Drum kit](https://en.wikipedia.org/wiki/Drum_kit) articles as secondary references. Each imported entry cites those sources.

## Deviations from method books

- **Pitch letters** (`F`, `^c`, `^g`, …) are ABC **placement** on a five-line staff, not literal concert pitches; `%%percmap` keys must match [abcjs `pitchesToPerc`](https://github.com/paulrosen/abcjs) (single `^` / `_` accidentals only — `^^` / `^^^` do **not** map and break noteheads).
- **Open hi-hat** uses abcjs’s `!open!` decoration on an `x` notehead rather than a separate “open circle” glyph some books draw by hand.
- **Ghost notes** use ABC parentheses `(^c)`; abcjs renders them softer/smaller—close to, but not identical to, every published ghost symbol.
- **Ride bell** uses abcjs **`triangle`** percmap noteheads (not `diamond`) on the ride line (`^f`).
- **Hi-hat foot** uses lowercase-octave `D` (`abcjs-p1`, below the tom positions), not `_d` on the mid-tom line.
- **Cross-stick** uses an **x** notehead on the snare line (`%%percmap … x`); PAS “circle-x” is not available in abcjs, so we use a plain x on C5.
- **Rimshot** uses abcjs **`rhythm`** (slash) noteheads, not a separate “slash” percmap token.

Re-import drum-key entries after changing ABC so Choice media tokens refresh.
