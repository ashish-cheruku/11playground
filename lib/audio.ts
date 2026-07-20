// Browser-side audio handling for fusing uploaded samples. Uploaded files are
// fixed audio, so a source's "weight" is expressed as how many leading seconds
// of it get fed to the clone — which means trimming client-side before upload.
// Everything here needs the DOM (AudioContext / Audio), so it only runs in
// client components.

// Duration without a full decode: let the media element read just the metadata.
// Some containers (notably streamed webm) report a non-finite duration; callers
// treat NaN as "unknown" and fall back to the trim-time decode, which is exact.
export function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Audio();
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(el.duration) ? el.duration : NaN);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read audio: ${file.name}`));
    };
    el.src = url;
  });
}

// 16-bit PCM mono WAV. Sample rate is preserved from the source: resampling
// would throw away high-frequency detail that IVC may use, and the per-file
// second cap already keeps the result inside the upload size limit.
function encodeWav(samples: Int16Array, sampleRate: number): Blob {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 2 bytes/sample)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  str(36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(off, samples[i], true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

// Decode, keep the leading `seconds`, downmix to mono, re-encode as WAV.
// Returns how much audio was actually used — a file shorter than its allotted
// share contributes everything it has, and the caller reports that honestly
// rather than silently rebalancing the other sources.
export async function trimToMonoWav(
  file: File,
  seconds: number,
): Promise<{ file: File; usedSeconds: number }> {
  const Ctor =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    const usedSeconds = Math.max(0, Math.min(seconds, decoded.duration));
    const frames = Math.floor(usedSeconds * decoded.sampleRate);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c));
    const out = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let c = 0; c < channels.length; c++) sum += channels[c][i];
      const v = Math.max(-1, Math.min(1, sum / channels.length));
      out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const base = file.name.replace(/\.[^.]+$/, "");
    return {
      file: new File([encodeWav(out, decoded.sampleRate)], `${base}.wav`, { type: "audio/wav" }),
      usedSeconds,
    };
  } finally {
    void ctx.close();
  }
}
