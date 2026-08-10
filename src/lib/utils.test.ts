import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("merges class names correctly", () => {
    expect(cn("class1", "class2")).toBe("class1 class2");
  });

  it("merges tailwind classes correctly (overwrites conflicts)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it('handles conditional classes', () => {
    expect(cn('base', 'active')).toBe('base active');
  });

  it("handles undefined/null inputs", () => {
    expect(cn("base", null, undefined)).toBe("base");
  });
});
