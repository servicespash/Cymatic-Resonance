import { Shield, Info, FileText, ExternalLink } from "lucide-react";
import { LegalTab } from "./legal-viewer";

interface FooterProps {
  onLegalClick?: (tab: LegalTab) => void;
}

export function Footer({ onLegalClick }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const handleLegalClick = (e: React.MouseEvent, tab: LegalTab) => {
    e.preventDefault();
    onLegalClick?.(tab);
  };

  return (
    <footer className="mt-auto border-t border-white/5 bg-white/[0.01] px-6 py-8 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-accent animate-pulse" />
              <span className="font-display text-sm font-bold tracking-tight text-white">
                Cymatic <span className="text-accent">Resonance</span>
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Institutional Pulse & Team Telemetry Grid
            </p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            <button
              onClick={(e) => handleLegalClick(e, "about")}
              className="group flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
            >
              <Info className="size-3.5 transition-transform group-hover:scale-110" />
              About
            </button>
            <button
              onClick={(e) => handleLegalClick(e, "privacy")}
              className="group flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
            >
              <Shield className="size-3.5 transition-transform group-hover:scale-110" />
              Privacy
            </button>
            <button
              onClick={(e) => handleLegalClick(e, "terms")}
              className="group flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
            >
              <FileText className="size-3.5 transition-transform group-hover:scale-110" />
              Terms
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="https://cymatichub.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-accent transition-opacity hover:opacity-80"
            >
              Cymatic Hub <ExternalLink className="size-2.5" />
            </a>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-[10px] font-medium text-muted-foreground">
              &copy; {currentYear}
            </span>
          </div>
        </div>

        <div className="mt-8 flex justify-center border-t border-white/5 pt-8 text-center">
          <p className="max-w-2xl text-[9px] uppercase leading-loose tracking-[0.3em] text-muted-foreground/40">
            Engineered by Isabirye Latif &bull; Signal Locked &bull; Institutional Authority
            Verified &bull; System Pulse Active
          </p>
        </div>
      </div>
    </footer>
  );
}
