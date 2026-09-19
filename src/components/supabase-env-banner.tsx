import React, { useState } from "react";
import { AlertTriangle, Send, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { getMissingSupabaseEnv } from "@/lib/env";
import { compileErrorReport, sendSilentPandaPing } from "@/lib/panda-reporter";
import { toast } from "sonner";

interface ErrorPandaBannerProps {
  runtimeError?: string | null;
}

export function ErrorPandaBanner({ runtimeError }: ErrorPandaBannerProps) {
  const missing = getMissingSupabaseEnv();
  const [pinged, setPinged] = useState(false);
  const [sending, setSending] = useState(false);

  const hasIssue = missing.length > 0 || Boolean(runtimeError);

  const issueDescription =
    missing.length > 0
      ? `Missing Supabase environment variables: ${missing.join(", ")}`
      : runtimeError || "Unexpected runtime exception";

  const [queued, setQueued] = useState(false);
  const [detail, setDetail] = useState<string>("");

  const handlePingAuthor = async () => {
    setSending(true);
    try {
      const context = compileErrorReport(issueDescription);
      const result = await sendSilentPandaPing(context);
      setSending(false);
      setPinged(true);
      setQueued(result.queued);
      setDetail(result.detail);
      if (result.delivered) {
        toast.success("Report delivered to Isabirye Latif.");
      } else if (result.queued) {
        toast.info("No connection — report saved and will send automatically.");
      } else {
        toast.success("Report logged for Isabirye Latif.");
      }
    } catch (err) {
      console.error("Failed to ping author:", err);
      toast.error("Failed to dispatch automated message.");
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {hasIssue && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-lg bg-card border border-destructive/40 rounded-3xl p-6 shadow-2xl space-y-6 text-center"
          >
            {!pinged ? (
              <>
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive animate-pulse">
                  <ShieldAlert className="size-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-foreground">
                    Platform Attention Required
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {missing.length > 0
                      ? `Required Supabase environment variables (${missing.join(", ")}) are missing or unconfigured.`
                      : `An unexpected application error occurred: "${issueDescription}"`}
                  </p>
                </div>

                <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 text-left text-xs font-mono text-destructive space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="size-4 shrink-0" />
                    Error Diagnostic & Console Trace Captured:
                  </div>
                  <p className="text-[11px] opacity-90 break-all">{issueDescription}</p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={handlePingAuthor}
                    disabled={sending}
                    className="w-full bg-destructive text-destructive-foreground font-semibold hover:brightness-110 gap-2 text-xs py-5 rounded-xl shadow-lg relative overflow-hidden"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Compiling Trace & Pinging Latif...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        <span>🐼 Panda Ping (Isabirye Latif)</span>
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Silently reports technical error context and console trace to WhatsApp
                    (+256768715065) & email (cymatichubevolution@gmail.com) without redirecting you.
                  </p>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-5 py-4"
              >
                <div className="text-6xl animate-bounce">🐼</div>
                <div className="space-y-2">
                  <h3 className="font-display font-bold text-lg text-foreground flex items-center justify-center gap-2">
                    <span>Panda On Duty!</span>
                    <CheckCircle2 className="size-5 text-frequency" />
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Report successfully sent! We are so sorry for the hiccup. Our lead developer,{" "}
                    <b>Isabirye Latif</b>, has been silently notified on WhatsApp (+256768715065)
                    and email (cymatichubevolution@gmail.com) with the full error trace. Hang tight,
                    fix awaiting!
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-frequency/15 text-frequency text-xs font-semibold">
                  <CheckCircle2 className="size-4" />
                  <span>Report Dispatched · Fix Awaiting</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const SupabaseEnvBanner = ErrorPandaBanner;
