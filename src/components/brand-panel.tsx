import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Palette } from "lucide-react";
import { toast } from "sonner";

type Props = {
  orgId: string;
  logoUrl: string | null;
  accentColor: string | null;
  onChange: (patch: { logo_url?: string | null; accent_color?: string | null }) => void;
};

const PRESETS = ["#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export function BrandPanel({ orgId, logoUrl, accentColor, onChange }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState(accentColor ?? "#7c3aed");

  useEffect(() => {
    if (!logoUrl) {
      setSignedUrl(null);
      return;
    }
    supabase.storage
      .from("org-logos")
      .createSignedUrl(logoUrl, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
      });
  }, [logoUrl]);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Image files only");
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2 MB");
    setBusy(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${orgId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("org-logos")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.rpc("update_org_brand", {
      _logo_url: path,
      _accent_color: color,
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const { data: signed } = await supabase.storage.from("org-logos").createSignedUrl(path, 3600);
    setSignedUrl(signed?.signedUrl ?? null);
    onChange({ logo_url: path });
    setBusy(false);
    toast.success("Logo updated");
  };

  const saveColor = async (c: string) => {
    setColor(c);
    const { error } = await supabase.rpc("update_org_brand", {
      _logo_url: logoUrl || "",
      _accent_color: c,
    });
    if (error) return toast.error(error.message);
    onChange({ accent_color: c });
    document.documentElement.style.setProperty("--brand-accent", c);
    toast.success("Accent updated");
  };

  return (
    <section className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2">
        <Palette className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold">Brand</h3>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div className="grid size-24 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {signedUrl ? (
              <img src={signedUrl} alt="Workspace logo" className="size-full object-cover" />
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                No logo
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-50"
          >
            <Upload className="size-3" /> {busy ? "Uploading…" : "Upload logo"}
          </button>
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Accent color
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => saveColor(c)}
                aria-label={c}
                className={`size-8 rounded-full border-2 transition ${color === c ? "border-white scale-110" : "border-white/20 hover:scale-105"}`}
                style={{ background: c }}
              />
            ))}
            <label className="ml-2 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs">
              <input
                type="color"
                value={color}
                onChange={(e) => saveColor(e.target.value)}
                className="h-5 w-7 cursor-pointer bg-transparent"
              />
              <span className="font-mono">{color}</span>
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Color reflects through highlights, buttons, and glow.
          </p>
        </div>
      </div>
    </section>
  );
}
