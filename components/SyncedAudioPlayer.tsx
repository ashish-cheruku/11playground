"use client";

// A thin wrapper over <audio> that reports playback position (rAF-smooth while
// playing, timeupdate/seek otherwise) and exposes an imperative `seek(t)` so the
// karaoke transcript / timeline / segment rows can jump the audio. Mirrors the
// look of the plain AudioPlayer (controls + a download button).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "./ui";

export interface SyncedPlayerHandle {
  seek: (t: number) => void;
}

export const SyncedAudioPlayer = forwardRef<
  SyncedPlayerHandle,
  {
    blob: Blob | null;
    filename?: string;
    onTime?: (t: number) => void;
    onDuration?: (d: number) => void;
  }
>(function SyncedAudioPlayer({ blob, filename = "audio.mp3", onTime, onDuration }, ref) {
  const [url, setUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  useImperativeHandle(
    ref,
    () => ({
      seek: (t: number) => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = t;
        onTime?.(t);
        void el.play().catch(() => {});
      },
    }),
    [onTime],
  );

  // Smooth position updates for the highlight: rAF loop while playing, plus the
  // native events so scrubbing / pausing stay in sync.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !onTime) return;
    let raf = 0;
    const report = () => onTime(el.currentTime);
    const loop = () => {
      report();
      raf = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      report();
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", stop);
    el.addEventListener("ended", stop);
    el.addEventListener("seeked", report);
    el.addEventListener("timeupdate", report);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", stop);
      el.removeEventListener("ended", stop);
      el.removeEventListener("seeked", report);
      el.removeEventListener("timeupdate", report);
    };
  }, [url, onTime]);

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  if (!blob || !url) {
    return <div className="text-xs text-muted py-2">No audio yet</div>;
  }

  return (
    <div className="flex items-center gap-2">
      {/* biome-ignore lint/a11y/useMediaCaption: generated narration, no caption track */}
      <audio
        ref={audioRef}
        src={url}
        controls
        className="flex-1 h-9"
        onLoadedMetadata={(e) => onDuration?.(e.currentTarget.duration)}
      />
      <Button variant="outline" onClick={download} className="text-xs">
        ⬇
      </Button>
    </div>
  );
});
