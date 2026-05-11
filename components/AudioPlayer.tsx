"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export function AudioPlayer({
  blob,
  filename = "audio.mp3",
  compact = false,
}: {
  blob: Blob | null;
  filename?: string;
  compact?: boolean;
}) {
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

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  if (!blob || !url) {
    return (
      <div className={compact ? "text-xs text-muted py-2" : "text-sm text-muted py-4 text-center"}>
        No audio yet
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} src={url} controls className="flex-1 h-9" />
      <Button variant="outline" onClick={download} className="text-xs">
        ⬇
      </Button>
    </div>
  );
}
