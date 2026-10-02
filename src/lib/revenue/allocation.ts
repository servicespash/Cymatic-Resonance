import type { RevenueAllocation } from "./contracts";

const BASIS_POINTS = 10_000n;

export interface RevenuePolicy {
  infrastructureReserveBps: bigint;
}

export function allocateRevenue(
  grossMinor: bigint,
  providerFeeMinor: bigint,
  policy: RevenuePolicy,
): RevenueAllocation {
  if (grossMinor <= 0n) throw new Error("gross amount must be positive");
  if (providerFeeMinor < 0n || providerFeeMinor > grossMinor) {
    throw new Error("provider fee must be between zero and gross amount");
  }
  if (policy.infrastructureReserveBps < 0n || policy.infrastructureReserveBps > BASIS_POINTS) {
    throw new Error("infrastructure reserve must be 0..10000 basis points");
  }

  const afterProviderFee = grossMinor - providerFeeMinor;
  const infrastructureReserveMinor =
    (afterProviderFee * policy.infrastructureReserveBps) / BASIS_POINTS;
  const netRevenueMinor = afterProviderFee - infrastructureReserveMinor;

  return {
    grossMinor,
    providerFeeMinor,
    infrastructureReserveMinor,
    netRevenueMinor,
  };
}

export function assertBalancedAllocation(allocation: RevenueAllocation): void {
  if (
    allocation.providerFeeMinor +
      allocation.infrastructureReserveMinor +
      allocation.netRevenueMinor !==
    allocation.grossMinor
  ) {
    throw new Error("revenue allocation does not balance");
  }
}
