import { QueryClient } from "@tanstack/react-query";
import { readCache, writeCache } from "./offline-cache";

const PERSIST_KEY = "react-query";
const PERSIST_PREFIXES = ["messages", "tasks", "call-history"];

type PersistedEntry = { key: unknown[]; data: unknown; at: number };

const MAX_AGE = 1000 * 60 * 60 * 24 * 7; // keep a week of history offline

function shouldPersist(key: unknown[]) {
  return typeof key[0] === "string" && PERSIST_PREFIXES.includes(key[0] as string);
}

/**
 * QueryClient whose chat/task data is mirrored to localStorage, so content is
 * available instantly after a reload and survives temporary disconnections.
 */
export function createAppQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 60 * 24,
        retry: 2,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        networkMode: "offlineFirst",
      },
      mutations: {
        networkMode: "offlineFirst",
        retry: 2,
      },
    },
  });

  if (typeof window === "undefined") return queryClient;

  // Hydrate from the last snapshot.
  const saved = readCache<PersistedEntry[]>(PERSIST_KEY) ?? [];
  const now = Date.now();
  for (const entry of saved) {
    if (now - entry.at > MAX_AGE) continue;
    queryClient.setQueryData(entry.key, entry.data);
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const entries: PersistedEntry[] = [];
      for (const q of queryClient.getQueryCache().getAll()) {
        if (q.state.data === undefined) continue;
        if (!shouldPersist(q.queryKey as unknown[])) continue;
        entries.push({ key: q.queryKey as unknown[], data: q.state.data, at: Date.now() });
      }
      writeCache(PERSIST_KEY, entries);
    }, 800);
  };

  queryClient.getQueryCache().subscribe(persist);

  return queryClient;
}
