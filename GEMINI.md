# Project Instructions for AI Agents

Welcome to the MelodyScript Studio project. This is a React + Tone.js application for text-to-music composition.

## Mandatory Reading
- **`architecture.md`**: Read this first to understand the system architecture, file structure, and core logic.
- **`spec.md`**: This is the ultimate source of truth for the MelodyScript Domain Specific Language (DSL). You must strictly follow this specification when writing, reading, or updating the user's music text input.

## Core Rules for Modification
1. **Maintain Documentation**: Whenever you change the system architecture, add new features, or change the MelodyScript DSL syntax, you **MUST** update `architecture.md` and `spec.md` immediately. Do not let the specification drift from the actual parser implementation.
2. **Test-Driven Development**:
    - Always update or add tests for new features.
    - Logic changes (parser, utilities) should be unit tested in `src/parser.test.js` or similar.
    - Component changes should be tested in `src/App.test.jsx`.
    - Run `npm run test` to verify your changes.
3. **Keep GEMINI.md Updated**: If you change the project's development workflow or add new mandatory standards, update this file.
4. **Tone.js Standards**: We use `Tone.Transport` for all timing. Do not use `setInterval` or `setTimeout` for audio-related timing.

## Recent Architectural Shifts
- **v0.6.7**: Moved from fractional durations (`-4`, `-2`, `-1`) to **Numerical Beat Durations**. A number after a hyphen now represents the exact number of beats (e.g., `-3` is always 3 beats).
- **Auto-Scroll**: The sequencer visualizer auto-scrolls to keep the playhead centered during playback.
- **Dynamic Signature**: Bar lines are drawn dynamically based on the `@SIGNATURE` directive, ignoring `|` characters in the text.
