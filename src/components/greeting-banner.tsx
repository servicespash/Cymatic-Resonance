import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pin, Briefcase } from "lucide-react";

interface GreetingBannerProps {
  name: string;
  institution: string;
  status: string;
  tasksCount: number;
  onDismiss: () => void;
}

export function GreetingBanner({
  name,
  institution,
  status,
  tasksCount,
  onDismiss,
}: GreetingBannerProps) {
  const [pinned, setPinned] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (pinned) return;
    if (timeLeft <= 0) {
      onDismiss();
      return;
    }
    const t = setInterval(() => setTimeLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, pinned, onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-4 right-4 z-50 w-full max-w-sm glass-strong rounded-2xl p-5 border border-accent/20 shadow-2xl resonance-glow overflow-hidden"
      >
        <div className="flex justify-between items-start mb-2 relative z-10">
          <div>
            <h3 className="font-display text-lg font-bold">Welcome, {name}</h3>
            <p className="text-xs text-muted-foreground">{institution}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPinned(true)}
              className={`p-1.5 rounded-lg transition-colors ${pinned ? "bg-accent/20 text-accent" : "hover:bg-white/10 text-muted-foreground"}`}
              title="Pin to Workspace"
            >
              <Pin className="size-4" />
            </button>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 relative z-10">
          <span
            className={`px-2 py-1 rounded text-[10px] uppercase font-mono tracking-widest border ${
              status === "verified"
                ? "border-green-400/30 text-green-400 bg-green-500/10"
                : status === "external"
                  ? "border-amber-400/30 text-amber-400 bg-amber-500/10"
                  : "border-red-400/30 text-red-400 bg-red-500/10"
            }`}
          >
            Location: {status}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date().toLocaleTimeString()}
          </span>
        </div>

        {tasksCount > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-3 relative z-10">
            <Briefcase className="size-4 text-accent" />
            <span className="text-sm font-medium">You have {tasksCount} pending tasks today</span>
          </div>
        )}

        {!pinned && (
          <div className="absolute bottom-0 left-0 h-1 bg-accent/20 w-full">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 10, ease: "linear" }}
              className="h-full bg-accent"
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
