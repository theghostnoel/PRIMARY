export interface VideoHistoryItem {
  id: string;
  url: string;
  title: string;
  durationString: string;
  playedAt: number;
}

export interface CuratedPreset {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  thumbnail: string;
}

export interface PlayerSettings {
  loop: boolean;
  speed: number;
  quality: string;
  volume: number;
  muted: boolean;
  cropTop: number; // in pixels
  cropBottom: number; // in pixels
  ambientGlow: boolean;
  theaterMode: boolean;
  hideControlsOnIdle: boolean;
  bypassOverlay?: boolean;
}
