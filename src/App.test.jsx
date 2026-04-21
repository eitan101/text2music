import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { beatsToTransportTime } from './utils';
import LZString from 'lz-string';

// Mock Tone.js since it's an audio library and might have issues in jsdom
vi.mock('tone', () => {
  return {
    Transport: {
      bpm: { value: 120 },
      timeSignature: 4,
      schedule: vi.fn(),
      scheduleRepeat: vi.fn(),
      clear: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      seconds: 0,
      state: 'stopped',
    },
    MembraneSynth: class {
      constructor() {
        this.volume = { value: 0 };
      }
      toDestination() { return this; }
      triggerAttackRelease() {}
    },
    PolySynth: class {
      toDestination() { return this; }
    },
    Synth: class {},
    Frequency: () => ({
      toNote: () => "C4",
    }),
    start: vi.fn(),
    loaded: vi.fn().mockResolvedValue(),
  };
});

describe('beatsToTransportTime', () => {
  it('should correctly format beats to bars:beats:sixteenths for 4/4 time', () => {
    // 0 beats -> 0 bars, 0 beats, 0 sixteenths
    expect(beatsToTransportTime(0, 4)).toBe('0:0:0');
    
    // 1 beat -> 0:1:0
    expect(beatsToTransportTime(1, 4)).toBe('0:1:0');
    
    // 4 beats -> 1:0:0
    expect(beatsToTransportTime(4, 4)).toBe('1:0:0');
    
    // 4.5 beats -> 1:0:2 (1 bar, 0 beats, 2 sixteenths)
    expect(beatsToTransportTime(4.5, 4)).toBe('1:0:2');
    
    // 5.75 beats -> 1:1:3 (1 bar, 1 beat, 3 sixteenths)
    expect(beatsToTransportTime(5.75, 4)).toBe('1:1:3');
  });

  it('should handle array time signature input [numerator, denominator]', () => {
    expect(beatsToTransportTime(4, [4, 4])).toBe('1:0:0');
    expect(beatsToTransportTime(3, [3, 4])).toBe('1:0:0');
  });

  it('should format beats correctly for 3/4 time', () => {
    // 3 beats -> 1 bar
    expect(beatsToTransportTime(3, 3)).toBe('1:0:0');
    
    // 4 beats -> 1 bar, 1 beat
    expect(beatsToTransportTime(4, 3)).toBe('1:1:0');
  });
});

describe('App Component', () => {
  it('should render the app title', () => {
    render(<App />);
    const titleElements = screen.getAllByText(/My First Song/i);
    expect(titleElements.length).toBeGreaterThan(0);
    // Verify at least one is a heading
    const hasHeading = titleElements.some(el => el.tagName === 'H1');
    expect(hasHeading).toBe(true);
  });

  it('should display the default tempo', () => {
    render(<App />);
    const tempoInput = screen.getByDisplayValue('120');
    expect(tempoInput).toBeInTheDocument();
  });

  it('should allow toggling the metronome', () => {
    render(<App />);
    const metronomeButton = screen.getByTitle('Toggle Metronome');
    expect(metronomeButton).toBeInTheDocument();
    
    // Initial state check - tailwind classes check to see if it's disabled/enabled
    // It should have 'text-slate-500' when disabled
    expect(metronomeButton.className).toContain('text-slate-500');
    
    // Click it to enable
    fireEvent.click(metronomeButton);
    expect(metronomeButton.className).toContain('text-indigo-400');
  });

  it('should allow jumping to next and previous bars', () => {
    render(<App />);
    const nextButton = screen.getByTitle('Next Bar');
    const prevButton = screen.getByTitle('Previous Bar');
    
    expect(nextButton).toBeInTheDocument();
    expect(prevButton).toBeInTheDocument();
    
    // Initial POS check (might need to wait for render if it was dynamic, but POS 0.00 is static on start)
    expect(screen.getByText('0.00')).toBeInTheDocument();
    
    // Jump to next bar (4.00)
    fireEvent.click(nextButton);
    expect(screen.getByText('4.00')).toBeInTheDocument();
    
    // Jump to next bar again (8.00)
    fireEvent.click(nextButton);
    expect(screen.getByText('8.00')).toBeInTheDocument();
    
    // Jump to previous bar (4.00)
    fireEvent.click(prevButton);
    expect(screen.getByText('4.00')).toBeInTheDocument();
  });

  it('should initialize script from URL hash', () => {
    const testScript = "CH1: C4-1";
    const compressed = LZString.compressToEncodedURIComponent(testScript);
    
    // Mock window.location.hash
    delete window.location;
    window.location = { hash: `#${compressed}` };
    
    render(<App />);
    
    const textarea = screen.getByDisplayValue(testScript);
    expect(textarea).toBeInTheDocument();
  });
});
