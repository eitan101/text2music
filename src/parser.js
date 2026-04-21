import * as Tone from 'tone';

export const NOTE_TO_FREQ = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const CHORD_QUALITIES = {
  '': [0, 4, 7], // Major
  'm': [0, 3, 7], // Minor
  'min': [0, 3, 7],
  'maj': [0, 4, 7],
  '7': [0, 4, 7, 10], // Dominant 7th
  'maj7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
  'aug': [0, 4, 8],
  'dim': [0, 3, 6]
};

const parseShortChord = (match, bassNote, chordNotes) => {
  const [_, root, quality = ''] = match;
  const oct = 4;
  const rootPitch = (oct * 12) + NOTE_TO_FREQ[root.toUpperCase()];
  const intervals = CHORD_QUALITIES[quality];
  
  if (intervals) {
    let calculatedIntervals = [...intervals];
    
    if (bassNote) {
      const bassPitchClass = NOTE_TO_FREQ[bassNote.toUpperCase()];
      const rootPitchClass = NOTE_TO_FREQ[root.toUpperCase()];
      const chordPitches = intervals.map(i => (rootPitchClass + i) % 12);
      const bassIndex = chordPitches.indexOf(bassPitchClass);
      
      if (bassIndex !== -1) {
        calculatedIntervals = [
          ...intervals.slice(bassIndex),
          ...intervals.slice(0, bassIndex).map(i => i + 12)
        ];
      } else {
        const bassPitch = (3 * 12) + bassPitchClass;
        chordNotes.push({
          pitch: bassPitch,
          name: Tone.Frequency(bassPitch, "midi").toNote()
        });
      }
    }
    
    calculatedIntervals.forEach(interval => {
      const pitch = rootPitch + interval;
      const noteName = Tone.Frequency(pitch, "midi").toNote();
      chordNotes.push({ pitch, name: noteName });
    });
  }
};

export const parseMusic = (script) => {
  try {
    const channels = {};
    let parsedTempo = null;
    let parsedSignature = null;
    let parsedTitle = null;
    const lines = script.split('\n');

    lines.forEach(line => {
      // Strip inline comments: everything after //
      const commentIndex = line.indexOf('//');
      const cleanLine = commentIndex !== -1 ? line.substring(0, commentIndex) : line;
      
      const trimmed = cleanLine.trim();
      if (!trimmed) return;

      const titleMatch = trimmed.match(/^@TITLE:\s*(.*)$/i);
      if (titleMatch) {
        parsedTitle = titleMatch[1].trim();
        return;
      }

      const tempoMatch = trimmed.match(/^@TEMPO:\s*(\d+)$/i);
      if (tempoMatch) {
        parsedTempo = parseInt(tempoMatch[1], 10);
        return;
      }

      const sigMatch = trimmed.match(/^@SIGNATURE:\s*(\d+)\/(\d+)$/i);
      if (sigMatch) {
        parsedSignature = [parseInt(sigMatch[1], 10), parseInt(sigMatch[2], 10)];
        return;
      }

      const instMatch = trimmed.match(/^CH(\d+)\s+@INST:\s*([\w-]+)(?:\s+@VOL:\s*(\d+))?$/i);
      if (instMatch) {
        const chNum = instMatch[1];
        const instType = instMatch[2].toUpperCase();
        const vol = instMatch[3] ? parseInt(instMatch[3], 10) : null;
        if (!channels[chNum]) channels[chNum] = { notes: [], totalDuration: 0, instrument: 'PIANO', volume: 100, type: 'MELODY' };
        channels[chNum].instrument = instType;
        if (vol !== null) channels[chNum].volume = Math.max(0, Math.min(100, vol));
        return;
      }

      const typeMatch = trimmed.match(/^CH(\d+)\s+@TYPE:\s*(CHORDS|MELODY)$/i);
      if (typeMatch) {
        const chNum = typeMatch[1];
        const type = typeMatch[2].toUpperCase();
        if (!channels[chNum]) channels[chNum] = { notes: [], totalDuration: 0, instrument: 'PIANO', volume: 100, type: 'MELODY' };
        channels[chNum].type = type;
        return;
      }

      const volMatch = trimmed.match(/^CH(\d+)\s+@VOL:\s*(\d+)$/i);
      if (volMatch) {
        const chNum = volMatch[1];
        const vol = parseInt(volMatch[2], 10);
        if (!channels[chNum]) channels[chNum] = { notes: [], totalDuration: 0, instrument: 'PIANO', volume: 100, type: 'MELODY' };
        channels[chNum].volume = Math.max(0, Math.min(100, vol));
        return;
      }

      const match = trimmed.match(/^CH(\d+):\s*(.*)$/i);
      if (!match) return;

      const chNum = match[1];
      const tokensStr = match[2];
      if (!channels[chNum]) channels[chNum] = { notes: [], totalDuration: 0, instrument: 'PIANO', volume: 100, type: 'MELODY' };

      const channelType = channels[chNum].type;
      const tokens = tokensStr.split(/\s+/);
      tokens.forEach(token => {
        if (token === '|') {
          return;
        }

        const parts = token.split('-');
        if (parts.length !== 2) return;

        const notesPart = parts[0]; 
        const durKey = parts[1];

        const duration = parseFloat(durKey) || 1;

        if (notesPart.toUpperCase() === 'R') {
          channels[chNum].totalDuration += duration;
          return;
        }

        const individualNotes = notesPart.split('+');
        const chordNotes = [];

        individualNotes.forEach(noteStr => {
          const slashParts = noteStr.split('/');
          const chordBase = slashParts[0];
          const bassNote = slashParts[1];

          // Priority logic based on channel type
          const noteMatch = chordBase.match(/^([A-Ga-g]#?|[A-Ga-g]b?)(\d)$/);
          const shortChordMatch = chordBase.match(/^([A-Ga-g]#?|[A-Ga-g]b?)(m|maj|min|7|maj7|m7|sus2|sus4|aug|dim)?$/);

          if (channelType === 'CHORDS' && shortChordMatch) {
             // Prefer chord if it's a CHORDS channel
             parseShortChord(shortChordMatch, bassNote, chordNotes);
          } else if (noteMatch && !bassNote) {
            // Prefer note if it's MELODY channel or if it didn't match chord
            const [_, name, oct] = noteMatch;
            const pitch = (parseInt(oct) * 12) + NOTE_TO_FREQ[name.toUpperCase()];
            chordNotes.push({ pitch, name: `${name}${oct}` });
          } else if (shortChordMatch) {
            // Fallback for MELODY channel if it matches chord but not note
            parseShortChord(shortChordMatch, bassNote, chordNotes);
          }
        });

        if (chordNotes.length > 0) {
          channels[chNum].notes.push({
            chord: chordNotes,
            start: channels[chNum].totalDuration,
            duration
          });
          channels[chNum].totalDuration += duration;
        }
      });
    });
    let maxBeats = 0;
    Object.values(channels).forEach(ch => {
      if (ch.totalDuration > maxBeats) maxBeats = ch.totalDuration;
    });
    return { title: parsedTitle, channels, tempo: parsedTempo, signature: parsedSignature, totalBeats: maxBeats };
  } catch (e) {
    console.error("Parse error:", e);
    return { title: null, channels: {}, tempo: null, signature: null, totalBeats: 0 };
  }
};
