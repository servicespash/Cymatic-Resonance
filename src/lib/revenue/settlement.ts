import { createClient } from "@supabase/supabase-js";
import { allocateRevenue, assertBalancedAllocation } from "./allocation";
import type { VerifiedPayment } from "./contracts";

interface PendingPayment {
  organization_id: string;
  feature_key: string;
  target_plan: "PAID" | "CUSTOM_INSTITUTION";
  currency: string;
  amount_minor: number;
}

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

export async function settleVerifiedPayment(payment: VerifiedPayment): Promise<void> {
  const supabase = adminClient();

  const { data: pending, error: pendingError } = await supabase
    .from("payment_intents")
    .select("organization_id, feature_key, target_plan, currency, amount_minor")
    .eq("provider", payment.provider)
    .eq("transaction_reference", payment.transactionReference)
    .maybeSingle();

  if (pendingError) throw pendingError;
  if (!pending) throw new Error("Unknown payment transaction reference");

  const intent = pending as PendingPayment;

  if (intent.currency !== payment.currency || BigInt(intent.amount_minor) !== payment.amountMinor) {
    throw new Error("Verified payment does not match payment intent");
  }

  const policyBps = BigInt(process.env.INFRASTRUCTURE_RESERVE_BPS ?? "3000");

  const allocation = allocateRevenue(payment.amountMinor, payment.providerFeeMinor, {
    infrastructureReserveBps: policyBps,
  });

  assertBalancedAllocation(allocation);

  const { error } = await supabase.rpc("settle_verified_payment", {
    p_organization_id: intent.organization_id,
    p_provider: payment.provider,
    p_provider_reference: payment.providerReference,
    p_transaction_reference: payment.transactionReference,
    p_currency: payment.currency,
    p_gross_amount_minor: Number(allocation.grossMinor),
    p_provider_fee_minor: Number(allocation.providerFeeMinor),
    p_infrastructure_reserve_minor: Number(allocation.infrastructureReserveMinor),
    p_net_revenue_minor: Number(allocation.netRevenueMinor),
    p_target_plan: intent.target_plan,
    p_feature_key: intent.feature_key,
  });

  if (error) throw error;
}
