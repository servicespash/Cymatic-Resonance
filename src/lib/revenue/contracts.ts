import type { EntitlementPlan } from "@/lib/domain/contracts";
import type { EntitlementFeature } from "@/lib/entitlements/catalog";

export const PAYMENT_PROVIDERS = ["FLUTTERWAVE", "MTN_UGANDA", "AIRTEL_UGANDA", "PESAPAL"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHODS = ["CARD", "MOBILE_MONEY", "BANK_TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type Currency = "UGX" | "KES" | "TZS" | "RWF" | "USD" | "EUR" | "GBP";

export interface PaymentRequest {
  tenantId: string;
  amountMinor: bigint;
  currency: Currency;
  customerEmail: string;
  customerPhone?: string;
  method: PaymentMethod;
  featureKey: EntitlementFeature;
  targetPlan: Exclude<EntitlementPlan, "FREE">;
  txRef: string;
  returnUrl: string;
}

export interface PaymentInitiation {
  provider: PaymentProvider;
  providerReference: string;
  checkoutUrl?: string;
  status: Extract<PaymentStatus, "PENDING" | "PROCESSING">;
}

export interface VerifiedPayment {
  provider: PaymentProvider;
  providerReference: string;
  transactionReference: string;
  amountMinor: bigint;
  currency: Currency;
  status: "SUCCEEDED";
  providerFeeMinor: bigint;
}

export interface RevenueAllocation {
  grossMinor: bigint;
  providerFeeMinor: bigint;
  infrastructureReserveMinor: bigint;
  netRevenueMinor: bigint;
}
