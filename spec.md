# MelodyScript Language Specification
**Version:** 0.6.7

MelodyScript is a text-based Domain Specific Language (DSL) used to sequence music in the MelodyScript Studio.

## 1. Global Directives
Global directives configure the overall composition. They should be placed at the top of the file.

- **`@TEMPO: <bpm>`**: Sets the playback speed in Beats Per Minute.
  - *Example:* `@TEMPO: 120`
- **`@SIGNATURE: <numerator>/<denominator>`**: Sets the time signature.
  - *Example:* `@SIGNATURE: 4/4` or `@SIGNATURE: 3/4`

## 2. Channels and Instruments
Each track in MelodyScript is a "Channel" (CH1, CH2, etc.). You must assign an instrument to a channel before writing notes for it.

- **Initialization Syntax:** `CH<number> @INST: <INSTRUMENT_NAME>`
  - *Example:* `CH1 @INST: PIANO`
- **Supported Instruments:**
  `BASS-ELECTRIC`, `BASSOON`, `CELLO`, `CLARINET`, `CONTRABASS`, `FLUTE`, `FRENCH-HORN`, `GUITAR-ACOUSTIC`, `GUITAR-ELECTRIC`, `GUITAR-NYLON`, `HARMONIUM`, `HARP`, `ORGAN`, `PIANO`, `SAXOPHONE`, `TROMBONE`, `TRUMPET`, `TUBA`, `VIOLIN`, `XYLOPHONE`.

## 3. Writing Sequences
Sequence lines define the actual notes, chords, and rests to be played on a specific channel.

- **Sequence Syntax:** `CH<number>: <Event> <Event> ...`
  - *Example:* `CH1: C4-1 D4-1 E4-2`

### Duration System (Numerical Beats)
The duration is appended to the end of any event using a hyphen (`-`). **The duration represents the exact number of beats.**
- `-4` = 4 beats (A whole bar in 4/4)
- `-3` = 3 beats (A whole bar in 3/4)
- `-1` = 1 beat (A quarter note)
- `-0.5` = 0.5 beats (An eighth note)
- `-1.5` = 1.5 beats (A dotted quarter note)

### Event Types

#### A. Single Notes
Format: `<Pitch><Octave>-<Duration>`
- *Example:* `C4-1` (Middle C for 1 beat), `F#5-0.5` (F-sharp, octave 5, half beat)

#### B. Rests
Format: `R-<Duration>`
- *Example:* `R-2` (Rest for 2 beats)

#### C. Short Chords
Format: `<Root><Quality>-<Duration>`
By default, short chords are played in **Octave 4**.
- **Qualities Supported:** `''` (Major), `m` / `min` (Minor), `maj` (Major), `7` (Dominant 7), `maj7`, `m7`, `sus2`, `sus4`, `aug`, `dim`.
- *Example:* `C-4` (C Major for 4 beats), `Am-2` (A Minor for 2 beats), `G7-1` (G Dominant 7 for 1 beat).

#### D. Slash Chords (Inversions / Alternative Bass)
Format: `<Chord>/<BassPitch>-<Duration>`
- *Example:* `C/E-2` (C Major chord with an E in the bass for 2 beats).

#### E. Explicit Multi-Note Chords
Format: `<Note1>+<Note2>+<Note3>-<Duration>`
- *Example:* `C4+E4+G4-2` (Plays exactly those three notes for 2 beats).

## 4. Formatting and Comments
- **Comments:** Any line starting with `//` is ignored.
- **Bar Lines (`|`):** You can use the pipe character `|` anywhere in the sequence to visually separate bars for readability. The parser completely ignores it.
  - *Example:* `CH1: C-4 | F-4 | G-4 | C-4`
