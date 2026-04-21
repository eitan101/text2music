import { describe, it, expect, vi } from 'vitest';
import { parseMusic } from './parser';

// Mock Tone.js since parser uses Tone.Frequency
vi.mock('tone', () => ({
  Frequency: (pitch) => ({
    toNote: () => {
      // Very simple mock for toNote
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const name = notes[pitch % 12];
      const oct = Math.floor(pitch / 12);
      return `${name}${oct}`;
    }
  })
}));

describe('parseMusic', () => {
  it('should parse @TEMPO and @SIGNATURE', () => {
    const script = `@TEMPO: 140
@SIGNATURE: 3/4`;
    const result = parseMusic(script);
    expect(result.tempo).toBe(140);
    expect(result.signature).toEqual([3, 4]);
  });

  it('should parse channels and instruments', () => {
    const script = `CH1 @INST: PIANO
CH2 @INST: CELLO`;
    const result = parseMusic(script);
    expect(result.channels['1'].instrument).toBe('PIANO');
    expect(result.channels['2'].instrument).toBe('CELLO');
  });

  it('should parse numerical durations correctly', () => {
    const script = `CH1: C4-4 E4-3 G4-0.5`;
    const result = parseMusic(script);
    const notes = result.channels['1'].notes;
    
    expect(notes[0].duration).toBe(4);
    expect(notes[1].duration).toBe(3);
    expect(notes[2].duration).toBe(0.5);
    
    // Check starts
    expect(notes[0].start).toBe(0);
    expect(notes[1].start).toBe(4);
    expect(notes[2].start).toBe(7);
  });

  it('should parse short chord notation', () => {
    const script = `CH1: Cm-4`;
    const result = parseMusic(script);
    const chord = result.channels['1'].notes[0].chord;
    
    // Cm in octave 4: C4 (48), Eb4 (51), G4 (55)
    expect(chord).toHaveLength(3);
    expect(chord[0].name).toBe('C4');
    expect(chord[1].name).toBe('D#4'); // Eb4 is D#4 in our simple mock
    expect(chord[2].name).toBe('G4');
  });

  it('should handle rests (R)', () => {
    const script = `CH1: C4-1 R-2 G4-1`;
    const result = parseMusic(script);
    const notes = result.channels['1'].notes;
    
    expect(notes).toHaveLength(2); // Rest is not a note object
    expect(notes[0].name).not.toBe('R');
    expect(notes[0].start).toBe(0);
    expect(notes[1].start).toBe(3); // 1 (C4) + 2 (Rest)
  });

  it('should calculate totalBeats correctly', () => {
    const script = `CH1: C4-4
CH2: G4-6`;
    const result = parseMusic(script);
    expect(result.totalBeats).toBe(6);
  });

  it('should parse volume directives', () => {
    const script = `CH1 @INST: PIANO @VOL: 80
CH2 @VOL: 50
CH2 @INST: CELLO`;
    const result = parseMusic(script);
    expect(result.channels['1'].volume).toBe(80);
    expect(result.channels['2'].volume).toBe(50);
    expect(result.channels['1'].instrument).toBe('PIANO');
    expect(result.channels['2'].instrument).toBe('CELLO');
  });

  it('should default volume to 100', () => {
    const script = `CH1 @INST: PIANO`;
    const result = parseMusic(script);
    expect(result.channels['1'].volume).toBe(100);
  });

  it('should parse E7 as a chord when @TYPE: CHORDS is specified', () => {
    const script = `CH1 @TYPE: CHORDS
CH1: E7-1`;
    const result = parseMusic(script);
    const chord = result.channels['1'].notes[0].chord;
    
    // E7 chord should have 4 notes
    expect(chord.length).toBe(4);
  });

  it('should parse E7 as a note in octave 7 when @TYPE: MELODY is specified', () => {
    const script = `CH1 @TYPE: MELODY
CH1: E7-1`;
    const result = parseMusic(script);
    const chord = result.channels['1'].notes[0].chord;
    
    expect(chord.length).toBe(1);
    expect(chord[0].name).toBe('E7');
  });
});
