import { ChevronDown, ChevronUp, LockKeyhole, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ENTITLEMENT_TIERS,
  getCallParticipantLimit,
} from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

export function CallCapacityUpgradePanel({
  plan,
  mode,
  participantCount,
  maxParticipants,
}: {
  plan: EntitlementPlan;
  mode: "AUDIO" | "VIDEO";
  participantCount: number;
  maxParticipants: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (participantCount <= maxParticipants) return null;

  return (
    <aside className="pointer-events-auto absolute bottom-4 left-4 right-4 z-20 mx-auto w-[min(100%-2rem,900px)] rounded-2xl border border-accent/30 bg-card/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <LockKeyhole className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            Capacity reached
          </p>
          <p className="text-sm font-medium">
            This {mode.toLowerCase()} Call Room is above the current {plan} admission limit.
          </p>
          <p className="text-xs text-muted-foreground">
            Existing participants remain connected. New participants require a higher authorized capacity.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="call-capacity-tier-matrix"
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          <span className="hidden sm:inline">Plans</span>
        </Button>
      </div>

      {expanded && (
        <div id="call-capacity-tier-matrix" className="border-t border-white/10 p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {ENTITLEMENT_TIERS.map((tier) => {
              const limit = getCallParticipantLimit(tier.plan, mode);
              return (
                <div
                  key={tier.plan}
                  className={`rounded-xl border p-3 \${
                    tier.plan === plan
                      ? "border-accent/40 bg-accent/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{tier.label}</span>
                    {tier.plan === plan && <Sparkles className="size-3 text-accent" />}
                  </div>
                  <p className="mt-2 font-mono text-lg">{limit}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    participants
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
