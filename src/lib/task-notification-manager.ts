import { EventEmitter } from "events";
import { supabase } from "@/integrations/supabase/client";

export const taskEvents = new EventEmitter();

export const initTaskListener = (userId: string) => {
  const channel = supabase
    .channel("tasks-channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "tasks",
        filter: `assigned_to=eq.${userId}`,
      },
      (payload) => {
        taskEvents.emit("new-task", payload.new);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
