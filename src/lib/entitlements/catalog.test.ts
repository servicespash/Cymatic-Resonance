import { describe, expect, it } from "vitest";
import { tierPrice, PLAN_LABELS, getCallParticipantLimit, tierHighlights } from "./catalog";

describe("tier pricing", () => {
  it("uses the settings prices under Cymatic names", () => {
    expect([tierPrice("FREE"), tierPrice("SILVER"), tierPrice("GOLD")]).toEqual(["$0", "$15/mo", "$40/mo"]);
    expect(PLAN_LABELS.SILVER).toBe("Resonance");
  });
  it("Pulse does not advertise paid features", () => {
    expect(tierHighlights("FREE", 99)).not.toContain("Command Center");
    expect(getCallParticipantLimit("FREE", "VIDEO")).toBe(5);
  });
});
