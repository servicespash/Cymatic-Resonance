import { supabase } from "@/integrations/supabase/client";

const recentConsoleLogs: string[] = [];
const QUEUE_KEY = "cym.panda.queue.v1";

if (typeof window !== "undefined") {
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args: unknown[]) => {
    recentConsoleLogs.push(
      `[ERROR] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`,
    );
    if (recentConsoleLogs.length > 25) recentConsoleLogs.shift();
    origError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    recentConsoleLogs.push(
      `[WARN] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`,
    );
    if (recentConsoleLogs.length > 25) recentConsoleLogs.shift();
    origWarn.apply(console, args);
  };
}

export interface ErrorReportContext {
  app: string;
  developer: string;
  whatsapp: string;
  email: string;
  issue: string;
  timestamp: string;
  url: string;
  userAgent: string;
  consoleTrace: string[];
}

export interface PandaPingResult {
  delivered: boolean;
  queued: boolean;
  detail: string;
}

export function compileErrorReport(issue: string): ErrorReportContext {
  return {
    app: "Cymatic Resonance",
    developer: "Isabirye Latif",
    whatsapp: "+256768715065",
    email: "cymatichubevolution@gmail.com",
    issue,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    consoleTrace: [...recentConsoleLogs],
  };
}

function readQueue(): ErrorReportContext[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(items: ErrorReportContext[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-20)));
  } catch {
    // storage full / unavailable
  }
}

function enqueue(context: ErrorReportContext) {
  writeQueue([...readQueue(), context]);
}

async function dispatch(context: ErrorReportContext): Promise<{ delivered: boolean; detail: string }> {
  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/panda-ping`;
  const { data, error } = await supabase.functions.invoke<{
    delivered?: boolean;
    delivery?: Record<string, string>;
  }>("panda-ping", { body: context });

  if (!error && data) {
    return {
      delivered: Boolean(data.delivered),
      detail: data.delivery ? Object.entries(data.delivery).map(([k, v]) => `${k}: ${v}`).join(" · ") : "stored",
    };
  }

  // Direct fallback in case the client wrapper is unavailable (missing env vars).
  if (functionsUrl.startsWith("http")) {
    const res = await fetch(functionsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
    });
    if (res.ok) {
      const body = await res.json();
      return { delivered: Boolean(body.delivered), detail: "stored" };
    }
  }

  throw error ?? new Error("Panda Ping transport unavailable");
}

/** Flush any reports captured while the device was offline. */
export async function flushPandaQueue(): Promise<number> {
  const queued = readQueue();
  if (!queued.length) return 0;
  const remaining: ErrorReportContext[] = [];
  let sent = 0;
  for (const item of queued) {
    try {
      await dispatch(item);
      sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return sent;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushPandaQueue();
  });
}

export async function sendSilentPandaPing(context: ErrorReportContext): Promise<PandaPingResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    enqueue(context);
    return { delivered: false, queued: true, detail: "Saved offline — will send when back online." };
  }

  try {
    const result = await dispatch(context);
    return { ...result, queued: false };
  } catch (err) {
    console.info("[Panda Reporter] Dispatch failed, queued for retry:", err);
    enqueue(context);
    return { delivered: false, queued: true, detail: "Saved — will retry automatically." };
  }
}
