import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass mx-auto flex max-w-md flex-col items-center rounded-2xl px-6 py-12 text-center"
    >
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-pulse-ring rounded-full bg-accent/20 blur-2xl" />
        <div className="grid size-14 place-items-center rounded-2xl bg-frequency/15 ring-1 ring-white/10">
          <Icon className="size-6 text-accent" />
        </div>
      </div>
      <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </motion.div>
  );
}
