import { motion } from "motion/react";
import { Scale, ShieldCheck, FileText, Globe, X } from "lucide-react";

export type LegalTab = "about" | "privacy" | "terms" | "compliance";

interface LegalViewerProps {
  activeTab: LegalTab;
  onClose: () => void;
}

export function LegalViewer({ activeTab, onClose }: LegalViewerProps) {
  const sections = [
    {
      id: "about",
      title: "Platform Vision",
      icon: Globe,
      content:
        "Cymatic Resonance is an institutional pulse and team telemetry grid engineered for high-clarity attendance registration and collective team network performance analytics. We bridge the gap between physical presence and digital velocity.",
    },
    {
      id: "terms",
      title: "Terms of Service",
      icon: FileText,
      content:
        "By accessing and using Cymatic Resonance, you agree to comply with our core resonance protocols. The platform is designed for professional workspace presence and high-performance communication. Unauthorized access to frequency data or resonance streams is strictly prohibited.",
    },
    {
      id: "privacy",
      title: "Privacy Policy",
      icon: ShieldCheck,
      content:
        "Your frequency footprint is your own. We collect minimal data necessary to maintain workspace presence and sync pulses. We do not sell your resonance data to third parties. All communications are encrypted and transient by design.",
    },
    {
      id: "compliance",
      title: "Compliance & Safety",
      icon: Scale,
      content:
        "Cymatic Resonance adheres to global data protection standards (GDPR, CCPA). Our 'Signal Locked' status ensures that your workspace remains a secure, high-trust environment for collaborative resonance.",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative min-h-[60vh] rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-xl md:p-12"
    >
      <button
        onClick={onClose}
        className="absolute right-6 top-6 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-all hover:bg-white/10 hover:text-white"
      >
        <X className="size-5" />
      </button>

      <header className="mb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          <Globe className="size-3" /> Signal Transparency
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Legal & <span className="text-accent">Resonance</span> Authority
        </h1>
      </header>

      <div className="grid gap-8 sm:grid-cols-2">
        {sections.map((s) => (
          <div
            key={s.id}
            className={`group rounded-2xl border p-8 transition-all ${
              activeTab === s.id
                ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                : "border-white/5 bg-white/[0.01] hover:border-white/10"
            }`}
          >
            <div
              className={`inline-flex size-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
                activeTab === s.id ? "bg-accent/20 text-accent" : "bg-white/5 text-muted-foreground"
              }`}
            >
              <s.icon className="size-6" />
            </div>
            <h2 className="mt-6 font-display text-xl font-semibold">{s.title}</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{s.content}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
