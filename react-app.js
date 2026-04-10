import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Square, Music, Code, HelpCircle, Save, Download, Settings, ChevronRight, AlertCircle, Volume2, X, Info, Keyboard, Loader2, CloudDownload } from 'lucide-react';

/**
 * MELODYSCRIPT STUDIO v0.6.6
 * Feature: Added support for chords using the "Note+Note+Note-Duration" syntax.
 * Fix: Explicitly forcing .mp3 extension for SampleLibrary.
 */

const DEFAULT_SCRIPT = `// MelodyScript v0.6.6 - Chords Support
CH1 @INST: PIANO
// Chords use the Note+Note-Duration syntax
CH1: C4+E4+G4-2 F4+A4+C5-2 G4+B4+D5-2 C4+E4+G4-1

CH2 @INST: CELLO
CH2: C2-2 F2-2 G2-2 C2-1

// Try: CH1: E4+G4+B4-4 D4+F#4+A4-4`;

const NOTE_TO_FREQ = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const DURATION_MAP = {
  '1': '1n', '2': '2n', '4': '4n', '8': '8n', '16': '16n'
};

const DURATION_VALS = {
  '1': 4, '2': 2, '4': 1, '8': 0.5, '16': 0.25
};

const SUPPORTED_INSTRUMENTS = [
  'BASS-ELECTRIC', 'BASSOON', 'CELLO', 'CLARINET', 'CONTRABASS',
  'FLUTE', 'FRENCH-HORN', 'GUITAR-ACOUSTIC', 'GUITAR-ELECTRIC', 'GUITAR-NYLON',
  'HARMONIUM', 'HARP', 'ORGAN', 'PIANO', 'SAXOPHONE', 'TROMBONE',
  'TRUMPET', 'TUBA', 'VIOLIN', 'XYLOPHONE'
];

const App = () => {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPos, setPlaybackPos] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [showHelp, setShowHelp] = useState(false);

  const [libLoaded, setLibLoaded] = useState(false);
  const [libError, setLibError] = useState(false);

  const [loadingInstruments, setLoadingInstruments] = useState(new Set());
  const [loadedInstruments, setLoadedInstruments] = useState(new Set());

  const loadingRef = useRef(new Set());
  const loadedRef = useRef(new Set());
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastPosRef = useRef(0);
  const instrumentsRef = useRef({});

  useEffect(() => {
    window.Tone = Tone;
    const scriptTag = document.createElement('script');
    scriptTag.src = "https://nbrosowsky.github.io/tonejs-instruments/Tonejs-Instruments.js";
    scriptTag.async = true;
    scriptTag.onload = () => setLibLoaded(true);
    scriptTag.onerror = () => setLibError(true);
    document.head.appendChild(scriptTag);
  }, []);

  const loadInstrument = async (name) => {
    const upperKey = name.toUpperCase();
    const key = upperKey.toLowerCase().replace('_', '-');

    if (loadingRef.current.has(upperKey) || loadedRef.current.has(upperKey)) return;

    loadingRef.current.add(upperKey);
    setLoadingInstruments(new Set(loadingRef.current));

    try {
      if (window.SampleLibrary && window.SampleLibrary.list.includes(key)) {
        const sampler = window.SampleLibrary.load({
          instruments: key,
          baseUrl: "https://nbrosowsky.github.io/tonejs-instruments/samples/",
          minify: true,
          ext: ".mp3"
        });

        sampler.toDestination();

        await new Promise((resolve) => {
          Tone.loaded().then(resolve);
          setTimeout(resolve, 10000);
        });

        instrumentsRef.current[upperKey] = sampler;
      } else {
        instrumentsRef.current[upperKey] = new Tone.PolySynth(Tone.Synth).toDestination();
      }

      loadedRef.current.add(upperKey);
      setLoadedInstruments(new Set(loadedRef.current));
    } catch (error) {
      console.error(`Failed to load ${upperKey}`, error);
    } finally {
      loadingRef.current.delete(upperKey);
      setLoadingInstruments(new Set(loadingRef.current));
    }
  };

  const parsedMusic = useMemo(() => {
    try {
      const channels = {};
      const lines = script.split('\n');

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) return;

        const instMatch = trimmed.match(/^CH(\d+)\s+@INST:\s*([\w-]+)$/i);
        if (instMatch) {
          const chNum = instMatch[1];
          const instType = instMatch[2].toUpperCase();
          if (!channels[chNum]) channels[chNum] = { notes: [], totalDuration: 0, instrument: 'PIANO' };
          channels[chNum].instrument = instType;
          return;
        }

        const match = trimmed.match(/^CH(\d+):\s*(.*)$/i);
        if (!match) return;

        const chNum = match[1];
        const tokensStr = match[2];
        if (!channels[chNum]) channels[chNum] = { notes: [], totalDuration: 0, instrument: 'PIANO' };

        const tokens = tokensStr.split(/\s+/);
        tokens.forEach(token => {
          if (token === '|') return;

          // Pattern for Chords or Single Notes: (Note+Note+Note)-(Duration)
          // Note pattern: [A-G][#b][Octave]
          const parts = token.split('-');
          if (parts.length !== 2) return;

          const notesPart = parts[0]; // e.g., "C4+E4+G4"
          const durKey = parts[1];   // e.g., "4"

          const duration = DURATION_VALS[durKey] || 1;
          const toneDur = DURATION_MAP[durKey] || '4n';

          const individualNotes = notesPart.split('+');
          const chordNotes = [];

          individualNotes.forEach(noteStr => {
            const noteMatch = noteStr.match(/^([A-Ga-g]#?|[A-Ga-g]b?)(\d)$/);
            if (noteMatch) {
              const [_, name, oct] = noteMatch;
              const pitch = (parseInt(oct) * 12) + NOTE_TO_FREQ[name.toUpperCase()];
              chordNotes.push({
                pitch,
                name: `${name}${oct}`
              });
            }
          });

          if (chordNotes.length > 0) {
            channels[chNum].notes.push({
              chord: chordNotes,
              start: channels[chNum].totalDuration,
              duration,
              toneDur
            });
            channels[chNum].totalDuration += duration;
          }
        });
      });
      return channels;
    } catch (e) {
      console.error("Parse error:", e);
      return {};
    }
  }, [script]);

  useEffect(() => {
    if (!libLoaded) return;
    const required = new Set();
    Object.values(parsedMusic).forEach(ch => required.add(ch.instrument));
    required.forEach(inst => loadInstrument(inst));
  }, [parsedMusic, libLoaded]);

  const isReadyToPlay = useMemo(() => {
    if (!libLoaded) return false;
    const used = new Set();
    Object.values(parsedMusic).forEach(ch => used.add(ch.instrument));
    if (used.size === 0) return true;
    for (let inst of used) {
      if (!loadedInstruments.has(inst)) return false;
    }
    return true;
  }, [parsedMusic, loadedInstruments, libLoaded]);

  useEffect(() => {
    Tone.Transport.bpm.value = tempo;
  }, [tempo]);

  const togglePlayback = async () => {
    if (!isReadyToPlay) return;

    if (isPlaying) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      setIsPlaying(false);
      lastPosRef.current = playbackPos;
    } else {
      await Tone.start();
      Tone.Transport.cancel();

      Object.keys(parsedMusic).forEach(chId => {
        const channel = parsedMusic[chId];
        const inst = instrumentsRef.current[channel.instrument];
        if (inst) {
          channel.notes.forEach(noteObj => {
            Tone.Transport.schedule((time) => {
              const noteNames = noteObj.chord.map(n => n.name);
              inst.triggerAttackRelease(noteNames, noteObj.toneDur, time);
            }, noteObj.start);
          });
        }
      });

      Tone.Transport.seconds = lastPosRef.current * (60 / tempo);
      Tone.Transport.start();
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    setIsPlaying(false);
    setPlaybackPos(0);
    lastPosRef.current = 0;
  };

  useEffect(() => {
    const syncLoop = () => {
      if (Tone.Transport.state === "started") {
        setPlaybackPos(Tone.Transport.seconds / (60 / tempo));
      }
      animationRef.current = requestAnimationFrame(syncLoop);
    };
    animationRef.current = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [tempo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;
    const beatWidth = 80;
    const pitchHeight = 6;
    const scrollX = playbackPos * beatWidth;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width + scrollX; x += beatWidth) {
      const lineX = x - scrollX + 100;
      ctx.beginPath(); ctx.moveTo(lineX, 0); ctx.lineTo(lineX, height); ctx.stroke();
    }

    const colors = { '1': '#60a5fa', '2': '#34d399', '3': '#f472b6', '4': '#fbbf24', '5': '#a78bfa' };
    Object.keys(parsedMusic).forEach(ch => {
      ctx.fillStyle = colors[ch] || '#94a3b8';
      parsedMusic[ch].notes.forEach(noteObj => {
        const x = (noteObj.start * beatWidth) - scrollX + 100;
        const w = noteObj.duration * beatWidth - 2;

        noteObj.chord.forEach(n => {
          const y = height - (n.pitch - 12) * pitchHeight;
          if (x + w > 0 && x < width) {
            ctx.beginPath(); ctx.roundRect(x, y, w, pitchHeight - 1, 1.5); ctx.fill();
          }
        });
      });
    });
    ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(100, height); ctx.stroke();
  }, [parsedMusic, playbackPos]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {(!libLoaded && !libError) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md">
          <Loader2 className="text-indigo-500 animate-spin mb-4" size={48} />
          <p className="text-sm font-mono text-indigo-400 font-bold uppercase tracking-widest text-center px-4">Calibrating Audio Engine...</p>
        </div>
      )}
      {libError && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-rose-950/90 backdrop-blur-md">
          <AlertCircle className="text-rose-500 mb-4" size={48} />
          <p className="text-sm font-mono text-rose-400 font-bold">Connection Refused: Samples Unavailable</p>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Info className="text-indigo-400" />
                <h2 className="text-xl font-bold tracking-tight">MelodyScript Documentation</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8 text-sm text-slate-300">
              <section>
                <h3 className="text-indigo-400 font-bold uppercase tracking-widest text-[10px] mb-4 flex items-center gap-2">
                  <Keyboard size={14} /> Chord Syntax
                </h3>
                <p className="mb-4 text-slate-400">Combine notes using <code className="text-indigo-400 bg-indigo-500/10 px-1 rounded">+</code> then specify duration after a <code className="text-indigo-400 bg-indigo-500/10 px-1 rounded">-</code>.</p>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-1">
                  <p className="text-slate-500">// Single Note (Note-Duration)</p>
                  <p>CH1: C4-4 E4-4 G4-4</p>
                  <p className="text-slate-500 mt-2">// Chord (Note+Note+Note-Duration)</p>
                  <p>CH1: C4+E4+G4-2</p>
                </div>
              </section>

              <section>
                <h3 className="text-indigo-400 font-bold uppercase tracking-widest text-[10px] mb-4">Sample Library</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                  {SUPPORTED_INSTRUMENTS.map(key => (
                    <div key={key} className={`p-2.5 rounded border transition-colors ${loadedInstruments.has(key) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/40 border-slate-700/50 text-slate-400'}`}>
                      {key}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Music size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">MelodyScript Studio</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">V0.6.6 | Polyphonic Support</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">BPM</span>
            <input
              type="number"
              value={tempo}
              onChange={(e) => setTempo(Math.max(20, parseInt(e.target.value) || 0))}
              className="bg-transparent w-10 text-center focus:outline-none font-bold text-indigo-400 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={stopPlayback} className="p-2.5 hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-700">
              <Square size={18} fill="currentColor" className="text-slate-400" />
            </button>
            <button
              onClick={togglePlayback}
              disabled={!isReadyToPlay}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${!isReadyToPlay ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : isPlaying ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'}`}
            >
              {!isReadyToPlay ? <><Loader2 size={16} className="animate-spin" /> LOADING...</> : isPlaying ? <><Pause size={18} fill="currentColor" /> STOP</> : <><Play size={18} fill="currentColor" /> PLAY</>}
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        {loadingInstruments.size > 0 && (
          <div className="absolute top-4 right-4 z-40 bg-slate-900/90 border border-indigo-500/30 backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4">
            <CloudDownload className="text-indigo-400 animate-bounce" size={20} />
            <div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Buffering Samples</p>
              <div className="flex gap-2 mt-1">
                {[...loadingInstruments].map(inst => (
                  <span key={inst} className="text-[9px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">{inst}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        <section className="w-1/3 flex flex-col border-r border-slate-800 bg-slate-900/30">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/40 border-b border-slate-800">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <Code size={14} className="text-indigo-500" />
              Source Script
            </div>
            <button onClick={() => setShowHelp(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold transition-all border border-indigo-500/20">
              <HelpCircle size={12} /> DOCS
            </button>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            spellCheck="false"
            className="flex-1 p-6 bg-transparent font-mono text-sm leading-relaxed resize-none focus:outline-none text-slate-300 custom-scrollbar"
          />
        </section>

        <section className="flex-1 flex flex-col bg-slate-950 relative">
          <div className="flex items-center gap-6 px-6 py-2.5 bg-slate-900/50 border-b border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Volume2 size={12} /> Mixer
            </span>
            <div className="flex items-center gap-3 ml-auto">
              {Object.keys(parsedMusic).map(ch => (
                <div key={ch} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/40 border border-slate-700/50">
                  <span className={`w-2 h-2 rounded-full ${ch === '1' ? 'bg-blue-400' : ch === '2' ? 'bg-emerald-400' : 'bg-pink-400'}`}></span>
                  <span className="text-[10px] font-bold text-slate-400">CH{ch}</span>
                  <span className={`text-[10px] font-mono font-bold tracking-tight ${loadedInstruments.has(parsedMusic[ch].instrument) ? 'text-indigo-300' : 'text-slate-600 italic'}`}>
                    {parsedMusic[ch].instrument}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full" />
            <div className="absolute bottom-6 left-6 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5 text-[11px] font-mono text-slate-400 shadow-2xl">
              <span>POS: <span className="text-indigo-400">{playbackPos.toFixed(2)}</span></span>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-2 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-medium font-mono">
        <div className="flex gap-6 items-center">
          <span className="text-emerald-500 flex items-center gap-2 uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            Samples Online
          </span>
          <span>|</span>
          <span>{loadedInstruments.size} CACHED</span>
        </div>
        <span>CHORD SUPPORT ENABLED (NOTE+NOTE-DUR)</span>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
};

export default App;