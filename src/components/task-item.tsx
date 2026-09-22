import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Status = "assigned" | "open" | "in_progress" | "completed";

interface TaskItemProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: Status;
  };
}

const steps: { id: Status; label: string }[] = [
  { id: "assigned", label: "Assigned" },
  { id: "open", label: "Opened" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Done" },
];

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const [status, setStatus] = useState<Status>(task.status);
  const [isAnimating, setIsAnimating] = useState(false);

  const updateStatus = async (newStatus: Status) => {
    setStatus(newStatus);
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
  };

  const handleComplete = () => {
    setIsAnimating(true);
    updateStatus("completed");
    setTimeout(() => setIsAnimating(false), 2000);
  };

  return (
    <div className="p-4 bg-card border border-border rounded-lg shadow-sm space-y-4">
      <h3 className="font-semibold text-lg">{task.title}</h3>
      <p className="text-sm text-muted-foreground">{task.description}</p>

      <div className="space-y-2">
        {steps.map((step, index) => {
          const isCompleted = steps.findIndex((s) => s.id === status) >= index;
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={cn(
                  "size-5 rounded-full border flex items-center justify-center transition-colors",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {isCompleted && <Check className="size-3" />}
              </div>
              <span
                className={cn("text-sm", isCompleted ? "text-foreground" : "text-muted-foreground")}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isAnimating && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="text-primary font-bold text-center"
          >
            Task Completed! 🎉
          </motion.div>
        )}
      </AnimatePresence>

      <Button onClick={handleComplete} disabled={status === "completed"} className="w-full gap-2">
        <Send className="size-4" /> Submit Task
      </Button>
    </div>
  );
};
