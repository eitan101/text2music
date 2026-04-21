# Text2Music Architecture Report

## Overview
The 'text2music' project is a React-based web application called 'MelodyScript Studio'. It allows users to write music using a custom text-based DSL (MelodyScript) and play it back using the Tone.js library.

## Architecture Overview
- **Frontend**: Built with React 19 and Vite.
- **Audio Engine**: Powered by Tone.js. It includes a custom Metronome logic using `MembraneSynth`.
- **Domain Logic**:
  - **MelodyScript Parser (`src/parser.js`)**: A regex-based parser that converts the text script into a structured data object. It supports numerical beat durations (e.g., `-4` for 4 beats), short chord notation (e.g., `Cm`), and directives for `@TITLE`, `@TEMPO` and `@SIGNATURE`.
  - **Playback Controller**: Uses `Tone.Transport` to schedule events. Supports seeking to specific beats, jumping to next/previous bars, auto-scrolling during playback, and auto-stopping when the composition ends.
  - **MIDI Integration**: Uses `@tonejs/midi` to convert MIDI files into MelodyScript format.
- **Visualization**: A custom Canvas-based sequencer view that renders notes and a moving playhead. It supports horizontal scrolling, dynamic grid lines, and click-to-seek functionality.
- **State Persistence**: The MelodyScript input is automatically synchronized with the URL hash. It uses `lz-string` for compression to ensure that even long compositions can be shared via a simple URL.
- **Styling**: Modern UI using Tailwind CSS 4 and Lucide icons.

## Key Components & Relationships
1. **Script Editor**: A textarea where the user inputs MelodyScript. Changes trigger a re-parse via `src/parser.js`.
2. **Parser (useMemo)**: Transforms the script into a play-ready data structure. Now supports numerical durations (v0.6.7).
3. **Instrument Loader**: An effect that asynchronously loads samples or initializes synths.
4. **Playback System**: Manages start/stop/pause states and coordinates with the Tone.js Transport. Includes a real-time toggleable Metronome and bar-jumping controls.
5. **Canvas Sequencer**: Visualizes the music data with a centered playhead during auto-scroll. Allows clicking to seek to a specific position.

## Key Files & Locations
- **`src/App.jsx`**: The main UI component and orchestration layer.
- **`src/parser.js`**: Core parsing logic for MelodyScript.
- **`src/utils.js`**: Shared utility functions (e.g., `beatsToTransportTime`).
- **`src/App.test.jsx` & `src/parser.test.js`**: Test suites for UI and logic.
- **`package.json`**: Project dependencies and scripts (including `npm run test`).

## Insights
- **Numerical Durations**: v0.6.7 switched from fractional notation (`1`, `2`, `4`) to direct beat counts (`4`, `2`, `1`).
- **Metronome**: A dynamic audio/visual feature that can be toggled during playback.
- **Auto-Scroll**: Sequencer scrolls to keep the playhead centered during playback.
- **Interactive Playhead**: The playhead can be controlled via jump buttons or by clicking directly on the sequencer timeline.
