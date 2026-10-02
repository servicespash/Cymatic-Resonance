import { Check, Building2, Crown, Zap } from "lucide-react";
import { ENTITLEMENT_TIERS, PLAN_LABELS } from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

const icons = { FREE: Check, SILVER: Zap, GOLD: Crown, CUSTOM_INSTITUTION: Building2 };

export function EntitlementPlanSelector({
  value,
  onChange,
}: {
  value: EntitlementPlan;
  onChange: (value: EntitlementPlan) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Requested plan
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ENTITLEMENT_TIERS.map((tier) => {
          const Icon = icons[tier.plan];
          const selected = value === tier.plan;
          return (
            <label
              key={tier.plan}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                selected
                  ? "border-accent/50 bg-accent/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <input
                type="radio"
                name="requested_plan"
                value={tier.plan}
                checked={selected}
                onChange={() => onChange(tier.plan)}
                className="sr-only"
              />
              <span className="flex items-start gap-3">
                <Icon
                  className={`mt-0.5 size-4 ${selected ? "text-accent" : "text-muted-foreground"}`}
                />
                <span>
                  <span className="block text-sm font-semibold">{PLAN_LABELS[tier.plan]}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {tier.description}
                  </span>
                  <span className="mt-2 block font-mono text-xs text-accent">
                    {tier.priceLabel}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Paid plan requests do not activate access automatically. Trial activation is a separate
        one-time flow.
      </p>
    </fieldset>
  );
}
