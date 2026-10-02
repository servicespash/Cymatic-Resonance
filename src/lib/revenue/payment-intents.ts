import { createClient } from "@supabase/supabase-js";
import { ENTITLEMENT_FEATURES, type EntitlementFeature } from "@/lib/entitlements/catalog";
import type { PaymentRequest, PaymentInitiation } from "./contracts";
import { createPaymentGateway } from "./provider";

function adminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Server-side Supabase credentials are not configured");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createPaymentIntent(request: PaymentRequest): Promise<PaymentInitiation> {
  const definition = ENTITLEMENT_FEATURES.find((feature) => feature.key === request.featureKey);

  if (!definition) {
    throw new Error("Unknown entitlement feature");
  }

  if (definition.availability !== "revenue_required") {
    throw new Error("This feature is not currently billable");
  }

  const supabase = adminClient();

  const { error: insertError } = await supabase.from("payment_intents").insert({
    organization_id: request.tenantId,
    provider: "FLUTTERWAVE",
    transaction_reference: request.txRef,
    feature_key: request.featureKey,
    target_plan: request.targetPlan,
    currency: request.currency,
    amount_minor: Number(request.amountMinor),
    status: "PENDING",
  });

  if (insertError) throw insertError;

  try {
    const result = await createPaymentGateway().initiatePayment(request);

    await supabase
      .from("payment_intents")
      .update({
        provider: result.provider,
        status: result.status,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", request.tenantId)
      .eq("transaction_reference", request.txRef);

    return result;
  } catch (error) {
    await supabase
      .from("payment_intents")
      .update({
        status: "FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", request.tenantId)
      .eq("transaction_reference", request.txRef);

    throw error;
  }
}

export function isRevenueGatedFeature(featureKey: EntitlementFeature): boolean {
  return (
    ENTITLEMENT_FEATURES.find((feature) => feature.key === featureKey)?.availability ===
    "revenue_required"
  );
}
