import { Check, LockKeyhole } from "lucide-react";
import { ENTITLEMENT_FEATURES, PLAN_LABELS, planIncludes } from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

function CapabilityCell({
  enabled,
  availability,
}: {
  enabled: boolean;
  availability: "available" | "planned";
}) {
  if (!enabled) {
    return <LockKeyhole className="mx-auto size-4 text-muted-foreground/40" aria-label="Not included" />;
  }
  if (availability === "planned") {
    return (
      <span className="mx-auto block w-fit rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        Planned
      </span>
    );
  }
  return <Check className="mx-auto size-4 text-accent" aria-label="Included" />;
}

export function EntitlementMatrix({ currentPlan }: { currentPlan?: EntitlementPlan }) {
  const plans: EntitlementPlan[] = ["FREE", "PAID", "CUSTOM_INSTITUTION"];

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <div className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Capability matrix</p>
        <h3 className="mt-1 font-display text-xl font-semibold">What each plan includes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Capability access is enforced by the server. The table documents the entitlement contract.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-white/5">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left font-medium">Capability</th>
              {plans.map((plan) => (
                <th key={plan} className="px-4 py-3 text-center font-medium">
                  <span className={currentPlan === plan ? "text-accent" : ""}>{PLAN_LABELS[plan]}</span>
                  {currentPlan === plan && (
                    <span className="ml-1 font-mono text-[9px] uppercase tracking-wider text-accent">
                      Current
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ENTITLEMENT_FEATURES.map((feature) => (
              <tr key={feature.key} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{feature.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{feature.description}</div>
                </td>
                {plans.map((plan) => (
                  <td key={plan} className="px-4 py-3 text-center">
                    <CapabilityCell
                      enabled={planIncludes(plan, feature)}
                      availability={feature.availability}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
