import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { CommsProvider } from "./comms-context";
import { useComms } from "@/hooks/use-comms";
import React, { ReactNode } from "react";

// Mock Supabase and Auth context
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn() }) }),
      insert: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "test-user-id" },
  })),
}));

describe("CommsProvider Logic", () => {
  it("should provide sendMessage and startDm", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(CommsProvider, null, children);
    const { result } = renderHook(() => useComms(), { wrapper });

    expect(typeof result.current.sendMessage).toBe("function");
    expect(typeof result.current.startDm).toBe("function");
  });
});
