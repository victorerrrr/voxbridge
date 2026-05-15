"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type HomeAudioSide = "ai" | "vocal";

export type HomeTrack = {
  id: string;
  title: string;
  aiLabel: string;
  vocalLabel: string;
  aiUrl?: string;
  vocalUrl?: string;
};

type HomeAudioContextValue = {
  track: HomeTrack | null;
  isPlaying: boolean;
  activeSide: HomeAudioSide;
  abCompare: boolean;
  selectedTrackId: string | null;
  playTrack: (track: HomeTrack, side?: HomeAudioSide) => void;
  togglePlay: () => void;
  setActiveSide: (side: HomeAudioSide) => void;
  setAbCompare: (enabled: boolean) => void;
  toggleAbCompare: () => void;
  selectTrackId: (id: string | null) => void;
};

const HomeAudioContext = createContext<HomeAudioContextValue | null>(null);

export function HomeAudioProvider({ children }: { children: ReactNode }) {
  const [track, setTrack] = useState<HomeTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSide, setActiveSide] = useState<HomeAudioSide>("ai");
  const [abCompare, setAbCompare] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const playTrack = useCallback((next: HomeTrack, side: HomeAudioSide = "ai") => {
    setTrack(next);
    setSelectedTrackId(next.id);
    setActiveSide(side);
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((value) => !value);
  }, []);

  const toggleAbCompare = useCallback(() => {
    setAbCompare((value) => {
      const next = !value;
      if (next) {
        setActiveSide((side) => (side === "ai" ? "vocal" : "ai"));
      }
      return next;
    });
  }, []);

  const selectTrackId = useCallback((id: string | null) => {
    setSelectedTrackId(id);
  }, []);

  const value = useMemo(
    () => ({
      track,
      isPlaying,
      activeSide,
      abCompare,
      selectedTrackId,
      playTrack,
      togglePlay,
      setActiveSide,
      setAbCompare,
      toggleAbCompare,
      selectTrackId,
    }),
    [
      track,
      isPlaying,
      activeSide,
      abCompare,
      selectedTrackId,
      playTrack,
      togglePlay,
      toggleAbCompare,
      selectTrackId,
    ]
  );

  return <HomeAudioContext.Provider value={value}>{children}</HomeAudioContext.Provider>;
}

export function useHomeAudio(): HomeAudioContextValue {
  const ctx = useContext(HomeAudioContext);
  if (!ctx) {
    throw new Error("useHomeAudio must be used within HomeAudioProvider");
  }
  return ctx;
}
