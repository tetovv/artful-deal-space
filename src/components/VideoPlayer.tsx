import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { useVideoViewTracker } from "@/hooks/useVideoViews";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  videoId?: string;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ src, poster, className, videoId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Track 30% view
  useVideoViewTracker(videoId, videoRef);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  const video = videoRef.current;

  const togglePlay = useCallback(() => {
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setShowOverlay(false);
    } else {
      video.pause();
    }
  }, [video]);

  const seek = useCallback((val: number[]) => {
    if (!video) return;
    video.currentTime = val[0];
    setCurrentTime(val[0]);
  }, [video]);

  const changeVolume = useCallback((val: number[]) => {
    if (!video) return;
    const v = val[0];
    video.volume = v;
    setVolume(v);
    setMuted(v === 0);
  }, [video]);

  const toggleMute = useCallback(() => {
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, [video]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, [video]);

  const changeSpeed = useCallback((rate: number) => {
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  }, [video]);

  // Event listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onLoaded = () => setDuration(v.duration);
    const onProgress = () => {
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("progress", onProgress);
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("progress", onProgress);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [src]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (playing) {
      hideTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    } else {
      resetHideTimer();
    }
  }, [playing, resetHideTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); skip(-5); break;
        case "ArrowRight": e.preventDefault(); skip(5); break;
        case "ArrowUp": e.preventDefault(); changeVolume([Math.min(1, volume + 0.1)]); break;
        case "ArrowDown": e.preventDefault(); changeVolume([Math.max(0, volume - 0.1)]); break;
        case "m": e.preventDefault(); toggleMute(); break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, skip, changeVolume, volume, toggleMute, toggleFullscreen]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      ref={containerRef}
      className={cn("relative bg-black group/player select-none overflow-hidden", className)}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-controls]")) return;
        togglePlay();
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        className="w-full h-full object-contain"
      />

      {/* Big center play button overlay */}
      {showOverlay && !playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="h-20 w-20 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center hover:bg-primary transition-all hover:scale-110 shadow-2xl"
          >
            <Play className="h-9 w-9 text-primary-foreground ml-1" fill="currentColor" />
          </button>
        </div>
      )}

      {/* Skip feedback areas */}
      <div className="absolute inset-y-0 left-0 w-1/4" onDoubleClick={(e) => { e.stopPropagation(); skip(-10); }} />
      <div className="absolute inset-y-0 right-0 w-1/4" onDoubleClick={(e) => { e.stopPropagation(); skip(10); }} />

      {/* Bottom controls */}
      <div
        data-controls
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 pb-3 px-4 transition-opacity duration-300",
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/progress mb-3"
          onClick={(e) => {
            if (!video) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            video.currentTime = pct * duration;
          }}
        >
          {/* Buffered */}
          <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${bufferedPercent}%` }} />
          {/* Played */}
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 bg-primary rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Left controls */}
          <div className="flex items-center gap-1.5">
            <button onClick={togglePlay} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white">
              {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 ml-0.5" fill="currentColor" />}
            </button>
            <button onClick={() => skip(-10)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white">
              <SkipBack className="h-4 w-4" />
            </button>
            <button onClick={() => skip(10)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white">
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 group/vol">
              <button onClick={toggleMute} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white">
                {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                <Slider
                  value={[muted ? 0 : volume]}
                  max={1}
                  step={0.05}
                  onValueChange={changeVolume}
                  className="w-20 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white"
                />
              </div>
            </div>

            {/* Time */}
            <span className="text-xs text-white/80 font-mono tabular-nums ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 relative">
            {/* Speed */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="h-9 px-2 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white text-xs font-medium"
              >
                {playbackRate !== 1 ? `${playbackRate}x` : <Settings className="h-4 w-4" />}
              </button>
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-card/95 backdrop-blur-xl border border-border rounded-xl p-2 shadow-2xl min-w-[120px]">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 pb-1">Скорость</p>
                  {speeds.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors",
                        playbackRate === s ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white">
              {fullscreen ? <Minimize className="h-4.5 w-4.5" /> : <Maximize className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
