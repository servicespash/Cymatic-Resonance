import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CymaticWave } from "@/components/cymatic-wave";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/self-rush")({
  component: SelfRushPage,
});

function SelfRushPage() {
  const codeParam = new URLSearchParams(window.location.search).get("code") || "";

  const [step, setStep] = useState(1);
  const [code, setCode] = useState(codeParam);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);

  useEffect(() => {
    if (step === 2) {
      const t = setInterval(() => {
        setTimeLeft((l) => {
          if (l <= 1) {
            handleEndSession();
            return 0;
          }
          return l - 1;
        });
      }, 1000);
      return () => clearInterval(t);
    }
  }, [step, handleEndSession]);

  useEffect(() => {
    const handleUnload = () => {
      if (step === 2) supabase.auth.signOut();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [step]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    // First verify the CYM code belongs to an org
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id")
      .eq("access_code", code)
      .single();
    if (!orgs) {
      toast.error("Invalid CYM Code");
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Ephemeral session started");
    setStep(2);
  };

  const handlePulse = async () => {
    setBusy(true);
    const telemetryNote = JSON.stringify({
      text: "Self-Rush Public Terminal",
      telemetry: { status: "external", variance: 0, lat: 0, lng: 0 },
    });

    const { error } = await supabase.rpc("pulse_checkin", { _note: telemetryNote });
    setBusy(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Resonance recorded successfully");
      handleEndSession();
    }
  };

  const handleEndSession = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/self-rush?code=" + code;
  }, [code]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#030712] text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <CymaticWave className="h-12" bars={5} />
        </div>

        {step === 1 ? (
          <form
            onSubmit={handleLogin}
            className="glass-strong rounded-3xl p-8 space-y-4 resonance-glow"
            autoComplete="off"
          >
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl font-bold">Self-Rush Portal</h1>
              <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-widest">
                Public Terminal Access
              </p>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-1">
                Institution CYM Code
              </label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-1">
                Account Email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-1">
                Institutional Password
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-accent"
              />
            </div>

            <button
              disabled={busy}
              className="w-full mt-6 bg-accent text-accent-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              {busy ? "Authenticating..." : "Initialize Session"}
            </button>
          </form>
        ) : (
          <div className="glass-strong rounded-3xl p-8 text-center resonance-glow">
            <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg mb-6 font-mono text-sm tracking-widest">
              <span className="animate-pulse">●</span> {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </div>

            <h2 className="font-display text-xl font-bold mb-8">Execute Pulse</h2>

            <button
              onClick={handlePulse}
              disabled={busy}
              className="relative size-40 mx-auto rounded-full bg-accent/20 border border-accent/40 resonance-glow hover:scale-[1.02] transition-transform flex flex-col items-center justify-center"
            >
              <CymaticWave className="h-6 mb-2" bars={6} />
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
                Sync
              </span>
            </button>

            <button
              onClick={handleEndSession}
              className="mt-8 mx-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
            >
              <LogOut className="size-4" /> Abort Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
