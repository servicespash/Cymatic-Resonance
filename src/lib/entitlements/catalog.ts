import type { EntitlementPlan } from "@/lib/domain/contracts";

export type EntitlementFeature =
  | "pulse_checkin"
  | "attendance_history"
  | "realtime_presence"
  | "broadcast_channels"
  | "direct_messages"
  | "reactions"
  | "tasks"
  | "member_directory"
  | "unlimited_members"
  | "command_center"
  | "group_calls"
  | "attendance_exports"
  | "attendance_analytics"
  | "continuous_attendance_tracking"
  | "advanced_notifications"
  | "custom_attendance_policies"
  | "audit_logs"
  | "sso_saml"
  | "custom_entitlements"
  | "api_access";

export type FeatureAvailability = "available" | "planned";

export interface EntitlementFeatureDefinition {
  key: EntitlementFeature;
  label: string;
  description: string;
  free: boolean;
  paid: boolean;
  custom: boolean;
  availability: FeatureAvailability;
}

const available = (key: EntitlementFeature, label: string, description: string, free: boolean, paid: boolean, custom: boolean): EntitlementFeatureDefinition => ({
  key, label, description, free, paid, custom, availability: "available",
});

const planned = (key: EntitlementFeature, label: string, description: string, custom: boolean): EntitlementFeatureDefinition => ({
  key, label, description, free: false, paid: false, custom, availability: "planned",
});

export const ENTITLEMENT_FEATURES: readonly EntitlementFeatureDefinition[] = [
  available("pulse_checkin", "Sync Pulse check-in", "Daily attendance check-in and checkout.", true, true, true),
  available("attendance_history", "Attendance history", "Personal attendance history and status.", true, true, true),
  available("realtime_presence", "Realtime presence", "Live workspace presence and communication status.", true, true, true),
  available("broadcast_channels", "Broadcast channels", "Organization-wide communication channels.", true, true, true),
  available("direct_messages", "Direct messages", "Private member-to-member messaging.", true, true, true),
  available("reactions", "Message reactions", "Realtime reactions on supported messages.", true, true, true),
  available("tasks", "Tasks", "Assigned task visibility and operational tracking.", true, true, true),
  available("member_directory", "Member directory", "Workspace member and role directory.", true, true, true),
  available("unlimited_members", "Unlimited members", "Remove the free workspace member ceiling.", false, true, true),
  available("command_center", "Command Center", "Administrative attendance and workspace oversight.", false, true, true),
  available("group_calls", "Group audio/video calls", "Production communication rooms and group calls.", false, true, true),
  available("attendance_exports", "Attendance exports", "Export operational attendance records.", false, true, true),
  available("attendance_analytics", "Attendance analytics", "Extended attendance reporting and analysis.", false, true, true),
  available("continuous_attendance_tracking", "Continuous attendance tracking", "Session-based location evidence and geofence transitions.", false, true, true),
  available("advanced_notifications", "Advanced notifications", "Expanded operational notification capabilities.", false, true, true),
  available("custom_attendance_policies", "Custom attendance policies", "Institution-specific tracking, grace, and geofence policies.", false, false, true),
  planned("audit_logs", "Audit logs", "Administrative audit trail for security-sensitive actions.", true),
  planned("sso_saml", "SSO / SAML", "Institution-managed single sign-on.", true),
  available("custom_entitlements", "Custom entitlements", "Institution-specific capability and quota configuration.", false, false, true),
  planned("api_access", "API access", "Controlled institution API integration surface.", true),
];

export const PLAN_LABELS: Record<EntitlementPlan, string> = {
  FREE: "Free",
  PAID: "Paid",
  CUSTOM_INSTITUTION: "Custom Institution",
};

export function planIncludes(plan: EntitlementPlan, feature: EntitlementFeatureDefinition): boolean {
  if (plan === "FREE") return feature.free;
  if (plan === "PAID") return feature.paid;
  return feature.custom;
}

export function planRank(plan: EntitlementPlan): number {
  return plan === "FREE" ? 0 : plan === "PAID" ? 1 : 2;
}
