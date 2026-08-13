import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";

type Task = {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
};

export function TasksPanel({
  orgId,
  userId,
  members,
}: {
  orgId: string;
  userId: string;
  isAdmin: boolean;
  members: { id: string; full_name: string | null }[];
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");

  const fetchTasks = useCallback(async () => {
    const { data } = await (supabase as any).from("tasks").select("*").eq("org_id", orgId);
    if (data) setTasks(data);
  }, [orgId]);

  useEffect(() => {
    fetchTasks();
  }, [orgId, fetchTasks]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    const { error } = await (supabase as any).from("tasks").insert({
      org_id: orgId,
      title: newTask,
    });
    if (error) toast.error("Failed to add task");
    else {
      setNewTask("");
      fetchTasks();
    }
  };

  const toggleTask = async (id: string, status: string) => {
    const newStatus = status === "pending" ? "completed" : "pending";
    await (supabase as any).from("tasks").update({ status: newStatus }).eq("id", id);
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await (supabase as any).from("tasks").delete().eq("id", id);
    fetchTasks();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="New task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
        />
        <Button onClick={addTask}>
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
          >
            <span
              className={task.status === "completed" ? "line-through text-muted-foreground" : ""}
            >
              {task.title}
            </span>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" onClick={() => toggleTask(task.id, task.status)}>
                <Check className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteTask(task.id)}>
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
