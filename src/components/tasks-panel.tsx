import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Calendar, User as UserIcon, Tag, ArrowRight, ArrowLeft } from "lucide-react";

type Task = {
  id: string;
  title: string;
  task_kind: string | null;
  status: "open" | "in_progress" | "completed";
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
};

export function TasksPanel({
  orgId,
  userId,
  isAdmin,
  members,
}: {
  orgId: string;
  userId: string;
  isAdmin: boolean;
  members: { id: string; full_name: string | null }[];
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [taskKind, setTaskKind] = useState("General");
  const [assignedTo, setAssignedTo] = useState<string>(userId);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from("tasks").select("*").eq("org_id", orgId);
    if (!isAdmin) {
      query = query.eq("assigned_to", userId);
    }
    const { data } = await query;
    if (data) setTasks(data as Task[]);
  }, [orgId, userId, isAdmin]);

  useEffect(() => {
    fetchTasks();
    const ch = supabase
      .channel("tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (p) => {
        if (p.eventType === "INSERT") {
          const newTask = p.new as Task;
          if (newTask.assigned_to === userId) {
            toast.info(`New task assigned: ${newTask.title}`);
          }
        } else if (p.eventType === "UPDATE") {
          const updatedTask = p.new as Task;
          if (updatedTask.assigned_to === userId) {
            toast.info(`Task status updated: ${updatedTask.title} is now ${updatedTask.status}`);
          }
        }
        fetchTasks();
      })
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [orgId, fetchTasks, userId]);

  const addTask = async () => {
    if (!title.trim()) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("tasks").insert({
      org_id: orgId,
      title: title.trim(),
      task_kind: taskKind,
      assigned_to: assignedTo || null,
      start_date: startDate || null,
      due_date: dueDate || null,
      status: "open",
    });
    if (error) {
      toast.error("Failed to create task: " + error.message);
    } else {
      setTitle("");
      setTaskKind("General");
      setStartDate("");
      setDueDate("");
      setCreating(false);
      fetchTasks();
      toast.success("Task assigned successfully");
    }
  };

  const updateStatus = async (id: string, newStatus: "open" | "in_progress" | "completed") => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("tasks").update({ status: newStatus }).eq("id", id);
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("tasks").delete().eq("id", id);
    fetchTasks();
    toast.success("Task deleted");
  };

  const columns: { key: "open" | "in_progress" | "completed"; label: string; color: string }[] = [
    { key: "open", label: "Open", color: "border-blue-500/30 text-blue-400 bg-blue-500/5" },
    {
      key: "in_progress",
      label: "In Process",
      color: "border-amber-500/30 text-amber-400 bg-amber-500/5",
    },
    {
      key: "completed",
      label: "Done",
      color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5",
    },
  ];

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Assign New Task</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreating(!creating)}
              className="bg-white/5 border-white/10"
            >
              <Plus className="size-3.5 mr-1" /> {creating ? "Cancel" : "New Task"}
            </Button>
          </div>
          {creating && (
            <div className="space-y-3 pt-2">
              <Input
                placeholder="Task title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white/5 border-white/10"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={taskKind}
                  onChange={(e) => setTaskKind(e.target.value)}
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-xs"
                >
                  <option value="General">General</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Design">Design</option>
                  <option value="Operations">Operations</option>
                  <option value="Review">Review</option>
                </select>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-xs"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name ?? "Member"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white/5 border-white/10 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-white/5 border-white/10 text-xs"
                  />
                </div>
              </div>
              <Button onClick={addTask} className="w-full bg-frequency text-primary-foreground">
                Assign Task
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-3 min-h-[350px]"
            >
              <div
                className={`flex items-center justify-between px-3 py-2 rounded-xl border mb-3 ${col.color}`}
              >
                <span className="font-mono text-xs uppercase font-bold tracking-wider">
                  {col.label}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-white/10">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {colTasks.map((task) => {
                  const assignee = members.find((m) => m.id === task.assigned_to);
                  return (
                    <div
                      key={task.id}
                      className="group relative rounded-xl border border-white/10 bg-black/40 p-3 space-y-2 shadow-sm transition hover:border-white/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm leading-snug">{task.title}</span>
                        {isAdmin && (
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                            title="Delete Task"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>

                      {task.task_kind && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                          <Tag className="size-3" /> {task.task_kind}
                        </div>
                      )}

                      <div className="flex flex-col gap-1 text-[11px] text-muted-foreground pt-1 border-t border-white/5">
                        {assignee && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="size-3" /> {assignee.full_name}
                          </span>
                        )}
                        {(task.start_date || task.due_date) && (
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Calendar className="size-3" /> {task.start_date ?? "Any"} →{" "}
                            {task.due_date ?? "No due date"}
                          </span>
                        )}
                      </div>

                      {/* Status movement controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        {col.key !== "open" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateStatus(
                                task.id,
                                col.key === "completed" ? "in_progress" : "open",
                              )
                            }
                            className="h-7 px-2 text-[10px] bg-white/5 hover:bg-white/10"
                          >
                            <ArrowLeft className="size-3 mr-1" /> Back
                          </Button>
                        ) : (
                          <div />
                        )}

                        {col.key !== "completed" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateStatus(
                                task.id,
                                col.key === "open" ? "in_progress" : "completed",
                              )
                            }
                            className="h-7 px-2 text-[10px] bg-white/5 hover:bg-white/10 ml-auto"
                          >
                            Advance <ArrowRight className="size-3 ml-1" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div className="flex h-32 items-center justify-center text-xs text-muted-foreground italic">
                    No tasks in {col.label}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
