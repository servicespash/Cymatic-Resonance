import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, Send, Play, Pause } from "lucide-react";
import { CymaticWave } from "@/components/cymatic-wave";
import { toast } from "sonner";

const MAX_MS = 5 * 60 * 1000;

export type RecordedAudio = {
  blob: Blob;
  mime: string;
  ext: string;
  durationMs: number;
};

export function RecordAudioMessage({
  onCancel,
  onSend,
}: {
  onCancel: () => void;
  onSend: (audio: RecordedAudio) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<RecordedAudio | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const dur = Date.now() - startedRef.current;
        setPreview({ blob, mime: type, ext, durationMs: dur });
        stopTracks();
      };

      startedRef.current = Date.now();
      mr.start();
      setRecording(true);
      setElapsed(0);

      tickRef.current = window.setInterval(() => {
        const e = Date.now() - startedRef.current;
        setElapsed(e);
        if (e >= MAX_MS) {
          toast.message("Maximum 5 minutes recording time reached");
          stop();
        }
      }, 200);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Microphone access denied");
      onCancel();
    }
  };

  const stop = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
    try {
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
      }
    } catch (e) {
      console.error("Failed to stop media recorder:", e);
    }
  };

  useEffect(() => {
    start();
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      try {
        if (mediaRef.current?.state !== "inactive") {
          mediaRef.current?.stop();
        }
      } catch (e) {
        console.error("Failed to stop media recorder on cleanup:", e);
      }
      stopTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mmss = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const togglePreviewPlay = () => {
    if (!preview || !audioPreviewRef.current) return;
    if (isPlaying) {
      audioPreviewRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-black/60 border border-primary/30 p-3 backdrop-blur-xl shadow-2xl animate-fade-up">
      {/* State Header Badge */}
      <div className="flex items-center justify-between text-xs font-semibold px-1">
        <div className="flex items-center gap-2">
          {recording ? (
            <span className="flex items-center gap-1.5 text-destructive font-mono uppercase tracking-wider text-[11px] font-bold animate-pulse">
              <span className="size-2.5 rounded-full bg-destructive animate-ping" /> Recording Audio
              Message
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-accent font-mono uppercase tracking-wider text-[11px] font-bold">
              <Play className="size-3 text-accent" /> Audio Snippet Ready
            </span>
          )}
        </div>
        <span className="font-mono text-xs text-foreground font-bold">
          {mmss(preview ? preview.durationMs : elapsed)}
        </span>
      </div>

      {/* Visual Waveform & Control Bar */}
      <div className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 border border-white/10">
        <span
          className={`grid size-9 place-items-center rounded-xl transition-all ${
            recording
              ? "bg-destructive/20 text-destructive border border-destructive/30"
              : "bg-accent/20 text-accent border border-accent/30"
          }`}
        >
          <Mic className="size-4" />
        </span>

        {/* Dynamic Soundwave */}
        <CymaticWave className="h-6 flex-1" bars={16} />

        {/* Action Controls */}
        {recording ? (
          <button
            type="button"
            onClick={stop}
            className="grid size-9 place-items-center rounded-xl bg-destructive text-destructive-foreground hover:brightness-110 active:scale-95 transition-all shadow-md"
            title="Stop Recording"
          >
            <Square className="size-4" />
          </button>
        ) : preview ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePreviewPlay}
              className="grid size-9 place-items-center rounded-xl bg-white/10 text-foreground hover:bg-white/20 active:scale-95 transition-all"
              title={isPlaying ? "Pause Preview" : "Play Preview"}
            >
              {isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 translate-x-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSend(preview)}
              className="grid size-9 place-items-center rounded-xl bg-frequency text-primary-foreground resonance-glow hover:brightness-110 active:scale-95 transition-all shadow-lg"
              title="Send Audio Message"
            >
              <Send className="size-4" />
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            stop();
            onCancel();
          }}
          className="grid size-9 place-items-center rounded-xl bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
          title="Cancel Audio Snippet"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Hidden Audio Player for Preview */}
      {preview && (
        <audio
          ref={audioPreviewRef}
          src={URL.createObjectURL(preview.blob)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
