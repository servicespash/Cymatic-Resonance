import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks-api";

type Member = { id: string; full_name: string | null };

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
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
  members: Member[];
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { tasks: t, error } = await listTasks(orgId);
    if (error) setUnavailable(error);
    else {
      setUnavailable(null);
      setTasks(t);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Task needs a title");
    setBusy(true);
    const err = await createTask({
      org_id: orgId,
      title: title.trim(),
      details: details.trim() || undefined,
      assignee_id: assignee || null,
      assigned_by: userId,
      priority,
      due_date: due || null,
    });
    setBusy(false);
    if (err) return toast.error(err);
    setTitle("");
    setDetails("");
    setDue("");
    toast.success("Task assigned");
    refresh();
  };

  const changeStatus = async (t: Task, status: TaskStatus) => {
    const err = await setTaskStatus(t.id, status);
    if (err) return toast.error(err);
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
  };

  const remove = async (t: Task) => {
    const err = await deleteTask(t.id);
    if (err) return toast.error(err);
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
  };

  const nameOf = (id: string | null) =>
    id ? (members.find((m) => m.id === id)?.full_name ?? "Member") : "Unassigned";

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-accent/40"
          />
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Details (optional)"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-accent/40"
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              aria-label="Assign to"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? "Member"}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              aria-label="Priority"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="Due date"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-frequency px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Assign task
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Loading tasks…</p>
      ) : unavailable ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          Tasks aren’t available yet: {unavailable}
        </p>
      ) : tasks.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No tasks yet</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <CheckSquare
                className={`mt-0.5 size-4 shrink-0 ${t.status === "done" ? "text-emerald-400" : "text-accent"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.title}</div>
                {t.details && <p className="text-xs text-muted-foreground">{t.details}</p>}
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {nameOf(t.assignee_id)} · {t.priority}
                  {t.due_date ? ` · due ${t.due_date}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={t.status}
                  onChange={(e) => changeStatus(t, e.target.value as TaskStatus)}
                  disabled={!isAdmin && t.assignee_id !== userId}
                  aria-label="Task status"
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs disabled:opacity-40"
                >
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                {isAdmin && (
                  <button
                    onClick={() => remove(t)}
                    aria-label="Delete task"
                    className="rounded-md p-1.5 text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
