import { describe, expect, it } from "vitest";
import { allocateRevenue, assertBalancedAllocation } from "@/lib/revenue/allocation";

describe("revenue allocation", () => {
  it("balances gross revenue across the three required buckets", () => {
    const allocation = allocateRevenue(100_000n, 5_000n, {
      infrastructureReserveBps: 3_000n,
    });

    expect(allocation.grossMinor).toBe(100_000n);
    expect(allocation.providerFeeMinor).toBe(5_000n);
    expect(allocation.infrastructureReserveMinor).toBe(28_500n);
    expect(allocation.netRevenueMinor).toBe(66_500n);

    expect(() => assertBalancedAllocation(allocation)).not.toThrow();
  });

  it("rejects provider fees greater than gross revenue", () => {
    expect(() =>
      allocateRevenue(1_000n, 1_001n, {
        infrastructureReserveBps: 3_000n,
      }),
    ).toThrow("provider fee");
  });

  it("rejects an invalid reserve percentage", () => {
    expect(() =>
      allocateRevenue(1_000n, 0n, {
        infrastructureReserveBps: 10_001n,
      }),
    ).toThrow("infrastructure reserve");
  });
});
