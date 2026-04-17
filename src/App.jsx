import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { Play, Pause, Square, Music, Code, HelpCircle, Save, Download, Settings, ChevronRight, AlertCircle, Volume2, X, Info, Keyboard, Loader2, CloudDownload, Upload, BellRing, SkipBack, SkipForward } from 'lucide-react';
import { Midi } from '@tonejs/midi';
import { beatsToTransportTime } from './utils';
import { parseMusic, NOTE_TO_FREQ } from './parser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import specContent from '../spec.md?raw';

/**
 * MELODYSCRIPT STUDIO v0.6.6
 * Feature: Added support for chords using the "Note+Note+Note-Duration" syntax.
 * Fix: Explicitly forcing .mp3 extension for SampleLibrary.
 */

const DEFAULT_SCRIPT = `// MelodyScript v0.6.7 - Numerical Beat Duration
@TEMPO: 120
@SIGNATURE: 4/4

CH1 @INST: PIANO
// Chords use short notation like C, Cm, C7, etc.
// The number after the hyphen represents the exact number of beats!
// e.g. C-4 is a whole bar in 4/4 time. Am-3 is a whole bar in 3/4.
CH1: C-2 C/E-2 F-2 G-2 C-4

CH2 @INST: CELLO
// R stands for Rest
CH2: C5-2 F5-2 G5-2 C5-6

// Try: CH1: Em-1 D-0.5 C-0.5`;

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
  const [viewScrollLeft, setViewScrollLeft] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [libLoaded, setLibLoaded] = useState(false);
  const [libError, setLibError] = useState(false);

  const [loadingInstruments, setLoadingInstruments] = useState(new Set());
  const [loadedInstruments, setLoadedInstruments] = useState(new Set());

  const loadingRef = useRef(new Set());
  const loadedRef = useRef(new Set());
  const canvasRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const animationRef = useRef(null);
  const lastPosRef = useRef(0);
  const instrumentsRef = useRef({});
  const midiInputRef = useRef(null);
  const metronomeSynthRef = useRef(null);
  const metronomeLoopIdRef = useRef(null);

  useEffect(() => {
    window.Tone = Tone;
    const scriptTag = document.createElement('script');
    scriptTag.src = "https://nbrosowsky.github.io/tonejs-instruments/Tonejs-Instruments.js";
    scriptTag.async = true;
    scriptTag.onload = () => setLibLoaded(true);
    scriptTag.onerror = () => setLibError(true);
    document.head.appendChild(scriptTag);

    metronomeSynthRef.current = new Tone.MembraneSynth().toDestination();
    metronomeSynthRef.current.volume.value = -2; // Increased from -10 for better visibility in the mix
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
    return parseMusic(script);
  }, [script]);

  useEffect(() => {
    if (!libLoaded) return;
    const required = new Set();
    Object.values(parsedMusic.channels || {}).forEach(ch => required.add(ch.instrument));
    required.forEach(inst => loadInstrument(inst));
  }, [parsedMusic, libLoaded]);

  const isReadyToPlay = useMemo(() => {
    if (!libLoaded) return false;
    const used = new Set();
    Object.values(parsedMusic.channels || {}).forEach(ch => used.add(ch.instrument));
    if (used.size === 0) return true;
    for (let inst of used) {
      if (!loadedInstruments.has(inst)) return false;
    }
    return true;
  }, [parsedMusic, loadedInstruments, libLoaded]);

  useEffect(() => {
    Tone.Transport.bpm.value = tempo;
  }, [tempo]);

  useEffect(() => {
    if (parsedMusic.tempo) {
      setTempo(parsedMusic.tempo);
    }
    if (parsedMusic.signature) {
      Tone.Transport.timeSignature = parsedMusic.signature;
    } else {
      Tone.Transport.timeSignature = 4;
    }
  }, [parsedMusic.tempo, parsedMusic.signature]);

  useEffect(() => {
    if (metronomeEnabled && isPlaying) {
      if (metronomeLoopIdRef.current === null) {
        const beatsPerBar = Array.isArray(parsedMusic.signature) ? parsedMusic.signature[0] : (parsedMusic.signature || 4);
        let currentBeat = Math.floor(Tone.Transport.seconds * (tempo / 60));
        
        metronomeLoopIdRef.current = Tone.Transport.scheduleRepeat((time) => {
          if (currentBeat % beatsPerBar === 0) {
            metronomeSynthRef.current.triggerAttackRelease("C3", "8n", time, 1);
          } else {
            metronomeSynthRef.current.triggerAttackRelease("C4", "8n", time, 0.5);
          }
          currentBeat++;
        }, "4n");
      }
    } else {
      if (metronomeLoopIdRef.current !== null) {
        Tone.Transport.clear(metronomeLoopIdRef.current);
        metronomeLoopIdRef.current = null;
      }
    }
  }, [metronomeEnabled, isPlaying, parsedMusic.signature, tempo]);

  const handleMidiFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      const midi = new Midi(arrayBuffer);
      
      let newScriptContent = script;
      
      const existingChannels = Object.keys(parsedMusic.channels || {}).map(Number);
      let nextCh = existingChannels.length > 0 ? Math.max(...existingChannels) + 1 : 1;

      const formatBeats = (beats) => {
        // Round to 2 decimal places and remove trailing zeroes
        return Number(beats.toFixed(2)).toString();
      };
      midi.tracks.forEach(track => {
        if (track.notes.length === 0) return;
        
        let chScript = `\n\nCH${nextCh} @INST: PIANO\nCH${nextCh}: `;
        const sortedNotes = [...track.notes].sort((a, b) => a.time - b.time);
        
        const timeGroups = {};
        sortedNotes.forEach(note => {
          const timeKey = note.time.toFixed(3);
          if (!timeGroups[timeKey]) timeGroups[timeKey] = [];
          timeGroups[timeKey].push(note);
        });
        
        const sortedTimeKeys = Object.keys(timeGroups).sort((a, b) => parseFloat(a) - parseFloat(b));
        let lastTime = 0;
        
        sortedTimeKeys.forEach(timeKey => {
          const notes = timeGroups[timeKey];
          const time = parseFloat(timeKey);
          
          const restDur = time - lastTime;
          if (restDur > 0.1) {
            const restBeats = restDur * (tempo / 60);
            const restKey = formatBeats(restBeats);
            chScript += `R-${restKey} `;
          }

          const noteNames = notes.map(n => n.name);
          const chordStr = noteNames.join('+');
          const duration = notes[0].duration;
          const beats = duration * (tempo / 60);
          const durKey = formatBeats(beats);

          chScript += `${chordStr}-${durKey} `;          
          lastTime = time + duration;
        });
        
        newScriptContent += chScript;
        nextCh++;
      });
      
      setScript(newScriptContent);
    };
    reader.readAsArrayBuffer(file);
  };

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

      Object.keys(parsedMusic.channels || {}).forEach(chId => {
        const channel = parsedMusic.channels[chId];
        const inst = instrumentsRef.current[channel.instrument];
        if (inst) {
          channel.notes.forEach(noteObj => {
            Tone.Transport.schedule((time) => {
              const noteNames = noteObj.chord.map(n => n.name);
              const toneDur = noteObj.duration * (60 / Tone.Transport.bpm.value);
              inst.triggerAttackRelease(noteNames, toneDur, time);
            }, beatsToTransportTime(noteObj.start, parsedMusic.signature || 4));
          });
        }
      });

      Tone.Transport.seconds = lastPosRef.current * (60 / tempo);
      Tone.Transport.start();
      setIsPlaying(true);
    }
  };

  const seekTo = (newPos) => {
    const clampedPos = Math.max(0, newPos);
    setPlaybackPos(clampedPos);
    lastPosRef.current = clampedPos;
    if (Tone.Transport.state === "started") {
      Tone.Transport.seconds = clampedPos * (60 / tempo);
    }
    
    // Immediately keep the playhead centered
    if (scrollContainerRef.current) {
      const beatWidth = 80;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScroll = (clampedPos * beatWidth) + 100 - (containerWidth / 2);
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  };

  const jumpToNextBar = () => {
    const beatsPerBar = Array.isArray(parsedMusic.signature) ? parsedMusic.signature[0] : (parsedMusic.signature || 4);
    const nextPos = Math.floor(playbackPos / beatsPerBar + 0.01 + 1) * beatsPerBar;
    seekTo(nextPos);
  };

  const jumpToPreviousBar = () => {
    const beatsPerBar = Array.isArray(parsedMusic.signature) ? parsedMusic.signature[0] : (parsedMusic.signature || 4);
    const prevPos = Math.max(0, Math.ceil(playbackPos / beatsPerBar - 0.01 - 1) * beatsPerBar);
    seekTo(prevPos);
  };

  const stopPlayback = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (metronomeLoopIdRef.current !== null) {
      metronomeLoopIdRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackPos(0);
    setViewScrollLeft(0);
    if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = 0;
    lastPosRef.current = 0;
  };

  useEffect(() => {
    const syncLoop = () => {
      if (Tone.Transport.state === "started") {
        const newPos = Tone.Transport.seconds / (60 / tempo);
        
        // Auto-stop if we reach the end of the song
        if (newPos >= parsedMusic.totalBeats + 1) { // Adding a small buffer of 1 beat
          stopPlayback();
          return;
        }

        setPlaybackPos(newPos);
        if (scrollContainerRef.current) {
          const beatWidth = 80;
          const containerWidth = scrollContainerRef.current.clientWidth;
          const targetScroll = (newPos * beatWidth) + 100 - (containerWidth / 2);
          if (targetScroll > 0) {
            scrollContainerRef.current.scrollLeft = targetScroll;
          } else {
            // Keep at start until the playhead reaches the center
            scrollContainerRef.current.scrollLeft = 0;
          }
        }
      }
      animationRef.current = requestAnimationFrame(syncLoop);
    };
    animationRef.current = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [tempo, parsedMusic.totalBeats]);

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
    const scrollX = viewScrollLeft;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const beatsPerBar = Array.isArray(parsedMusic.signature) ? parsedMusic.signature[0] : (parsedMusic.signature || 4);

    const startBeat = Math.floor((scrollX - 100) / beatWidth);
    const endBeat = Math.ceil((scrollX + width - 100) / beatWidth);

    for (let beat = Math.max(0, startBeat); beat <= endBeat; beat++) {
      const lineX = (beat * beatWidth) - scrollX + 100;
      
      if (lineX > 0 && lineX < width) {
        if (beat % beatsPerBar === 0) {
          // Bar line
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
        } else {
          // Beat line
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
        }
        ctx.beginPath(); ctx.moveTo(lineX, 0); ctx.lineTo(lineX, height); ctx.stroke();
      }
    }

    const colors = { '1': '#60a5fa', '2': '#34d399', '3': '#f472b6', '4': '#fbbf24', '5': '#a78bfa' };
    Object.keys(parsedMusic.channels || {}).forEach(ch => {
      ctx.fillStyle = colors[ch] || '#94a3b8';
      parsedMusic.channels[ch].notes.forEach(noteObj => {
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
    
    // Draw playhead
    const playheadX = (playbackPos * beatWidth) - scrollX + 100;
    if (playheadX > 0 && playheadX < width) {
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(playheadX, 0); ctx.lineTo(playheadX, height); ctx.stroke();
    }
  }, [parsedMusic, playbackPos, viewScrollLeft]);

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
            <div className="p-8 overflow-y-auto space-y-8 text-sm text-slate-300 custom-markdown">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({...props}) => <h1 className="text-2xl font-bold text-white mb-6 border-b border-slate-700 pb-2" {...props} />,
                  h2: ({...props}) => <h2 className="text-lg font-bold text-indigo-400 mt-8 mb-4 uppercase tracking-widest text-[11px]" {...props} />,
                  h3: ({...props}) => <h3 className="text-white font-bold mt-6 mb-2" {...props} />,
                  p: ({...props}) => <p className="mb-4 text-slate-400 leading-relaxed" {...props} />,
                  ul: ({...props}) => <ul className="list-disc list-inside mb-4 space-y-2 text-slate-400" {...props} />,
                  li: ({...props}) => <li className="ml-4" {...props} />,
                  code: ({inline, className, children, ...props}) => {
                    const isBlock = !inline && (className?.includes('language-') || String(children).includes('\n'));
                    return isBlock ? (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs my-4 shadow-inner">
                        <code className="text-indigo-300 block overflow-x-auto" {...props}>
                          {children}
                        </code>
                      </div>
                    ) : (
                      <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[11px] whitespace-nowrap" {...props}>
                        {children}
                      </code>
                    );
                  },
                  strong: ({...props}) => <strong className="text-indigo-300 font-bold" {...props} />,
                }}
              >
                {specContent}
              </ReactMarkdown>

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
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            <button
              onClick={() => setMetronomeEnabled(!metronomeEnabled)}
              className={`p-1 rounded-md transition-colors ${metronomeEnabled ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
              title="Toggle Metronome"
            >
              <BellRing size={16} />
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 mr-2">
              <button 
                onClick={jumpToPreviousBar}
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title="Previous Bar"
              >
                <SkipBack size={16} />
              </button>
              <button 
                onClick={jumpToNextBar}
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title="Next Bar"
              >
                <SkipForward size={16} />
              </button>
            </div>

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
            <div className="flex items-center gap-2">
              <button onClick={() => setShowHelp(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold transition-all border border-indigo-500/20">
                <HelpCircle size={12} /> DOCS
              </button>
              <button onClick={() => midiInputRef.current.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-all border border-emerald-500/20">
                <Upload size={12} /> IMPORT MIDI
              </button>
              <input type="file" ref={midiInputRef} onChange={handleMidiFileChange} accept=".mid,.midi" className="hidden" />
            </div>
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
              {Object.keys(parsedMusic.channels || {}).map(ch => (
                <div key={ch} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/40 border border-slate-700/50">
                  <span className={`w-2 h-2 rounded-full ${ch === '1' ? 'bg-blue-400' : ch === '2' ? 'bg-emerald-400' : 'bg-pink-400'}`}></span>
                  <span className="text-[10px] font-bold text-slate-400">CH{ch}</span>
                  <span className={`text-[10px] font-mono font-bold tracking-tight ${loadedInstruments.has(parsedMusic.channels[ch].instrument) ? 'text-indigo-300' : 'text-slate-600 italic'}`}>
                    {parsedMusic.channels[ch].instrument}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full pointer-events-none" 
            />
            
            <div 
              className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar cursor-crosshair"
              ref={scrollContainerRef}
              onScroll={(e) => {
                setViewScrollLeft(e.target.scrollLeft);
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                const beatWidth = 80;
                const newPos = (x - 100) / beatWidth;
                seekTo(Math.max(0, newPos));
              }}
            >
              <div style={{ width: `${Math.max(1000, parsedMusic.totalBeats * 80 + 400)}px`, height: '100%' }}></div>
            </div>

            <div className="absolute bottom-6 left-6 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5 text-[11px] font-mono text-slate-400 shadow-2xl pointer-events-none">
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
