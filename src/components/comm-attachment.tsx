import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Play, Pause, ImageIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export type Attachment = {
  id: string;
  message_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  kind: "image" | "audio" | "file";
  filename: string;
  duration_ms: number | null;
};

const urlCache = new Map<string, { url: string; expires: number }>();

async function getSignedUrl(path: string): Promise<string | null> {
  const cached = urlCache.get(path);
  if (cached && cached.expires > Date.now() + 60_000) return cached.url;
  try {
    const { data } = await supabase.storage.from("comm-attachments").createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 3600 * 1000 });
      return data.signedUrl;
    }
    const publicRes = supabase.storage.from("comm-attachments").getPublicUrl(path);
    return publicRes.data?.publicUrl ?? null;
  } catch (err) {
    console.error("Error fetching attachment URL:", err);
    return null;
  }
}

function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getSignedUrl(path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function CommAttachment({ a, mine }: { a: Attachment; mine: boolean }) {
  if (a.kind === "image") return <ImageAtt a={a} />;
  if (a.kind === "audio") return <AudioAtt a={a} mine={mine} />;
  return <FileAtt a={a} mine={mine} />;
}

function ImageAtt({ a }: { a: Attachment }) {
  const url = useSignedUrl(a.storage_path);
  const [open, setOpen] = useState(false);
  if (!url)
    return (
      <div className="grid h-32 w-48 place-items-center rounded-xl bg-white/5 text-muted-foreground">
        <ImageIcon className="size-5" />
      </div>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:ring-accent/40"
      >
        <img
          src={url}
          alt={a.filename}
          className="max-h-64 max-w-[280px] object-cover"
          loading="lazy"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-white/10 bg-background/95 p-2">
          <img
            src={url}
            alt={a.filename}
            className="mx-auto max-h-[80vh] rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function AudioAtt({ a, mine }: { a: Attachment; mine: boolean }) {
  const url = useSignedUrl(a.storage_path);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(a.duration_ms ?? 0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3 py-2 ring-1 ring-white/10 ${mine ? "bg-primary-foreground/10" : "bg-white/5"}`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        className="grid size-9 place-items-center rounded-full bg-frequency text-primary-foreground resonance-glow disabled:opacity-40"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-0.5" />}
      </button>
      <div className="flex min-w-[140px] flex-1 flex-col gap-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: dur ? `${Math.min(100, (pos / dur) * 100)}%` : "0%" }}
          />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {mmss(playing || pos ? pos : dur)}
        </span>
      </div>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setPos(0);
          }}
          onTimeUpdate={(e) => setPos((e.currentTarget.currentTime || 0) * 1000)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (isFinite(d) && d > 0) setDur(d * 1000);
          }}
        />
      )}
    </div>
  );
}

function FileAtt({ a, mine }: { a: Attachment; mine: boolean }) {
  const url = useSignedUrl(a.storage_path);
  return (
    <a
      href={url ?? undefined}
      download={a.filename}
      target="_blank"
      rel="noreferrer"
      className={`flex max-w-[280px] items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 ring-white/10 transition hover:ring-accent/40 ${mine ? "bg-primary-foreground/10" : "bg-white/5"}`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-frequency/20 text-accent">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold">{a.filename}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{fmtSize(a.size_bytes)}</div>
      </div>
      <Download className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}
