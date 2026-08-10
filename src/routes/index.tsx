import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { CymaticLogo, CymaticWave } from "@/components/cymatic-wave";
import { ResonanceLoader } from "@/components/resonance-loader";
import {
  ArrowRight,
  Radio,
  Activity,
  ShieldCheck,
  MessagesSquare,
  Waves,
  LineChart,
  Check,
} from "lucide-react";
import ogAsset from "@/assets/og-image.jpg.asset.json";
import logoAsset from "@/assets/logo.png.asset.json";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Cymatic Resonance — Real-time team presence, DMs & group calls" },
      {
        name: "description",
        content:
          "Elite real-time attendance, workspace presence, DMs and group video calls. One workspace, one CYM access code, total clarity. Designed by Isabirye Latif (cymatichub.xyz).",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "googlebot", content: "index, follow" },
      { property: "og:title", content: "Cymatic Resonance — Team presence, in resonance" },
      {
        property: "og:description",
        content:
          "Track team presence in real-time, run elite internal comms, and host group calls. Built by Isabirye Latif at cymatichub.xyz.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://resonance.cymatichub.xyz/" },
      { property: "og:image", content: ogAsset.url },
      { property: "og:image:alt", content: "Cymatic Resonance — workspace presence platform" },
      { name: "twitter:title", content: "Cymatic Resonance — Team presence, in resonance" },
      {
        name: "twitter:description",
        content: "Real-time attendance, DMs, and group calls for elite teams.",
      },
      { name: "twitter:image", content: ogAsset.url },
    ],
    links: [
      { rel: "canonical", href: "https://resonance.cymatichub.xyz/" },
      { rel: "icon", type: "image/png", href: logoAsset.url },
      { rel: "apple-touch-icon", href: logoAsset.url },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Cymatic Resonance",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          url: "https://resonance.cymatichub.xyz/",
          image: ogAsset.url,
          description:
            "Real-time attendance, workspace presence, DMs and group video calls for elite teams.",
          author: { "@type": "Person", name: "Isabirye Latif", url: "https://cymatichub.xyz" },
          creator: { "@type": "Person", name: "Isabirye Latif", url: "https://cymatichub.xyz" },
          publisher: { "@type": "Organization", name: "CymaticHub", url: "https://cymatichub.xyz" },
          offers: [
            { "@type": "Offer", name: "Pulse", price: "0", priceCurrency: "USD" },
            { "@type": "Offer", name: "Resonance", price: "12", priceCurrency: "USD" },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What is a CYM access code?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Each workspace has a private CYM-XXXX code. Members join by entering it — no email invites required, and no cross-workspace data leakage.",
              },
            },
            {
              "@type": "Question",
              name: "Is data isolated per organization?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Row-level security enforces strict workspace isolation at the database layer.",
              },
            },
            {
              "@type": "Question",
              name: "Does Sync Pulse work on mobile?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. The entire surface is responsive and works as a PWA on iOS and Android.",
              },
            },
            {
              "@type": "Question",
              name: "Can I export attendance data?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Resonance and Frequency plans include CSV exports across any date range and category.",
              },
            },
          ],
        }),
      },
    ],
  }),
});

import type { Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.08,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground transition-colors duration-500">
        <div className="flex flex-col items-center space-y-12">
          <ResonanceLoader />
          <div className="flex flex-col items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent animate-pulse">
              Resonance Loading
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.5em] text-muted-foreground opacity-40">
              Synchronizing Pulse...
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/pulse" />;

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] size-[80vw] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] size-[60vw] rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <CymaticLogo />
        <nav className="hidden items-center gap-7 font-mono text-xs uppercase tracking-widest text-muted-foreground md:flex">
          <a href="#features" className="transition hover:text-foreground">
            Features
          </a>
          <a href="#pricing" className="transition hover:text-foreground">
            Pricing
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            FAQ
          </a>
        </nav>
        <Link
          to="/auth"
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
        >
          Sign in →
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-12 text-center md:pt-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass mx-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
        >
          <span className="inline-block size-1.5 rounded-full bg-accent animate-pulse-ring" />
          Workspace · Live · Secure
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="mt-8 font-display text-5xl font-bold tracking-tight md:text-7xl"
        >
          Presence, <span className="text-gradient">in resonance.</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          A precision-engineered attendance and comms surface for elite teams. One workspace, one
          CYM access code, total clarity.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
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
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-10 flex items-center justify-center gap-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span>SOC-grade isolation</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>Realtime presence</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>Zero-noise comms</span>
        </motion.div>
      </section>

      {/* Bento features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Surface</p>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            Built for teams that move in sync.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
          <Feature
            i={0}
            className="md:col-span-2 md:row-span-1"
            icon={Radio}
            title="Sync Pulse"
            desc="One-tap daily check-in with cymatic confirmation. Late, early, and category-aware in a single gesture."
          />
          <Feature
            i={1}
            icon={ShieldCheck}
            title="CYM Isolation"
            desc="Each workspace sealed by its private access code."
          />
          <Feature
            i={2}
            icon={LineChart}
            title="Command Center"
            desc="Live roll call, trends, and anomaly detection."
          />
          <Feature
            i={3}
            icon={MessagesSquare}
            title="Resonant Comms"
            desc="Broadcast channels, DMs, and reactions — all realtime."
          />
          <Feature
            i={4}
            icon={Waves}
            title="Frequency Insights"
            desc="Weekly patterns, category breakdowns, exportable to CSV."
          />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Pricing</p>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            Simple. Scaled to your signal.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              name: "Pulse",
              price: "Free",
              desc: "For tight teams just getting in sync.",
              feats: ["Up to 10 members", "Sync Pulse check-in", "1 broadcast channel"],
            },
            {
              name: "Resonance",
              price: "$12",
              suffix: "/seat",
              featured: true,
              desc: "For organizations running on rhythm.",
              feats: [
                "Unlimited members",
                "Full Command Center",
                "Unlimited channels & DMs",
                "CSV exports",
              ],
            },
            {
              name: "Frequency",
              price: "Custom",
              desc: "For enterprise with strict isolation needs.",
              feats: ["SSO & SAML", "Audit log", "Dedicated success engineer"],
            },
          ].map((p, i) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              custom={i}
              className={`glass relative rounded-2xl p-6 ${p.featured ? "ring-1 ring-accent/50" : ""}`}
            >
              {p.featured && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-frequency px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary-foreground">
                  Most resonant
                </span>
              )}
              <h3 className="font-display text-lg font-semibold">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                {p.suffix && (
                  <span className="font-mono text-xs text-muted-foreground">{p.suffix}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {p.feats.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  p.featured
                    ? "bg-frequency text-primary-foreground resonance-glow hover:brightness-110"
                    : "glass hover:bg-white/5"
                }`}
              >
                Get started
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24">
        <div className="mb-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">FAQ</p>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            Tuned for the questions you'll ask.
          </h2>
        </div>
        <div className="space-y-3">
          {[
            {
              q: "What is a CYM access code?",
              a: "Each workspace has a private CYM-XXXX code. Members join by entering it — no email invites required, and no cross-workspace data leakage.",
            },
            {
              q: "Is data isolated per organization?",
              a: "Yes. Row-level security enforces strict workspace isolation at the database layer, not just the UI.",
            },
            {
              q: "Does Sync Pulse work on mobile?",
              a: "Yes. The entire surface is responsive and works as a PWA on iOS and Android.",
            },
            {
              q: "Can I export attendance data?",
              a: "Resonance and Frequency plans include CSV exports across any date range and category.",
            },
          ].map((f, i) => (
            <motion.details
              key={f.q}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              custom={i}
              className="glass group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-base font-semibold">
                {f.q}
                <span className="font-mono text-accent transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </motion.details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="glass relative overflow-hidden rounded-3xl p-10 text-center md:p-16"
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-transparent to-accent/15" />
          <h2 className="font-display text-3xl font-semibold md:text-5xl">
            Get in <span className="text-gradient">resonance</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
            Spin up your workspace in under a minute. Bring your team in with a single CYM code.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-frequency px-6 py-3 text-sm font-semibold text-primary-foreground resonance-glow transition hover:brightness-110"
          >
            Start free <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <CymaticLogo size={28} />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            © {new Date().getFullYear()} Cymatic Resonance. All frequencies reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
  i,
  className = "",
}: {
  icon: typeof Radio;
  title: string;
  desc: string;
  i: number;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      custom={i}
      className={`glass group relative overflow-hidden rounded-2xl p-6 transition hover:bg-white/5 ${className}`}
    >
      <div className="absolute -right-10 -top-10 size-32 rounded-full bg-frequency/10 blur-3xl transition group-hover:bg-frequency/20" />
      <Icon className="size-5 text-accent" />
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </motion.div>
  );
}
