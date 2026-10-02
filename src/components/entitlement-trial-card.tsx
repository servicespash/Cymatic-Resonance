import { useState } from "react";
import { Clock3, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { EntitlementPlan } from "@/lib/domain/contracts";

export function EntitlementTrialCard({
  hasUsedTrial,
  activePlan,
  trialPlan,
  daysRemaining,
  isAdmin,
  startTrial,
}: {
  hasUsedTrial: boolean;
  activePlan: EntitlementPlan;
  trialPlan: EntitlementPlan | null;
  daysRemaining: number;
  isAdmin: boolean;
  startTrial: (plan: "SILVER" | "GOLD", durationDays: number) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);

  if (hasUsedTrial) {
    return (
      <section className="glass w-full rounded-2xl border border-white/10 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <h3 className="font-display text-lg font-semibold">
              {trialPlan && activePlan === trialPlan
                ? `${trialPlan} trial active`
                : "Trial already used"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {trialPlan && activePlan === trialPlan
                ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining.`
                : "The one-time institutional trial cannot be redeemed again."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!isAdmin || activePlan !== "FREE") return null;

  const submit = async () => {
    setBusy(true);
    try {
      await startTrial("GOLD", 7);
      toast.success("7-day Gold trial started successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start trial");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass w-full rounded-2xl border border-accent/20 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 text-accent" />
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            One-time trial offer
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold">
            7-Day Gold Institutional Trial
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Redeem your one-time 7-day Gold trial to unlock full institutional execution
            capabilities. Automatically reverts to Free upon expiry.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          Duration: Exactly 7 days (Gold Tier)
        </span>
        <Button type="button" disabled={busy} onClick={submit} className="min-h-10">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Start 7-day Gold trial
        </Button>
      </div>
    </section>
  );
}
