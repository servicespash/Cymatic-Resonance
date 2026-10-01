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
  const [selectedPlan, setSelectedPlan] = useState<"SILVER" | "GOLD">("SILVER");
  const [duration, setDuration] = useState(7);
  const [busy, setBusy] = useState(false);

  if (hasUsedTrial) {
    return (
      <section className="glass w-full rounded-2xl border border-white/10 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <h3 className="font-display text-lg font-semibold">
              {trialPlan && activePlan === trialPlan ? `${trialPlan} trial active` : "Trial already used"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {trialPlan && activePlan === trialPlan
                ? \`\${daysRemaining} day\${daysRemaining === 1 ? "" : "s"} remaining.\`
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
      await startTrial(selectedPlan, duration);
      toast.success(\`\${selectedPlan} trial started\`);
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
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">One-time trial</p>
          <h3 className="mt-1 font-display text-lg font-semibold">Test Silver or Gold before subscribing</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The trial is redeemed once per institution. Expiry is determined by server time and automatically returns authorization to Free.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="space-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Trial tier</span>
          <select
            value={selectedPlan}
            onChange={(event) => setSelectedPlan(event.target.value as "SILVER" | "GOLD")}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none"
          >
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Duration</span>
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none"
          >
            <option value={2}>2 days</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
          </select>
        </label>

        <Button type="button" disabled={busy} onClick={submit} className="min-h-10">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Start trial
        </Button>
      </div>
    </section>
  );
}
