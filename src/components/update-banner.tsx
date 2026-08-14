import React from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { useVersionCheck } from "@/hooks/useVersionCheck";

interface UpdateBannerProps {
  fullName?: string | null;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ fullName }) => {
  const { hasUpdate, reloadApp } = useVersionCheck();

  if (!hasUpdate) return null;

  const firstName = fullName ? fullName.split(" ")[0] : "User";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-card/90 border border-frequency/40 p-4 shadow-2xl backdrop-blur-xl animate-bounce-short">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-frequency/20 text-frequency">
        <Sparkles className="size-5 animate-spin-slow" />
      </div>
      <div className="text-xs">
        <p className="font-semibold text-foreground">Hey {firstName}, this page has updates!</p>
        <p className="text-muted-foreground">A new version of Cymatic Resonance is live.</p>
      </div>
      <button
        onClick={reloadApp}
        className="ml-2 flex items-center gap-1.5 rounded-xl bg-frequency px-3 py-2 text-xs font-bold text-background transition hover:brightness-110 active:scale-95"
      >
        <RefreshCw className="size-3.5" />
        <span>Refresh Updates</span>
      </button>
    </div>
  );
};
