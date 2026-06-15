"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LabPlaybackId = "ai-vocal" | `demo-${string}`;

export function useLabAudioPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeIdRef = useRef<LabPlaybackId | null>(null);
  const [activePlaybackId, setActivePlaybackId] = useState<LabPlaybackId | null>(
    null
  );

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.onended = null;
    }
    activeIdRef.current = null;
    setActivePlaybackId(null);
  }, []);

  const togglePlayback = useCallback(
    (id: LabPlaybackId, url: string, startTime?: number) => {
      if (activeIdRef.current === id) {
        stopPlayback();
        return;
      }

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.pause();
      audio.onended = null;
      audio.src = url;
      audio.currentTime = startTime ?? 0;
      activeIdRef.current = id;
      setActivePlaybackId(id);
      audio.onended = () => {
        activeIdRef.current = null;
        setActivePlaybackId(null);
        audio.onended = null;
      };
      void audio.play().catch(() => {
        stopPlayback();
      });
    },
    [stopPlayback]
  );

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.onended = null;
      }
    };
  }, []);

  const playButtonLabel = useCallback(
    (base: string, id: LabPlaybackId) =>
      activePlaybackId === id ? "Stop" : base,
    [activePlaybackId]
  );

  return { activePlaybackId, togglePlayback, stopPlayback, playButtonLabel };
}
