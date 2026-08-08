import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/oauth/consent")({
  component: ConsentPage,
});

function ConsentPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      // In a standard Supabase OAuth flow, the URL typically contains a
      // hash fragment with the session data which Supabase automatically
      // parses upon initialization.
      // This page acts as a gatekeeper. If the session is already
      // established by Supabase's auto-handling, we can just redirect.

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.navigate({ to: "/dashboard" });
      } else {
        throw new Error("No session established. Please try logging in again.");
      }
    } catch (err: Error) {
      console.error("Consent error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Grant Access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cymatic Resonance requires permission to access your workspace to continue.
        </p>
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-frequency px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Confirming..." : "Confirm and Proceed"}
        </button>
      </div>
    </div>
  );
}
