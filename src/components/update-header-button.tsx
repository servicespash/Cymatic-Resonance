import React from "react";
import { Sparkles } from "lucide-react";
import { useVersionCheck } from "@/hooks/useVersionCheck";

export function UpdateHeaderButton() {
  const { hasUpdate, userDismissed, openUpdateModal } = useVersionCheck();

  if (!hasUpdate || !userDismissed) return null;

  return (
    <button
      onClick={openUpdateModal}
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-frequency/15 hover:bg-frequency/25 text-frequency border border-frequency/30 text-xs font-semibold transition animate-pulse"
      title="New updates available. Click to refresh."
      aria-label="New updates available"
    >
      <Sparkles className="size-3.5 animate-spin-slow" />
      <span className="hidden sm:inline">Update Ready</span>
      <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-frequency animate-ping" />
    </button>
  );
}
