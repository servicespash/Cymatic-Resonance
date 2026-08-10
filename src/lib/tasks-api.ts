// Task assignment API. Uses a loosely-typed query builder so the feature works
// before the generated database types include the `tasks` table.

import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high";

export type Task = {
  id: string;
  org_id: string;
  title: string;
  details: string | null;
  assignee_id: string | null;
  assigned_by: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
};

type Result = { data: unknown; error: { message: string } | null };
type QB = PromiseLike<Result> & {
  select: (cols?: string) => QB;
  insert: (values: unknown) => QB;
  update: (values: unknown) => QB;
  delete: () => QB;
  eq: (col: string, val: unknown) => QB;
  order: (col: string, opts?: { ascending?: boolean }) => QB;
};

const table = () => (supabase as unknown as { from: (t: string) => QB }).from("tasks");

export async function listTasks(orgId: string): Promise<{ tasks: Task[]; error: string | null }> {
  const { data, error } = await table()
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return { tasks: [], error: error.message };
  return { tasks: (data as Task[]) ?? [], error: null };
}

export async function createTask(input: {
  org_id: string;
  title: string;
  details?: string;
  assignee_id: string | null;
  assigned_by: string;
  priority?: TaskPriority;
  due_date?: string | null;
}): Promise<string | null> {
  const { error } = await table().insert({
    org_id: input.org_id,
    title: input.title,
    details: input.details ?? null,
    assignee_id: input.assignee_id,
    assigned_by: input.assigned_by,
    priority: input.priority ?? "normal",
    due_date: input.due_date ?? null,
    status: "open",
  });
  return error ? error.message : null;
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<string | null> {
  const { error } = await table().update({ status }).eq("id", id);
  return error ? error.message : null;
}

export async function deleteTask(id: string): Promise<string | null> {
  const { error } = await table().delete().eq("id", id);
  return error ? error.message : null;
}
