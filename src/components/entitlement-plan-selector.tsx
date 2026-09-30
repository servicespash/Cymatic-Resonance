import { Check, Building2, Zap } from "lucide-react";
import { PLAN_LABELS } from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

const options: Array<{
  plan: EntitlementPlan;
  description: string;
  icon: typeof Zap;
}> = [
  {
    plan: "FREE",
    description: "Core attendance and communication for small teams.",
    icon: Check,
  },
  {
    plan: "PAID",
    description: "Expanded capacity, command features, calls, exports, and analytics.",
    icon: Zap,
  },
  {
    plan: "CUSTOM_INSTITUTION",
    description: "Institution-specific policies, entitlements, and enterprise controls.",
    icon: Building2,
  },
];

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
      <div className="grid gap-2">
        {options.map(({ plan, description, icon: Icon }) => {
          const selected = value === plan;
          return (
            <label
              key={plan}
              className={`cursor-pointer rounded-xl border p-3 transition ${
                selected
                  ? "border-accent/50 bg-accent/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <input
                type="radio"
                name="requested_plan"
                value={plan}
                checked={selected}
                onChange={() => onChange(plan)}
                className="sr-only"
              />
              <span className="flex items-start gap-3">
                <Icon className={`mt-0.5 size-4 ${selected ? "text-accent" : "text-muted-foreground"}`} />
                <span>
                  <span className="block text-sm font-semibold">{PLAN_LABELS[plan]}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Paid and Custom selections create a review request. They do not activate access automatically.
      </p>
    </fieldset>
  );
}
