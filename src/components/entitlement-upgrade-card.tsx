import { useState } from "react";
import { ArrowUpRight, Building2, Check, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PLAN_LABELS } from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

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
  const [busy, setBusy] = useState<EntitlementPlan | null>(null);

  if (currentPlan === "CUSTOM_INSTITUTION") {
    return (
      <section className="glass rounded-2xl border border-accent/20 p-5">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 size-5 text-accent" />
          <div>
            <h3 className="font-display text-lg font-semibold">Custom institution plan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This workspace uses institution-specific capabilities and policy configuration.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const request = async (plan: "PAID" | "CUSTOM_INSTITUTION") => {
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
    toast.success("Upgrade request submitted");
    onRequested?.();
  };

  if (requestedPlan) {
    return (
      <section className="glass rounded-2xl border border-accent/20 p-5">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 size-5 text-accent" />
          <div>
            <h3 className="font-display text-lg font-semibold">Upgrade request pending</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your workspace has a pending request for {PLAN_LABELS[requestedPlan]}. Access changes only
              after an administrator provisions the plan.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-5">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 size-5 text-accent" />
          <div>
            <h3 className="font-display text-lg font-semibold">More capacity is available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask your workspace administrator to upgrade from {PLAN_LABELS[currentPlan]}.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl border border-accent/20 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Plan management</p>
      <h3 className="mt-1 font-display text-lg font-semibold">Current plan: {PLAN_LABELS[currentPlan]}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Requests are recorded for administrator review. They do not change access by themselves.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          onClick={() => request("PAID")}
          className="justify-between border-white/10 bg-white/5"
        >
          {busy === "PAID" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Request Paid
          <ArrowUpRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          onClick={() => request("CUSTOM_INSTITUTION")}
          className="justify-between border-white/10 bg-white/5"
        >
          {busy === "CUSTOM_INSTITUTION" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Building2 className="size-4" />
          )}
          Request Custom
          <ArrowUpRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
