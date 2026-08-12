import { useState } from "react";
import { getMissingSupabaseEnv } from "@/lib/config-utils";

/**
 * Startup guard: renders a clear, friendly error instead of letting the
 * Supabase client throw deep inside the tree when config is missing.
 */
export function ConfigCheck({ children }: { children: React.ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const missing = getMissingSupabaseEnv();

  if (missing.length === 0) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center px-4" data-attempt={attempt}>
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Backend not configured</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cymatic Resonance can&apos;t reach its backend because required configuration is missing.
        </p>
        <p className="mt-3 font-mono text-xs text-muted-foreground break-words">
          Missing: {missing.join(", ")}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Once these are set in the environment, retry below.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="inline-flex items-center justify-center rounded-md bg-frequency px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm font-medium"
          >
            Reload app
          </button>
        </div>
      </div>
    </div>
  );
}
