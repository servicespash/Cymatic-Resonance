const recentConsoleLogs: string[] = [];

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

export async function sendSilentPandaPing(context: ErrorReportContext): Promise<boolean> {
  try {
    console.info(
      "[Panda Reporter] Compiling and dispatching silent report to Isabirye Latif:",
      context,
    );
    await new Promise((r) => setTimeout(r, 1200));

    const traceStr = context.consoleTrace.slice(-6).join("\n");
    const message = encodeURIComponent(
      `[Cymatic Resonance Panda Alert]\nDeveloper: ${context.developer}\nWhatsApp: ${context.whatsapp}\nEmail: ${context.email}\nIssue: ${context.issue}\nURL: ${context.url}\nTime: ${context.timestamp}\n\nRecent Trace:\n${traceStr}`,
    );

    const whatsappUrl = `https://api.whatsapp.com/send?phone=256768715065&text=${message}`;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = whatsappUrl;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        // ignore
      }
    }, 6000);

    return true;
  } catch (err) {
    console.error("[Panda Reporter] Failed to dispatch silent report:", err);
    return false;
  }
}
