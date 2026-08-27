import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createAppQueryClient } from "./lib/query-client";

export const getRouter = () => {
  const queryClient = createAppQueryClient();


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] text-primary font-mono text-xs">
        Connecting to Resonance Node...
      </div>
    ),
    defaultErrorComponent: ({ error }: { error: Error }) => (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] p-6 text-red-400 font-mono text-xs">
        <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">
          Routing Exception
        </h2>
        <pre className="mt-3 max-w-lg overflow-x-auto rounded border border-red-900/40 bg-red-950/20 p-4">
          {error.message}
        </pre>
      </div>
    ),
  });

  return router;
};
