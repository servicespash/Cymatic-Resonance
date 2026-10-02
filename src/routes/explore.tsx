import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPinned, Radio, ShieldCheck, Users, Activity } from "lucide-react";

export const Route = createFileRoute("/explore")({
  component: ExploreResonancePage,
});

const sections = [
  {
    id: "presence",
    icon: Users,
    title: "Institutional presence",
    body: "Coordinate attendance, membership, operational presence, and institutional activity from one controlled workspace.",
  },
  {
    id: "location",
    icon: MapPinned,
    title: "Location intelligence",
    body: "Record authoritative check-in coordinates, geofence evidence, address context, and consented live location without confusing a historical check-in with a current position.",
  },
  {
    id: "realtime",
    icon: Radio,
    title: "Realtime operations",
    body: "Realtime projections keep operational maps and presence surfaces responsive while persistent PostgreSQL state remains the source of truth.",
  },
  {
    id: "verification",
    icon: ShieldCheck,
    title: "Verifiable records",
    body: "Engine-issued exports can carry a verification fingerprint and QR link so a recipient can validate the document from an ordinary browser.",
  },
];

function ExploreResonancePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="min-h-[82vh] border-b border-white/10 px-6 py-20">
        <div className="mx-auto flex min-h-[65vh] max-w-6xl flex-col justify-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
            Cymatic Resonance
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight sm:text-7xl">
            The institutional execution layer for presence, telemetry, and verification.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Explore the public architecture before entering the protected workspace. Operational
            data remains organization-scoped and protected behind authentication.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white"
            >
              Enter Resonance <ArrowRight className="size-4" />
            </Link>
            <a
              href="#architecture"
              className="rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-sm"
            >
              Explore architecture
            </a>
          </div>
        </div>
      </section>

      <section id="architecture" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-20">
        <div className="grid gap-5 md:grid-cols-2">
          {sections.map(({ id, icon: Icon, title, body }) => (
            <article
              key={id}
              id={id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"
            >
              <Icon className="size-6 text-accent" />
              <h2 className="mt-5 text-xl font-semibold">{title}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <Activity className="size-7 text-accent" />
          <h2 className="mt-5 text-3xl font-semibold">Built around authority boundaries</h2>
          <p className="mt-4 leading-8 text-muted-foreground">
            Authentication establishes identity. Organization membership establishes scope.
            Entitlements establish capability. Server RPCs establish authority. PostgreSQL stores
            truth. Realtime projects state. The interface renders it. No single UI component gets to
            overrule the chain.
          </p>
        </div>
      </section>

      <footer className="px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>Cymatic Resonance</span>
          <Link to="/auth" className="underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </footer>
    </main>
  );
}
