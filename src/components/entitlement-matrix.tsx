import { useState } from "react";
import { Check, LockKeyhole, Sparkles } from "lucide-react";
import { ENTITLEMENT_FEATURES, ENTITLEMENT_TIERS, planIncludes } from "@/lib/entitlements/catalog";
import type { EntitlementPlan } from "@/lib/domain/contracts";

function CapabilityCell({
  enabled,
  availability,
}: {
  enabled: boolean;
  availability: "available" | "coming_soon" | "revenue_required";
}) {
  if (availability === "coming_soon") {
    return (
      <span className="mx-auto block w-fit rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        Coming soon
      </span>
    );
  }

  if (!enabled) {
    return (
      <LockKeyhole className="mx-auto size-4 text-muted-foreground/40" aria-label="Not included" />
    );
  }

  return <Check className="mx-auto size-4 text-accent" aria-label="Included" />;
}

export function EntitlementMatrix({ currentPlan }: { currentPlan?: EntitlementPlan }) {
  return (
    <section className="glass w-full min-w-0 rounded-2xl p-5 sm:p-6">
      <div className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          Capability matrix
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold">Institutional execution tiers</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The active tier determines available capabilities and operating limits. Free communication
          remains usable; paid tiers add capacity and institutional execution controls.
        </p>
      </div>

      <MobileMatrix currentPlan={currentPlan} />
      <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
        <table className="w-full min-w-[760px] table-fixed text-sm">
          <thead className="bg-white/5">
            <tr className="border-b border-white/10">
              <th className="w-[34%] px-5 py-4 text-left font-medium">Capability</th>
              {ENTITLEMENT_TIERS.map((tier) => (
                <th key={tier.plan} className="w-[16.5%] px-5 py-4 text-center font-medium">
                  <div className={currentPlan === tier.plan ? "text-accent" : ""}>{tier.label}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {tier.priceLabel}
                  </div>
                  {currentPlan === tier.plan && (
                    <div className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-accent">
                      <Sparkles className="size-3" /> Current
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ENTITLEMENT_FEATURES.map((feature) => (
              <tr key={feature.key} className="border-b border-white/5 last:border-0">
                <td className="px-5 py-4 align-top">
                  <div className="font-medium">{feature.label}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {feature.description}
                  </div>
                </td>
                {ENTITLEMENT_TIERS.map((tier) => (
                  <td key={tier.plan} className="px-5 py-4 text-center align-middle">
                    <CapabilityCell
                      enabled={planIncludes(tier.plan, feature)}
                      availability={feature.availability}
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-white/[0.025]">
              <td className="px-5 py-4 font-medium">Audio/video participants</td>
              <td className="px-5 py-4 text-center">5</td>
              <td className="px-5 py-4 text-center">15</td>
              <td className="px-5 py-4 text-center">30</td>
              <td className="px-5 py-4 text-center">Custom</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MobileMatrix({ currentPlan }: { currentPlan?: EntitlementPlan }) {
  const [plan, setPlan] = useState<EntitlementPlan>(currentPlan ?? "FREE");
  const tier = ENTITLEMENT_TIERS.find((t) => t.plan === plan)!;
  return (
    <div className="md:hidden">
      <div className="grid grid-cols-2 gap-1.5" role="tablist">
        {ENTITLEMENT_TIERS.map((t) => (
          <button
            key={t.plan}
            role="tab"
            aria-selected={plan === t.plan}
            onClick={() => setPlan(t.plan)}
            className={`rounded-lg border px-2 py-2 text-left text-xs ${
              plan === t.plan ? "border-accent/50 bg-accent/10" : "border-white/10 bg-white/5"
            }`}
          >
            <span className="block font-semibold">{t.label}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{t.priceLabel}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{tier.description}</p>
      <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
        {ENTITLEMENT_FEATURES.map((f) => {
          const on = planIncludes(plan, f);
          return (
            <li key={f.key} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className={`text-sm ${on ? "" : "text-muted-foreground"}`}>{f.label}</div>
                <div className="text-[11px] leading-4 text-muted-foreground">{f.description}</div>
              </div>
              <div className="shrink-0 pt-0.5">
                <CapabilityCell enabled={on} availability={f.availability} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
