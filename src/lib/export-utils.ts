import { format, startOfDay, addDays } from "date-fns";

export interface ExportRow {
  id?: string;
  userId?: string;
  name?: string | null;
  category?: string | null;
  role?: string | null;
  date: string; // ISO format "YYYY-MM-DD"
  checkIn?: string | null; // ISO timestamp or formatted
  checkOut?: string | null; // ISO timestamp or formatted
  breakDurationMinutes?: number | null;
  breakDisplay?: string | null;
  leaveType?: string | null;
  leaveReason?: string | null;
  leaveStatus?: string | null;
  hours?: number | null;
  status: string;
  late?: boolean | null;
  telemetry?: string | null;
  notes?: string | null;
}

export interface AttendanceRecordLike {
  id?: string;
  user_id: string;
  attendance_date: string;
  checked_in_at: string;
  checked_out_at?: string | null;
  break_started_at?: string | null;
  total_break_minutes?: number | null;
  is_late?: boolean | null;
  status?: string | null;
  note?: string | null;
}

export interface LeaveRecordLike {
  id?: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  type?: string | null;
  status?: string | null;
}

export interface MemberRecordLike {
  id: string;
  full_name?: string | null;
  name?: string | null;
  category?: string | null;
  position?: string | null;
  role?: string | null;
}

export function formatTimeSafe(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(isoString);
  }
}

export function formatDateSafe(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString.includes("T") ? isoString : `${isoString}T00:00:00`);
    if (isNaN(d.getTime())) return String(isoString);
    return format(d, "MMM d, yyyy");
  } catch {
    return String(isoString);
  }
}

export function formatBreakMinutes(
  minutes: number | null | undefined,
  isCurrentlyOnBreak?: boolean,
): string {
  if (isCurrentlyOnBreak) return "On Break";
  if (minutes == null || minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Builds a comprehensive list of ExportRows spanning all dates in the selected range.
 * Each row accounts for Check-in, Check-out, Break time, and Leaves (with user-provided reason).
 */
export function buildMultiDayExportRows({
  rangeFrom,
  rangeTo,
  members,
  attendance,
  leaves,
  includeAbsent = true,
  selectedUserIds,
}: {
  rangeFrom: Date;
  rangeTo: Date;
  members: MemberRecordLike[];
  attendance: AttendanceRecordLike[];
  leaves: LeaveRecordLike[];
  includeAbsent?: boolean;
  selectedUserIds?: Set<string>;
}): ExportRow[] {
  const start = startOfDay(rangeFrom);
  const end = startOfDay(rangeTo);
  const rows: ExportRow[] = [];

  // Generate date list from newest to oldest
  const dayDates: Date[] = [];
  for (let d = end; d >= start; d = addDays(d, -1)) {
    dayDates.push(d);
  }

  const targetMembers =
    selectedUserIds && selectedUserIds.size > 0
      ? members.filter((m) => selectedUserIds.has(m.id))
      : members;

  for (const d of dayDates) {
    const dIso = format(d, "yyyy-MM-dd");

    for (const m of targetMembers) {
      const memberName = m.full_name || m.name || "Unknown Member";
      const memberCategory = m.category || m.position || "Member";
      const memberRole = m.role || "Member";

      // Match attendance for this member on this date
      const att = attendance.find((a) => a.user_id === m.id && a.attendance_date === dIso);

      // Match leave request covering this date
      const lv = leaves.find(
        (l) => l.user_id === m.id && l.start_date <= dIso && l.end_date >= dIso,
      );

      // If no attendance and no leave, only include if includeAbsent is true
      if (!att && !lv && !includeAbsent) {
        continue;
      }

      // Calculate working hours (deducting breaks)
      let hours: number | null = null;
      if (att?.checked_in_at && att?.checked_out_at) {
        const inTime = new Date(att.checked_in_at).getTime();
        const outTime = new Date(att.checked_out_at).getTime();
        const totalMinutes = Math.max(0, Math.floor((outTime - inTime) / 60000));
        const breakMins = att.total_break_minutes || 0;
        hours = Math.max(0, totalMinutes - breakMins) / 60;
      }

      // Parse telemetry from note if present
      let telemetryStatus = "verified";
      if (att?.note && typeof att.note === "string" && att.note.startsWith("{")) {
        try {
          const parsed = JSON.parse(att.note);
          if (parsed?.telemetry?.status) {
            telemetryStatus = parsed.telemetry.status;
          }
        } catch {
          // ignore
        }
      }

      // Determine clean status
      let status = "Absent";
      if (lv && !att) {
        status = `On Leave (${lv.type || "Scheduled"})`;
      } else if (att) {
        if (att.checked_out_at) {
          status = "Completed";
        } else if (att.break_started_at || att.status === "on_break") {
          status = "On Break";
        } else {
          status = "Present";
        }
        if (lv) {
          status += ` · Leave (${lv.type})`;
        }
      }

      const breakMins = att?.total_break_minutes ?? 0;
      const isCurrentlyOnBreak = !!att?.break_started_at || att?.status === "on_break";
      const breakDisp = att ? formatBreakMinutes(breakMins, isCurrentlyOnBreak) : "—";

      rows.push({
        id: `${m.id}_${dIso}`,
        userId: m.id,
        name: memberName,
        category: memberCategory,
        role: memberRole,
        date: dIso,
        checkIn: att?.checked_in_at ?? null,
        checkOut: att?.checked_out_at ?? null,
        breakDurationMinutes: att ? breakMins : null,
        breakDisplay: breakDisp,
        leaveType: lv?.type ? lv.type.charAt(0).toUpperCase() + lv.type.slice(1) : null,
        leaveReason: lv?.reason ?? null,
        leaveStatus: lv?.status ?? null,
        hours,
        status,
        late: att?.is_late ?? false,
        telemetry: att ? telemetryStatus : "—",
      });
    }
  }

  return rows;
}
