export const beatsToTransportTime = (beats, timeSig = 4) => {
  const beatsPerBar = Array.isArray(timeSig) ? timeSig[0] : timeSig;
  const bars = Math.floor(beats / beatsPerBar);
  const remBeats = Math.floor(beats % beatsPerBar);
  const sixteenths = (beats % 1) * 4;
  return `${bars}:${remBeats}:${sixteenths}`;
};
