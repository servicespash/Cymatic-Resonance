import { useState } from "react";
import { ArrowUpRight, Building2, Check, Crown, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PLAN_LABELS } from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

type RequestablePlan = Exclude<EntitlementPlan, "FREE">;

const iconFor = {
  SILVER: Zap,
  GOLD: Crown,
  CUSTOM_INSTITUTION: Building2,
};

export function EntitlementUpgradeCard({
  organizationId,
  currentPlan,
  isAdmin,
  requestedPlan,
  onRequested,
}: {
  organizationId: string;
  currentPlan: EntitlementPlan;
  isAdmin: boolean;
  requestedPlan?: EntitlementPlan | null;
  onRequested?: () => void;
}) {
  const [busy, setBusy] = useState<RequestablePlan | null>(null);

  if (currentPlan === "CUSTOM_INSTITUTION") {
    return (
      <section className="glass w-full rounded-2xl border border-accent/20 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-5 text-accent" />
          <div>
            <h3 className="font-display text-lg font-semibold">Premium / Custom institution plan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This workspace uses institution-specific capabilities, quotas, and policy configuration.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const request = async (plan: RequestablePlan) => {
    const userResult = await supabase.auth.getUser();
    const userId = userResult.data.user?.id;
    if (!userId) return toast.error("Your session is no longer active.");

    setBusy(plan);
    const { error } = await supabase.from("entitlement_upgrade_requests").insert({
      organization_id: organizationId,
      requested_by: userId,
      requested_plan: plan,
      status: "PENDING",
    });
    setBusy(null);

    if (error) return toast.error(error.message);
    toast.success(\`\${PLAN_LABELS[plan]} request submitted\`);
    onRequested?.();
  };

  if (requestedPlan) {
    return (
      <section className="glass w-full rounded-2xl border border-accent/20 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 size-5 text-accent" />
          <div>
            <h3 className="font-display text-lg font-semibold">Plan request pending</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your workspace requested {PLAN_LABELS[requestedPlan]}. Access changes only after the plan is provisioned.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="glass w-full rounded-2xl border border-white/10 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 size-5 text-accent" />
          <div>
            <h3 className="font-display text-lg font-semibold">Expanded institutional capacity</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask your workspace administrator to request Silver, Gold, or Premium / Custom.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const plans: RequestablePlan[] = ["SILVER", "GOLD", "CUSTOM_INSTITUTION"];

  return (
    <section className="glass w-full rounded-2xl border border-accent/20 p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Plan management</p>
      <h3 className="mt-1 font-display text-lg font-semibold">Current plan: {PLAN_LABELS[currentPlan]}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Requests are recorded for administrator review. Payment activation remains separate from entitlement governance.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {plans.map((plan) => {
          const Icon = iconFor[plan];
          return (
            <Button
              key={plan}
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => request(plan)}
              className="h-auto min-h-16 justify-between border-white/10 bg-white/5 px-4 py-3 text-left"
            >
              <span className="flex items-center gap-3">
                {busy === plan ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                <span>
                  <span className="block text-sm font-semibold">{PLAN_LABELS[plan]}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {plan === "SILVER" ? "~$15" : plan === "GOLD" ? "~$40" : "Custom"}
                  </span>
                </span>
              </span>
              <ArrowUpRight className="size-4" />
            </Button>
          );
        })}
      </div>
    </section>
  );
}
