import { describe, expect, it } from "vitest";
import { trialStateFromServer } from "./trial";

describe("trial state", () => {
  it("activates a trial using server timestamps", () => {
    const state = trialStateFromServer(
      "FREE",
      "GOLD",
      true,
      "2026-10-01T00:00:00.000Z",
      "2026-10-08T00:00:00.000Z",
      "2026-10-04T00:00:00.000Z",
    );

    expect(state.active).toBe(true);
    expect(state.plan).toBe("GOLD");
    expect(state.daysRemaining).toBe(4);
  });

  it("downgrades expired trials to the base plan", () => {
    const state = trialStateFromServer(
      "FREE",
      "SILVER",
      true,
      "2026-09-25T00:00:00.000Z",
      "2026-09-28T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    );

    expect(state.active).toBe(false);
    expect(state.plan).toBe("FREE");
    expect(state.hasUsedTrial).toBe(true);
    expect(state.daysRemaining).toBe(0);
  });

  it("rejects invalid trial durations", async () => {
    const { normalizeTrialDays } = await import("./trial");

    expect(() => normalizeTrialDays(0)).toThrow();
    expect(() => normalizeTrialDays(31)).toThrow();
    expect(() => normalizeTrialDays(7)).not.toThrow();
  });
});
