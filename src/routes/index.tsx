import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { CymaticLogo, CymaticWave } from "@/components/cymatic-wave";
import { ArrowRight, Radio, Activity, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Cymatic Resonance — Workspace presence & comms" },
      { name: "description", content: "Track team presence in real-time and run elite internal comms — secured by CYM workspace codes." },
    ],
  }),
});

function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );
  }
  if (user) return <Navigate to="/pulse" />;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <CymaticLogo />
        <Link
          to="/auth"
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
        >
          Sign in →
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <div className="glass mx-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground animate-fade-up">
          <span className="inline-block size-1.5 rounded-full bg-accent animate-pulse-ring" />
          Workspace · Live · Secure
        </div>

        <h1 className="mt-8 font-display text-5xl font-bold tracking-tight md:text-7xl animate-fade-up" style={{ animationDelay: "60ms" }}>
          Presence,{" "}
          <span className="text-gradient">in resonance.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg animate-fade-up" style={{ animationDelay: "120ms" }}>
          A precision-engineered attendance and comms surface for elite teams.
          One workspace, one CYM access code, total clarity.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up" style={{ animationDelay: "180ms" }}>
          <Link
            to="/auth"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-frequency px-6 py-3 text-sm font-semibold text-primary-foreground resonance-glow transition hover:brightness-110"
          >
            Enter workspace
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/auth"
            className="glass inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition hover:bg-white/5"
          >
            Create organization
          </Link>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: Radio, t: "Sync Pulse", d: "One-tap daily check-in with cymatic confirmation." },
            { icon: Activity, t: "Command Center", d: "Live roll call, trends, and anomaly detection." },
            { icon: ShieldCheck, t: "CYM Isolation", d: "Each workspace sealed by its private access code." },
          ].map((f, i) => (
            <div key={f.t} className="glass rounded-2xl p-6 text-left animate-fade-up" style={{ animationDelay: `${240 + i * 60}ms` }}>
              <f.icon className="size-5 text-accent" />
              <h3 className="mt-4 font-display text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
