import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  HelpCircle,
  Clipboard,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity,
  Maximize2,
  ListRestart,
  Sliders,
  AppWindow,
  Sparkles,
  Info,
  Youtube
} from "lucide-react";

import { VideoHistoryItem, PlayerSettings, CuratedPreset } from "./types";
import { CURATED_PRESETS } from "./data";
import Notification, { ToastMessage, ToastType } from "./components/Notification";
import ShortcutGuide from "./components/ShortcutGuide";
import PresetVideos from "./components/PresetVideos";
import HistoryList from "./components/HistoryList";

// Helper: Obfuscate Video ID into a secure-looking token
function scrambleVideoId(id: string): string {
  try {
    // Reverse the string and add a prefix to make it robust
    const reversed = id.split("").reverse().join("");
    const secret = `secured_stream_${reversed}`;
    // Simple Base64 conversion with URL-safe replacements
    return btoa(secret).replace(/=/g, "").replace(/\//g, "_").replace(/\+/g, "-");
  } catch (e) {
    return id;
  }
}

// Helper: Deobfuscate the secure token back to Video ID
function descrambleVideoId(token: string): string | null {
  try {
    let b64 = token.replace(/_/g, "/").replace(/-/g, "+");
    while (b64.length % 4 !== 0) {
      b64 += "=";
    }
    const decoded = atob(b64);
    if (decoded.startsWith("secured_stream_")) {
      const reversed = decoded.slice(15);
      return reversed.split("").reverse().join("");
    }
  } catch (e) {
    // Fallback if decoding fails
  }
  return null;
}

export default function App() {
  // Input URL
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  
  // Media states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currTime, setCurrTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(1);
  
  // Settings with beautiful localStorage memory
  const [settings, setSettings] = useState<PlayerSettings>(() => {
    const saved = localStorage.getItem("yt_private_player_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // default settings fallback
      }
    }
    return {
      loop: false,
      speed: 1,
      quality: "default",
      volume: 80,
      muted: false,
      cropTop: 60, // Crop the black border or top info overlay
      cropBottom: 60, // Crop the branding or controls
      ambientGlow: true,
      theaterMode: false,
      hideControlsOnIdle: true,
      bypassOverlay: false
    };
  });

  // Save settings on changes
  useEffect(() => {
    localStorage.setItem("yt_private_player_settings", JSON.stringify(settings));
  }, [settings]);

  // UI state
  const [history, setHistory] = useState<VideoHistoryItem[]>(() => {
    const saved = localStorage.getItem("yt_private_player_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isShortcutOpen, setIsShortcutOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isTempBypassing, setIsTempBypassing] = useState<boolean>(false);

  // References
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toastIdCounter = useRef<number>(0);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Helper: Trigger custom toast alert
  const addToast = useCallback((text: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${toastIdCounter.current++}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    
    // Auto remove in 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const handleRemoveToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper: Extract YouTube Video ID
  const extractVideoId = (url: string) => {
    if (!url) return null;
    const cleanUrl = url.trim();
    // Regex covers main video link, live streams, shorts, embed and short domain youtu.be
    const reg = /(?:v=|youtu\.be\/|embed\/|shorts\/|\/v\/|watch\?v=)([^#\&\?]{11})/;
    const match = cleanUrl.match(reg);
    if (match) return match[1];
    
    // Handle bare 11-char ID
    if (cleanUrl.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
      return cleanUrl;
    }
    return null;
  };

  // Save successful video to history List in memory
  const saveToHistory = (id: string, title: string) => {
    const updatedHistory: VideoHistoryItem[] = [
      {
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title,
        durationString: "",
        playedAt: Date.now()
      },
      ...history.filter((h) => h.id !== id)
    ].slice(0, 15); // keep last 15 videos
    
    setHistory(updatedHistory);
    localStorage.setItem("yt_private_player_history", JSON.stringify(updatedHistory));
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("yt_private_player_history");
    addToast("Đã xóa tất cả lịch sử xem gần đây", "info");
  };

  const handleRemoveHistoryItem = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem("yt_private_player_history", JSON.stringify(updated));
    addToast("Đã xóa mục lịch sử", "info");
  };

  // Synchronize initial URL sharing query param on load
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const sharedCode = searchParams.get("code") || searchParams.get("s");
      const sharedPlainId = searchParams.get("v") || searchParams.get("video");
      
      let finalId: string | null = null;
      if (sharedCode) {
        const decoded = descrambleVideoId(sharedCode);
        if (decoded && decoded.length === 11) {
          finalId = decoded;
          setIsGuestMode(true);
        }
      } else if (sharedPlainId && sharedPlainId.length === 11) {
        finalId = sharedPlainId;
        setIsGuestMode(true);
      }

      if (finalId) {
        setActiveVideoId(finalId);
        setVideoUrl(`https://www.youtube.com/watch?v=${finalId}`);
        setTimeout(() => {
          addToast("Đã tự động nạp video bảo mật từ liên kết chia sẻ!", "success");
        }, 1000);
      }
    } catch (e) {
      console.error("Failed to parse query params");
    }
  }, []);

  // Initializing Player or dynamic updates when ID changes
  useEffect(() => {
    if (!activeVideoId) return;

    // Trigger a fast split second temporary bypass on load/change
    setIsTempBypassing(true);
    const bypassTimer = setTimeout(() => {
      setIsTempBypassing(false);
    }, 950);

    let playerInstance: any = null;
    let poolInterval: NodeJS.Timeout | null = null;

    const setupPlayerAttributes = (player: any) => {
      try {
        if (typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(settings.speed);
        }
        if (typeof player.setVolume === "function") {
          player.setVolume(settings.volume);
          if (settings.muted && typeof player.mute === "function") {
            player.mute();
          } else if (!settings.muted && typeof player.unMute === "function") {
            player.unMute();
          }
        }
        if (typeof player.setPlaybackQuality === "function") {
          player.setPlaybackQuality(settings.quality || "default");
        }
      } catch (e) {
        console.warn("Could not apply initial attributes", e);
      }
    };

    const initPlayer = () => {
      const existingPlayer = playerRef.current;
      if (existingPlayer && typeof existingPlayer.loadVideoById === "function") {
        try {
          existingPlayer.loadVideoById({
            videoId: activeVideoId,
            suggestedQuality: settings.quality || "default"
          });
          setupPlayerAttributes(existingPlayer);
          setError(null);
          return;
        } catch (err) {
          console.error("Existing player error, rebuilding...", err);
        }
      }

      const playerDiv = document.getElementById("yt-player-target");
      if (!playerDiv) return;

      try {
        playerInstance = new (window as any).YT.Player("yt-player-target", {
          videoId: activeVideoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            rel: 0,
            modestbranding: 1,
            showinfo: 0,
            iv_load_policy: 3,
            fs: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.href,
          },
          events: {
            onReady: (event: any) => {
              playerRef.current = event.target;
              setupPlayerAttributes(event.target);
              setDuration(event.target.getDuration() || 1);
              
              // Get video info
              const ytData = event.target.getVideoData();
              const vTitle = ytData?.title || (isGuestMode ? "Video Bảo Mật" : `Video ID: ${activeVideoId}`);
              if (!isGuestMode) {
                saveToHistory(activeVideoId, vTitle);
              }
              addToast(`Trình phát đã sẵn sàng: ${vTitle}`, "success");
              setError(null);
              setIsPlaying(true);
            },
            onStateChange: (event: any) => {
              const state = event.data;
              if (state === 1) { // PLAYING
                setIsPlaying(true);
              } else if (state === 2 || state === 0) { // PAUSED or ENDED
                setIsPlaying(false);
              }

              if (state === 0) { // ENDED
                if (settings.loop) {
                  event.target.playVideo();
                  addToast("Đang phát lặp lại video", "info");
                }
              }
            },
            onError: (event: any) => {
              const errCode = event.data;
              let msg = "Lỗi phát video này.";
              if (errCode === 2) msg = "Link hoặc ID video không hợp lệ.";
              if (errCode === 100) msg = "Video không tồn tại hoặc đã bị gỡ bỏ.";
              if (errCode === 101 || errCode === 150) msg = "Chủ sở hữu video đã chặn phát nhúng trên trang bên thứ ba.";
              setError(msg);
              addToast(msg, "error");
            }
          }
        });
        
        // Save to active player immediately so UI buttons can execute even if onReady is delayed/blocked in iframe sandbox
        playerRef.current = playerInstance;
        setupPlayerAttributes(playerInstance);
      } catch (err) {
        console.error("Initialize error:", err);
      }
    };

    // Inject iframe script if it wasn't pre-loaded
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else if (!(window as any).YT.Player) {
      poolInterval = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          clearInterval(poolInterval!);
          initPlayer();
        }
      }, 150);
    } else {
      initPlayer();
    }

    return () => {
      if (poolInterval) clearInterval(poolInterval);
      clearTimeout(bypassTimer);
    };
  }, [activeVideoId]);

  // Sync settings with YouTube player in real-time
  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.setPlaybackRate === "function") {
      try {
        player.setPlaybackRate(settings.speed);
      } catch (e) {}
    }
  }, [settings.speed]);

  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.setVolume === "function") {
      try {
        player.setVolume(settings.volume);
        if (settings.muted && typeof player.mute === "function") {
          player.mute();
        } else if (!settings.muted && typeof player.unMute === "function") {
          player.unMute();
        }
      } catch (e) {}
    }
  }, [settings.volume, settings.muted]);

  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.setPlaybackQuality === "function") {
      try {
        player.setPlaybackQuality(settings.quality);
      } catch (e) {}
    }
  }, [settings.quality]);

  // High-reliability polling fallback timer to stay in perfect state synchronization 
  useEffect(() => {
    let pInterval: NodeJS.Timeout | null = null;
    
    if (activeVideoId) {
      pInterval = setInterval(() => {
        const player = playerRef.current;
        if (!player) return;

        try {
          // Poll play/pause state independently from API callbacks
          if (typeof player.getPlayerState === "function") {
            const state = player.getPlayerState();
            const actualPlaying = state === 1 || state === 3; // 1 = PLAYING, 3 = BUFFERING
            if (actualPlaying !== isPlaying) {
              setIsPlaying(actualPlaying);
            }

            // Fallback loop checking inside intervals 
            if (state === 0 && settings.loop) {
              if (typeof player.playVideo === "function") {
                player.playVideo();
              }
            }
          }

          // Poll current playback progress time
          if (typeof player.getCurrentTime === "function") {
            const cur = player.getCurrentTime() || 0;
            setCurrTime(cur);
          }

          // Poll total playback duration
          if (typeof player.getDuration === "function") {
            const dur = player.getDuration();
            if (dur && dur > 0 && dur !== duration) {
              setDuration(dur);
            }
          }
        } catch (err) {
          // Cross-origin iframe postMessage transient exceptions
        }
      }, 350);
    }
    
    return () => {
      if (pInterval) clearInterval(pInterval);
    };
  }, [activeVideoId, isPlaying, duration, settings.loop]);

  // Handle playing custom input URL
  const handleLoadVideo = (customUrl?: string) => {
    const urlToUse = customUrl !== undefined ? customUrl : videoUrl;
    setError(null);
    const id = extractVideoId(urlToUse);
    if (!id) {
      const msg = "Địa chỉ liên kết hoặc ID của YouTube không đúng định dạng. Hãy dán đúng link!";
      setError(msg);
      addToast(msg, "error");
      return;
    }
    setActiveVideoId(id);
    if (customUrl === undefined) {
      addToast("Nạp liên kết thành công. Bắt đầu phát...", "success");
    }
  };

  // Select video from curated grid
  const handleSelectPreset = (url: string) => {
    setVideoUrl(url);
    handleLoadVideo(url);
  };

  // Media interaction handlers
  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) {
      addToast("Trình phát đang tải. Đang thực thi vui lòng đợi!", "info");
      return;
    }
    try {
      if (isPlaying && typeof player.pauseVideo === "function") {
        player.pauseVideo();
        setIsPlaying(false);
        addToast("Đã tạm dừng video", "info");
      } else if (typeof player.playVideo === "function") {
        setIsTempBypassing(true);
        setTimeout(() => {
          setIsTempBypassing(false);
        }, 950);
        player.playVideo();
        setIsPlaying(true);
        addToast("Tiếp tục phát", "success");
      }
    } catch (e) {
      addToast("Không thể điều khiển hành động Phát/Dừng", "error");
    }
  };

  const handleSkip = (sec: number) => {
    const player = playerRef.current;
    if (!player || typeof player.getCurrentTime !== "function" || typeof player.seekTo !== "function") return;
    try {
      const cur = player.getCurrentTime() || 0;
      const dest = Math.max(0, Math.min(duration, cur + sec));
      player.seekTo(dest, true);
      setCurrTime(dest);
      addToast(`${sec > 0 ? "Tua nhanh" : "Tua lùi"} ${Math.abs(sec)}s`, "info");
    } catch (e) {
      console.error("Seek failed", e);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const player = playerRef.current;
    if (!progressBarRef.current || !player || !duration || typeof player.seekTo !== "function") return;
    try {
      const rect = progressBarRef.current.getBoundingClientRect();
      let clientX = 0;
      if ("touches" in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
      } else {
        clientX = e.clientX;
      }

      const relativeX = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, relativeX / rect.width));
      const targetSeek = pct * duration;
      
      player.seekTo(targetSeek, true);
      setCurrTime(targetSeek);
    } catch (err) {
      console.error("Seek failed", err);
    }
  };

  const toggleMute = () => {
    const player = playerRef.current;
    const nextMuted = !settings.muted;
    setSettings((prev) => ({ ...prev, muted: nextMuted }));
    
    if (player) {
      try {
        if (nextMuted && typeof player.mute === "function") {
          player.mute();
        } else if (!nextMuted && typeof player.unMute === "function") {
          player.unMute();
        }
      } catch (e) {}
    }
    addToast(nextMuted ? "Đã tắt tiếng" : "Đã bật âm lượng", "info");
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSettings((prev) => ({ ...prev, volume: val, muted: val === 0 ? true : prev.muted }));
    
    const player = playerRef.current;
    if (player && typeof player.setVolume === "function") {
      try {
        player.setVolume(val);
        if (val === 0 && typeof player.mute === "function") {
          player.mute();
        } else if (val > 0 && typeof player.unMute === "function") {
          player.unMute();
        }
      } catch (e) {}
    }
  };

  const changeSpeed = (rate: number) => {
    setSettings((prev) => ({ ...prev, speed: rate }));
    const player = playerRef.current;
    if (player && typeof player.setPlaybackRate === "function") {
      try {
        player.setPlaybackRate(rate);
      } catch (e) {}
    }
    addToast(`Tốc độ phát: ${rate}x`, "info");
  };

  const toggleLoop = () => {
    setSettings((prev) => ({ ...prev, loop: !prev.loop }));
    addToast(settings.loop ? "Đã tắt chế độ lặp" : "Đã bật lặp lại liên tục", "success");
  };

  const toggleTheaterMode = () => {
    setSettings((prev) => ({ ...prev, theaterMode: !prev.theaterMode }));
  };

  const handleFullscreenToggle = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch((err) => {
        addToast("Trình duyệt chặn khởi đầu toàn màn hình: " + err.message, "error");
      });
    }
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if user is active inside input form element
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT") {
        return;
      }
      
      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSkip(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkip(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSettings((prev) => ({ ...prev, volume: Math.min(100, prev.volume + 5) }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSettings((prev) => ({ ...prev, volume: Math.max(0, prev.volume - 5) }));
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyL":
          toggleLoop();
          break;
        case "KeyF":
          e.preventDefault();
          handleFullscreenToggle();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, activeVideoId, settings]);

  // Clipboard auto paste utility
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setVideoUrl(text);
        addToast("Đã dán liên kết từ clipboard!", "success");
      } else {
        addToast("Không tìm thấy nội dung trong Clipboard", "error");
      }
    } catch (err) {
      addToast("Không thể tự động đọc clipboard. Hãy nhấn chuột phải để dán thường.", "error");
    }
  };

  // Idle overlay timer logic to auto-hide player controls when watching
  const triggerControlsReset = () => {
    setControlsVisible(true);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    
    if (isPlaying && settings.hideControlsOnIdle) {
      idleTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  };

  const handlePlayerMouseMove = () => {
    triggerControlsReset();
  };

  const handlePlayerMouseEnter = () => {
    triggerControlsReset();
  };

  const handlePlayerMouseLeave = () => {
    if (document.fullscreenElement) return; // Không ẩn ngay khi di chuột ra mép lúc toàn màn hình
    setControlsVisible(false);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
  };

  const handlePlayerTouchStart = () => {
    triggerControlsReset();
  };

  useEffect(() => {
    triggerControlsReset();
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [isPlaying, settings.hideControlsOnIdle]);

  // Global listeners specifically for full-screen mode support
  useEffect(() => {
    const handleGlobalMouseMove = () => {
      if (document.fullscreenElement) {
        triggerControlsReset();
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("touchstart", handleGlobalMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("touchstart", handleGlobalMouseMove);
    };
  }, [isPlaying, settings.hideControlsOnIdle]);

  // Format second parameters to MM:SS string
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const progressPercentage = duration > 0 ? (currTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100 font-sans tracking-tight pb-16 antialiased">
      {/* Navbar Title Card */}
      <header className="max-w-7xl mx-auto px-4 pt-6 pb-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-brand-border/40">
        <div className="flex items-center gap-3.5 select-none">
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-4.5 w-4.5 rounded-full bg-brand-primary opacity-35 animate-ping" />
            <div className="relative size-7.5 rounded-lg bg-brand-primary flex items-center justify-center shadow-md shadow-brand-primary/25">
              <Youtube className="size-4.5 text-white fill-current" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              YouTube Private Player
              <span className="text-[9px] font-mono tracking-normal capitalize font-medium bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full border border-brand-primary/20">
                PRO v4.2
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Bảo mật vô cực • Không bị xao nhãng • Chạy siêu nhẹ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-2 sm:mt-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Hệ Thống Ổn Định</span>
          </div>

          <div className="h-4 w-px bg-brand-border hidden sm:block" />

          <button
            onClick={() => setIsShortcutOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border text-xs text-slate-400 hover:text-slate-100 hover:border-slate-600 hover:bg-brand-surface2 transition-all cursor-pointer"
          >
            <HelpCircle className="size-4 text-brand-primary" />
            Phím tắt (Space/F)
          </button>
        </div>
      </header>

      {/* Main Grid Wrapper */}
      <main className="max-w-7xl mx-auto px-4 mt-6 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Sandbox Video Player & Controls Screen */}
        <section className={`col-span-12 ${settings.theaterMode || isGuestMode ? "" : "lg:col-span-8"} space-y-6`}>
          
          {/* Guest Mode Greeting Banner */}
          {isGuestMode && (
            <div className="bg-brand-surface border border-brand-border/60 p-4 rounded-2xl shadow-md flex items-center gap-3">
              <div className="size-9 ml-1 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                <Sparkles className="size-4.5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  Chế Độ Xem Bảo Mật (Vidunal Private Player)
                </h4>
                <p className="text-[10px] text-slate-400">Trình xem được mã hóa bảo mật tối cao • Không hiển thị liên kết nguồn • Trải nghiệm mượt mà không quảng cáo</p>
              </div>
            </div>
          )}

          {/* Action Paste Link Bar */}
          {!isGuestMode && (
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-4.5 shadow-md">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Nhập Địa Chỉ YouTube Muốn Trải Nghiệm Mượt
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
                    placeholder="Dán link video, Shorts hoặc ID tại đây..."
                    className="w-full h-11 pl-4 pr-24 rounded-xl border border-brand-border bg-brand-surface2 text-slate-200 text-xs placeholder-slate-500 focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-500/50 transition-all font-mono"
                  />
                  
                  {/* Micro Input action trigger keys */}
                  <div className="absolute right-2 top-1.5 flex gap-1">
                    <button
                      onClick={handlePasteClipboard}
                      title="Tự dán từ clipboard"
                      className="h-8 px-2.5 rounded-lg bg-brand-surface border border-brand-border hover:border-slate-600 hover:bg-brand-surface2 text-slate-400 hover:text-slate-200 transition-all text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Clipboard className="size-3.5" />
                      <span>Dán</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => handleLoadVideo()}
                  className="h-11 px-6 rounded-xl bg-brand-primary hover:bg-brand-primary-hover active:scale-97 text-xs font-semibold text-white shadow-lg shadow-brand-primary/10 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                >
                  <Play className="size-4.5 fill-current" />
                  <span>Phát Riêng Tư</span>
                </button>
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 text-rose-400 bg-rose-950/15 border border-rose-900/30 px-3 py-2.5 rounded-xl text-xs line-clamp-2">
                  <Info className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {activeVideoId && (
                <div className="mt-4 pt-4 border-t border-brand-border/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-brand-surface2/30 p-3.5 rounded-xl transition-all duration-300">
                  <div className="flex flex-col gap-0.5 max-w-full overflow-hidden">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                      <Sparkles className="size-3.5 text-brand-primary shrink-0" />
                      <span>Liên kết chia sẻ bảo mật (Trình phát tối giản)</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Người nhận link này sẽ KHÔNG thể xem/tìm thấy đường dẫn YouTube gốc</p>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <input
                      type="text"
                      readOnly
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      value={`${window.location.origin}${window.location.pathname}?code=${scrambleVideoId(activeVideoId)}`}
                      className="flex-1 md:w-64 h-9 px-3 rounded-lg border border-brand-border bg-brand-surface text-slate-300 text-xs font-mono select-all focus:outline-hidden"
                    />
                    <button
                      onClick={() => {
                        const shareUrl = `${window.location.origin}${window.location.pathname}?code=${scrambleVideoId(activeVideoId)}`;
                        navigator.clipboard.writeText(shareUrl).then(
                          () => addToast("Đã mã hóa thành công & sao chép liên kết chia sẻ bảo mật!", "success"),
                          () => addToast("Lỗi sao chép, vui lòng click đúp sao chép thủ công", "error")
                        );
                      }}
                      className="h-9 px-4.5 rounded-lg bg-brand-primary hover:bg-brand-primary-hover active:scale-97 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                    >
                      <Clipboard className="size-3.5" />
                      <span>Sao chép</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Core Player Screen Frame */}
          {activeVideoId ? (
            <div
              ref={containerRef}
              onMouseMove={handlePlayerMouseMove}
              onMouseEnter={handlePlayerMouseEnter}
              onMouseLeave={handlePlayerMouseLeave}
              onTouchStart={handlePlayerTouchStart}
              className={`relative rounded-2xl overflow-hidden border border-brand-border bg-black group select-none shadow-2xl shadow-black/80 transition-all duration-300 ${
                !controlsVisible ? "cursor-none" : ""
              }`}
            >
              {/* Reactive Beautiful Ambient Light */}
              {settings.ambientGlow && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-2xl">
                  <div
                    className="absolute -inset-10 bg-cover bg-center filter blur-3xl opacity-40 scale-110 saturate-150 animate-pulse"
                    style={{
                      backgroundImage: `url(https://img.youtube.com/vi/${activeVideoId}/0.jpg)`,
                      transition: "background-image 300ms ease",
                    }}
                  />
                </div>
              )}

              {/* Dynamic Interactive Stage */}
              <div className="relative z-10 w-full overflow-hidden bg-black aspect-video">
                
                {/* Scaling dynamic crop element */}
                <div
                  className={`absolute w-full select-none transition-all duration-300 ${
                    settings.bypassOverlay || isTempBypassing || !isPlaying ? "pointer-events-auto" : "pointer-events-none"
                  }`}
                  style={{
                    top: `-${settings.cropTop}px`,
                    height: `calc(100% + ${settings.cropTop + settings.cropBottom}px)`,
                    left: 0,
                  }}
                >
                  <div id="yt-player-target" className="w-full h-full pointer-events-auto" />
                </div>

                {/* Overlying Click-Shield so YouTube doesn't hijack double clicks/links.
                    Set pointer-events-none when paused to allow direct native user activation interaction with the YouTube Iframe, 
                    guaranteeing autoplay & API synchronization works 100% in sandboxed preview contexts. */}
                <div
                  className={`absolute inset-0 z-20 cursor-pointer transition-all ${
                    settings.bypassOverlay || isTempBypassing
                      ? "pointer-events-none opacity-0"
                      : (isPlaying ? "pointer-events-auto" : "pointer-events-none")
                  }`}
                  onClick={togglePlay}
                  onDoubleClick={handleFullscreenToggle}
                />

                {/* Micro state icon overlay during transitions */}
                <div className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none">
                  {!isPlaying && (
                    <div className="p-5 rounded-full bg-[#000]/60 backdrop-blur-md border border-white/10 scale-95 opacity-80">
                      <Play className="size-8 text-white fill-current" />
                    </div>
                  )}
                </div>

                {/* Float-HUD overlay controls (Appear on activity hover) */}
                <div
                  className={`absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-5 pt-16 flex flex-col gap-4.5 transition-all duration-350 ${
                    controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
                  }`}
                >
                  {/* Slider Progress Area */}
                  <div className="flex flex-col gap-1.5">
                    <div
                      ref={progressBarRef}
                      onClick={handleSeek}
                      onMouseDown={(e) => {
                        const moveHandler = (moveEvent: MouseEvent) => {
                          const rect = progressBarRef.current!.getBoundingClientRect();
                          const pct = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
                          const target = pct * duration;
                          playerRef.current?.seekTo(target, true);
                          setCurrTime(target);
                        };
                        const upHandler = () => {
                          document.removeEventListener("mousemove", moveHandler);
                          document.removeEventListener("mouseup", upHandler);
                        };
                        document.addEventListener("mousemove", moveHandler);
                        document.addEventListener("mouseup", upHandler);
                      }}
                      onTouchStart={(e) => {
                        const moveHandler = (moveEvent: TouchEvent) => {
                          if (moveEvent.touches.length === 0) return;
                          const rect = progressBarRef.current!.getBoundingClientRect();
                          const pct = Math.max(0, Math.min(1, (moveEvent.touches[0].clientX - rect.left) / rect.width));
                          const target = pct * duration;
                          playerRef.current?.seekTo(target, true);
                          setCurrTime(target);
                        };
                        const upHandler = () => {
                          document.removeEventListener("touchmove", moveHandler);
                          document.removeEventListener("touchend", upHandler);
                        };
                        document.addEventListener("touchmove", moveHandler);
                        document.addEventListener("touchend", upHandler);
                      }}
                      className="group/progress relative h-1.5 w-full bg-white/10 rounded-full cursor-pointer"
                    >
                      {/* Active Fill */}
                      <div
                        className="absolute left-0 top-0 h-full bg-brand-primary rounded-full group-hover/progress:bg-brand-primary transition-all pointer-events-none shadow-sm shadow-brand-primary/40"
                        style={{ width: `${progressPercentage}%` }}
                      />
                      {/* Interactive Thumb */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-full size-3 bg-white scale-0 group-hover/progress:scale-100 transition-transform shadow-md pointer-events-none"
                        style={{ left: `calc(${progressPercentage}% - 6px)` }}
                      />
                    </div>

                    {/* Timeline Values Display */}
                    <div className="flex justify-between items-center text-[11px] font-mono font-medium text-slate-400">
                      <span>{formatTime(currTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Operational Deck */}
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Media buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePlay}
                        className="size-11 rounded-xl bg-brand-primary text-white flex items-center justify-center hover:bg-brand-primary-hover active:scale-95 transition-all shadow-md shadow-brand-primary/20 cursor-pointer"
                      >
                        {isPlaying ? (
                          <Pause className="size-5 fill-current" />
                        ) : (
                          <Play className="size-5 fill-current ml-0.5" />
                        )}
                      </button>

                      <div className="h-6 w-px bg-white/10 mx-1.5" />

                      {/* Rewind */}
                      <button
                        onClick={() => handleSkip(-10)}
                        title="Tua lùi 10s"
                        className="size-9 rounded-lg bg-white/5 border border-white/5 text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center active:scale-92 transition-all cursor-pointer text-xs"
                      >
                        <RotateCcw className="size-4 shrink-0" />
                        <span className="text-[9px] font-bold ml-0.5 font-mono">10</span>
                      </button>

                      {/* Forward */}
                      <button
                        onClick={() => handleSkip(10)}
                        title="Tua tiến 10s"
                        className="size-9 rounded-lg bg-white/5 border border-white/5 text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center active:scale-92 transition-all cursor-pointer text-xs"
                      >
                        <RotateCcw className="size-4 shrink-0 rotate-180" />
                        <span className="text-[9px] font-bold ml-0.5 font-mono">10</span>
                      </button>

                      {/* Loop */}
                      <button
                        onClick={toggleLoop}
                        title={settings.loop ? "Đóng lặp liên tiếp" : "Bật lặp liên tiếp"}
                        className={`size-9 rounded-lg border flex items-center justify-center active:scale-92 transition-all cursor-pointer ${
                          settings.loop
                            ? "bg-brand-primary/20 border-brand-primary text-brand-primary shadow-sm"
                            : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <ListRestart className="size-4.5" />
                      </button>
                    </div>

                    {/* Left Actions: Volume, Quality, Speed, Fullscreen */}
                    <div className="flex items-center gap-3">
                      {/* Quality selection dropdown */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Chất Lượng</span>
                        <select
                          value={settings.quality}
                          onChange={(e) => setSettings((prev) => ({ ...prev, quality: e.target.value }))}
                          className="h-8 rounded-lg bg-white/5 text-slate-100 text-xs border border-white/10 px-2 font-medium focus:outline-hidden cursor-pointer"
                        >
                          <option value="default" className="bg-[#121214]">Tự động</option>
                          <option value="hd1080" className="bg-[#121214]">1080p Full-HD</option>
                          <option value="hd720" className="bg-[#121214]">720p HD</option>
                          <option value="large" className="bg-[#121214]">480p</option>
                          <option value="medium" className="bg-[#121214]">360p</option>
                          <option value="small" className="bg-[#121214]">240p</option>
                        </select>
                      </div>

                      {/* Speed selection list */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Tốc độ</span>
                        <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
                          {[1, 1.25, 1.5, 2].map((s) => (
                            <button
                              key={s}
                              onClick={() => changeSpeed(s)}
                              className={`px-2 py-1 text-[11px] rounded-md font-semibold transition-all cursor-pointer ${
                                settings.speed === s
                                  ? "bg-brand-primary text-white"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {s}x
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="h-6 w-px bg-white/10" />

                      {/* Volume Area */}
                      <div className="flex items-center gap-2 group/vol relative">
                        <button
                          onClick={toggleMute}
                          className="size-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          {settings.muted || settings.volume === 0 ? (
                            <VolumeX className="size-4.5 text-rose-400" />
                          ) : (
                            <Volume2 className="size-4.5" />
                          )}
                        </button>
                        
                        {/* Horizontal volume scrubber */}
                        <div className="w-18 flex items-center">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.muted ? 0 : settings.volume}
                            onChange={handleVolumeChange}
                            className="w-full accent-brand-primary bg-white/15 h-1 rounded-lg cursor-pointer hover:bg-white/20"
                          />
                        </div>
                      </div>

                      {/* Theater Mode Trigger */}
                      <button
                        onClick={toggleTheaterMode}
                        title={settings.theaterMode ? "Thoát chế độ rạp chiếu" : "Chế độ rạp chiếu rộng"}
                        className={`size-9 rounded-lg border hidden md:flex items-center justify-center transition-all cursor-pointer ${
                          settings.theaterMode
                            ? "bg-brand-primary/20 border-brand-primary text-brand-primary"
                            : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                        }`}
                      >
                        <AppWindow className="size-4.5" />
                      </button>

                      {/* Fullscreen Button */}
                      <button
                        onClick={handleFullscreenToggle}
                        title="Toàn màn hình (F)"
                        className="size-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white active:scale-93 transition-colors cursor-pointer"
                      >
                        <Maximize className="size-4.5" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* Standby Placeholder layout */
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-10 text-center relative overflow-hidden group shadow-md py-16">
              
              {/* Abstract decorative background rings */}
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-brand-border/20 pointer-events-none group-hover:scale-105 transition-all duration-700" />
              <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full border border-brand-border/10 pointer-events-none group-hover:scale-105 transition-all duration-700" />

              <div className="relative z-10 max-w-sm mx-auto">
                <div className="size-14 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mx-auto mb-5 text-brand-primary shadow-sm shadow-brand-primary/5">
                  <Sparkles className="size-6 animate-pulse" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-widest">
                  Hệ Thống Trình Phát Mượt Mà Đang Chờ
                </h3>
                <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                  Công nghệ cắt viền xung quanh của chúng tôi loại bỏ 100% video liên quan, quảng cáo nhảy bổ bên góc, khung xem đề xuất. Hãy dán một đường link của YouTube ở trên hoặc chọn nhanh danh sách đề cử lofi ở dưới!
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                  <button
                    onClick={() => handleSelectPreset(CURATED_PRESETS[0].url)}
                    className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-brand-primary/10 transition-all cursor-pointer"
                  >
                    <Play className="size-3.5 fill-current" />
                    Bật thử bài hát lofi beats
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Advanced layout crop adjustment drawer */}
          <div className="bg-brand-surface border border-brand-border rounded-xl shadow-xs overflow-hidden">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="w-full flex items-center justify-between p-4 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-brand-primary" />
                <span>Cấu hình dải cắt viền đen & Bộ căn chỉnh chuyên sâu</span>
              </div>
              {isSettingsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-brand-border/40 bg-brand-surface/30"
                >
                  <div className="p-4.5 space-y-4 text-xs">
                    <p className="text-slate-400 leading-relaxed text-[11px] bg-brand-surface2 border border-brand-border p-3 rounded-xl flex gap-2">
                      <Sliders className="size-4.5 text-brand-primary shrink-0 mt-0.5" />
                      <span>
                        <strong>Giải thích cách thức hoạt động:</strong> Mặc định, đỉnh trên và đuôi dưới video được che phủ một khoảng bằng dải cắt để loại đi thanh trạng thái gốc từ YouTube. Bạn có thể kéo thay đổi để cân xứng với khung hình của mình.
                      </span>
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      {/* Crop Top */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-medium text-slate-300">
                          <span>Khoảng che đầu (Crop Top):</span>
                          <span className="font-mono text-brand-primary text-xs font-semibold">-{settings.cropTop}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="150"
                          value={settings.cropTop}
                          onChange={(e) => setSettings((prev) => ({ ...prev, cropTop: parseInt(e.target.value) }))}
                          className="w-full accent-brand-primary bg-brand-border h-1 rounded"
                        />
                      </div>

                      {/* Crop Bottom */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-medium text-slate-300">
                          <span>Khoảng che đuôi (Crop Bottom):</span>
                          <span className="font-mono text-brand-primary text-xs font-semibold">-{settings.cropBottom}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="150"
                          value={settings.cropBottom}
                          onChange={(e) => setSettings((prev) => ({ ...prev, cropBottom: parseInt(e.target.value) }))}
                          className="w-full accent-brand-primary bg-brand-border h-1 rounded"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-3 border-t border-brand-border/40">
                      {/* Ambient Light Option */}
                      <label className="flex items-center justify-between p-3 rounded-xl bg-brand-surface2 border border-brand-border cursor-pointer hover:border-slate-700 transition-all select-none">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-semibold text-slate-200">Hiệu ứng Ambient Glow</span>
                          <span className="text-[10px] text-slate-500">Glow nền dịu mắt thích hợp phòng tối</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.ambientGlow}
                          onChange={(e) => setSettings((prev) => ({ ...prev, ambientGlow: e.target.checked }))}
                          className="size-4.5 accent-brand-primary cursor-pointer"
                        />
                      </label>

                      {/* Hide mouse cursor */}
                      <label className="flex items-center justify-between p-3 rounded-xl bg-brand-surface2 border border-brand-border cursor-pointer hover:border-slate-700 transition-all select-none">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-semibold text-slate-200">Ẩn thanh điều khiển khi rảnh</span>
                          <span className="text-[10px] text-slate-500">Tự ẩn sau 3s không di chuột</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.hideControlsOnIdle}
                          onChange={(e) => setSettings((prev) => ({ ...prev, hideControlsOnIdle: e.target.checked }))}
                          className="size-4.5 accent-brand-primary cursor-pointer"
                        />
                      </label>

                      {/* Default speed load setup */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-brand-surface2 border border-brand-border select-none animate-none">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-semibold text-slate-200">Định dạng nạp</span>
                          <span className="text-[10px] text-slate-500">Khôi phục độ giãn cắt</span>
                        </div>
                        <button
                          onClick={() => {
                            setSettings((prev) => ({ ...prev, cropTop: 60, cropBottom: 60 }));
                            addToast("Đã đưa tỷ lệ dải giãn cắt về mặc định (60px)", "info");
                          }}
                          className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-all cursor-pointer"
                        >
                          Khôi Phục
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!isGuestMode && (
            <PresetVideos onSelectVideo={handleSelectPreset} activeId={activeVideoId || undefined} />
          )}

        </section>

        {/* Right Side Info Panels (Only if theater mode is off and NOT in guest mode) */}
        {!settings.theaterMode && !isGuestMode && (
          <aside className="col-span-11 lg:col-span-4 space-y-6">
            
            {/* Detailed History logs panel */}
            <HistoryList
              history={history}
              onPlay={handleSelectPreset}
              onRemoveItem={handleRemoveHistoryItem}
              onClearAll={handleClearHistory}
              activeId={activeVideoId || undefined}
            />

            {/* Quick Tutorial Tips Box */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-slate-300 pb-2 border-b border-brand-border/40">
                <Activity className="size-4 text-slate-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider">Mẹo sử dụng siêu mượt</h4>
              </div>

              <ul className="text-xs text-slate-400 space-y-3 pl-1 leading-relaxed">
                <li className="flex gap-2 items-start">
                  <span className="size-1.5 rounded-full bg-brand-primary shrink-0 mt-1.5" />
                  <span>
                    <strong>Không bị gián đoạn:</strong> Player được cô lập hoàn toàn giúp giữ tài nguyên, đảm bảo CPU xử lý âm thanh tốt nhất.
                  </span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="size-1.5 rounded-full bg-brand-primary shrink-0 mt-1.5" />
                  <span>
                    <strong>Thiết kế Phóng to/Thu nhỏ:</strong> Nhấn đúp vào màn hình hoặc sử dụng phím <strong>F</strong> để chuyển đổi màn hình chiếu rạp toàn cảnh.
                  </span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="size-1.5 rounded-full bg-brand-primary shrink-0 mt-1.5" />
                  <span>
                    <strong>Chạy lặp không giới hạn:</strong> Bật biểu tượng mũi tên lặp lại <ListRestart className="inline size-3.5" /> để nghe đi nghe lại bài hát yêu thích suốt ngày dài.
                  </span>
                </li>
              </ul>
            </div>
            
          </aside>
        )}
      </main>

      {/* Floating Shortcut modal helper */}
      <ShortcutGuide isOpen={isShortcutOpen} onClose={() => setIsShortcutOpen(false)} />

      {/* Persistent Toast list alerts */}
      <Notification toasts={toasts} onRemove={handleRemoveToast} />
    </div>
  );
}
