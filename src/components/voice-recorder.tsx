import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, Send } from "lucide-react";
import { CymaticWave } from "@/components/cymatic-wave";
import { toast } from "sonner";

const MAX_MS = 5 * 60 * 1000;

export type RecordedAudio = { blob: Blob; mime: string; ext: string; durationMs: number };

export function VoiceRecorder({
  onCancel,
  onSend,
}: {
  onCancel: () => void;
  onSend: (audio: RecordedAudio) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<RecordedAudio | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);

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
          toast.message("Max 5 min reached");
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
      mediaRef.current?.stop();
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

  return (
    <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
      <span
        className={`grid size-7 place-items-center rounded-full ${recording ? "bg-accent/20 text-accent" : "bg-white/10 text-muted-foreground"}`}
      >
        <Mic className="size-3.5" />
      </span>
      <CymaticWave className="h-4 flex-1" bars={12} />
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {mmss(preview ? preview.durationMs : elapsed)}
      </span>
      {recording ? (
        <button
          type="button"
          onClick={stop}
          className="grid size-8 place-items-center rounded-lg bg-white/10 text-foreground hover:bg-white/20"
          aria-label="Stop"
        >
          <Square className="size-3.5" />
        </button>
      ) : preview ? (
        <button
          type="button"
          onClick={() => onSend(preview)}
          className="grid size-8 place-items-center rounded-lg bg-frequency text-primary-foreground resonance-glow"
          aria-label="Send voice note"
        >
          <Send className="size-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          stop();
          onCancel();
        }}
        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground"
        aria-label="Cancel"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
