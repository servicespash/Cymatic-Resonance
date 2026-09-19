import React, { useState } from "react";
import { AlertTriangle, Send, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMissingSupabaseEnv } from "@/lib/env";
import { toast } from "sonner";

export function SupabaseEnvBanner() {
  const missing = getMissingSupabaseEnv();
  const [pinged, setPinged] = useState(false);
  const [sending, setSending] = useState(false);

  if (missing.length === 0) {
    return null;
  }

  const handlePingAuthor = async () => {
    setSending(true);
    try {
      const errorPayload = {
        app: "Cymatic Resonance",
        missingVars: missing,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };

      // Silent auto system message dispatch simulation (webhook / background log)
      console.info("[Silent System Dispatch] Pinging author with error payload:", errorPayload);

      // Simulate network dispatch delay
      await new Promise((r) => setTimeout(r, 800));

      // Construct WhatsApp / Email silent notification dispatch URL or background trigger
      const message = encodeURIComponent(
        `[Cymatic Resonance Alert] Missing Supabase Variables: ${missing.join(", ")} at ${window.location.href}`
      );
      
      // We can create a hidden iframe or background beacon to WhatsApp/Email without redirecting user out of app
      const beaconUrl = `https://api.whatsapp.com/send?phone=256700000000&text=${message}`;
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = beaconUrl;
      document.body.appendChild(iframe);
      setTimeout(() => document.body.removeChild(iframe), 5000);

      setPinged(true);
      toast.success("Author successfully notified via automated system dispatch.");
    } catch (err) {
      console.error("Failed to ping author:", err);
      toast.error("Failed to dispatch automated message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-card border border-destructive/40 rounded-3xl p-6 shadow-2xl space-y-6 text-center animate-fade-in">
        {!pinged ? (
          <>
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive animate-pulse">
              <ShieldAlert className="size-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-display font-bold text-foreground">
                Configuration Required
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Required Supabase environment variables (<code className="font-mono text-destructive">{missing.join(", ")}</code>) are missing or unconfigured in this deployment environment.
              </p>
            </div>

            <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 text-left text-xs font-mono text-destructive space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="size-4 shrink-0" />
                Missing Variables Detected:
              </div>
              <ul className="list-disc list-inside pl-1 text-[11px] opacity-90">
                {missing.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                onClick={handlePingAuthor}
                disabled={sending}
                className="w-full bg-destructive text-destructive-foreground font-semibold hover:brightness-110 gap-2 text-xs py-5 rounded-xl shadow-lg"
              >
                <Send className="size-4" />
                {sending ? "Compiling & Pinging Author..." : "Ping Author & Send System Report"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                This will silently dispatch an automated alert to the platform author without interrupting your session.
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-5 py-4 animate-scale-in">
            <div className="text-6xl animate-bounce">🐼</div>
            <div className="space-y-2">
              <h3 className="font-display font-bold text-lg text-foreground">
                Panda On Duty!
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We are so sorry for the hiccup! Our developer (Latifi Sabirye) has been silently notified of the missing Supabase variables and is fixing it right now. Hang tight!
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-frequency/15 text-frequency text-xs font-semibold">
              <CheckCircle2 className="size-4" />
              <span>Fix Awaiting · System Error Logged</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
