export type TaskStatus = "open" | "in_progress" | "completed" | "archived";

export interface Task {
  id: string;
  org_id: string;
  title: string;
  details: string | null;
  assignee_id: string | null;
  assigned_by: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high";
  due_date: string | null;
  created_at: string;
  assigned_to: string | null;
  start_date: string | null;
  category: string | null;
  description: string | null;
}

export interface Attendance {
  id: string;
  org_id: string;
  user_id: string;
  attendance_date: string;
  checked_in_at: string;
  status: "present" | "absent" | "late";
  note: string | null;
  created_at: string;
  checked_out_at: string | null;
  break_started_at: string | null;
  total_break_minutes: number;
  is_late: boolean;
}
