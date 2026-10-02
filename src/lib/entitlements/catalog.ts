import type { EntitlementPlan, TrialPlan } from "@/lib/domain/contracts";

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
  | "live_location_map"
  | "free_live_tracking_window"
  | "advanced_notifications"
  | "custom_attendance_policies"
  | "execution_charts"
  | "execution_meetings"
  | "high_capacity_calls"
  | "dedicated_signaling"
  | "audit_logs"
  | "sso_saml"
  | "custom_entitlements"
  | "api_access";

export type FeatureAvailability = "available" | "coming_soon" | "revenue_required";

export type CallMode = "AUDIO" | "VIDEO";

export interface EntitlementFeatureDefinition {
  key: EntitlementFeature;
  label: string;
  description: string;
  free: boolean;
  silver: boolean;
  gold: boolean;
  custom: boolean;
  availability: FeatureAvailability;
}

export interface TierDefinition {
  plan: EntitlementPlan;
  label: string;
  priceLabel: string;
  description: string;
}

const available = (
  key: EntitlementFeature,
  label: string,
  description: string,
  free: boolean,
  silver: boolean,
  gold: boolean,
  custom: boolean,
): EntitlementFeatureDefinition => ({
  key,
  label,
  description,
  free,
  silver,
  gold,
  custom,
  availability: "available",
});

export const ENTITLEMENT_TIERS: readonly TierDefinition[] = [
  {
    plan: "FREE",
    label: "Free",
    priceLabel: "$0",
    description: "Core institutional attendance, presence, messaging, and small calls.",
  },
  {
    plan: "SILVER",
    label: "Silver",
    priceLabel: "~$15",
    description: "Enhanced presence, live execution channels, and small-group execution sync.",
  },
  {
    plan: "GOLD",
    label: "Gold",
    priceLabel: "~$40",
    description:
      "Full registers, execution charts, unlimited presence tracking, and higher call capacity.",
  },
  {
    plan: "CUSTOM_INSTITUTION",
    label: "Premium / Custom",
    priceLabel: "Custom",
    description:
      "Institution-specific infrastructure, meeting limits, signaling, and SLA controls.",
  },
];

export const ENTITLEMENT_FEATURES: readonly EntitlementFeatureDefinition[] = [
  available(
    "pulse_checkin",
    "Sync Pulse check-in",
    "Daily attendance check-in and checkout.",
    true,
    true,
    true,
    true,
  ),
  available(
    "attendance_history",
    "Attendance history",
    "Personal attendance history and status.",
    true,
    true,
    true,
    true,
  ),
  available(
    "realtime_presence",
    "Standard presence",
    "Live workspace presence and communication status.",
    true,
    true,
    true,
    true,
  ),
  available(
    "broadcast_channels",
    "Broadcast channels",
    "Organization-wide communication channels.",
    true,
    true,
    true,
    true,
  ),
  available(
    "direct_messages",
    "Direct messages",
    "Private member-to-member messaging.",
    true,
    true,
    true,
    true,
  ),
  available(
    "reactions",
    "Message reactions",
    "Realtime reactions on supported messages.",
    true,
    true,
    true,
    true,
  ),
  available(
    "tasks",
    "Execution tasks",
    "Assigned task visibility and operational tracking.",
    true,
    true,
    true,
    true,
  ),
  available(
    "member_directory",
    "Member directory",
    "Workspace member and role directory.",
    true,
    true,
    true,
    true,
  ),
  available(
    "group_calls",
    "Small-group audio/video calls",
    "Free supports calls up to 5 participants; paid tiers expand capacity.",
    true,
    true,
    true,
    true,
  ),
  available(
    "command_center",
    "Command Center",
    "Administrative attendance and workspace oversight.",
    false,
    true,
    true,
    true,
  ),
  available(
    "attendance_exports",
    "Attendance exports",
    "Export operational attendance records.",
    false,
    true,
    true,
    true,
  ),
  available(
    "attendance_analytics",
    "Attendance analytics",
    "Extended attendance reporting and analysis.",
    false,
    true,
    true,
    true,
  ),
  available(
    "continuous_attendance_tracking",
    "Continuous attendance tracking",
    "Session-based location evidence and geofence transitions.",
    false,
    true,
    true,
    true,
  ),
  available(
    "live_location_map",
    "Live location map",
    "Consent-based live map of active members during eligible attendance sessions.",
    false,
    false,
    true,
    true,
  ),
  available(
    "free_live_tracking_window",
    "Free live tracking window",
    "Up to 30 calendar days with a maximum of 6 tracked hours per UTC day.",
    true,
    false,
    false,
    false,
  ),
  available(
    "advanced_notifications",
    "Advanced notifications",
    "Expanded operational notification capabilities.",
    false,
    true,
    true,
    true,
  ),
  available(
    "execution_charts",
    "Execution charts",
    "Live institutional execution and progress charts.",
    false,
    true,
    true,
    true,
  ),
  available(
    "execution_meetings",
    "Execution meetings",
    "Structured institutional execution meetings.",
    false,
    true,
    true,
    true,
  ),
  available(
    "high_capacity_calls",
    "High-capacity live calls",
    "Calls beyond the Free/Silver participant envelope.",
    false,
    false,
    true,
    true,
  ),
  available(
    "unlimited_members",
    "Expanded membership",
    "Remove the Free workspace member ceiling.",
    false,
    true,
    true,
    true,
  ),
  available(
    "custom_attendance_policies",
    "Custom attendance policies",
    "Institution-specific tracking, grace, and geofence policies.",
    false,
    false,
    true,
    true,
  ),
  available(
    "dedicated_signaling",
    "Dedicated signaling",
    "Institution-specific realtime signaling infrastructure.",
    false,
    false,
    false,
    true,
  ),
  {
    key: "audit_logs",
    label: "Audit logs",
    description: "Administrative audit trail for security-sensitive actions.",
    free: false,
    silver: true,
    gold: true,
    custom: true,
    availability: "available",
  },
  {
    key: "sso_saml",
    label: "SSO / SAML",
    description: "Institution-managed single sign-on.",
    free: false,
    silver: false,
    gold: true,
    custom: true,
    availability: "coming_soon",
  },
  available(
    "custom_entitlements",
    "Custom entitlements",
    "Institution-specific capability and quota configuration.",
    false,
    false,
    false,
    true,
  ),
  {
    key: "api_access",
    label: "API access",
    description: "Controlled institution API integration surface.",
    free: false,
    silver: false,
    gold: true,
    custom: true,
    availability: "coming_soon",
  },
];

export const PLAN_LABELS: Record<EntitlementPlan, string> = {
  FREE: "Free",
  SILVER: "Silver",
  GOLD: "Gold",
  CUSTOM_INSTITUTION: "Premium / Custom",
};

export const PLAN_RANK: Record<EntitlementPlan, number> = {
  FREE: 0,
  SILVER: 1,
  GOLD: 2,
  CUSTOM_INSTITUTION: 3,
};

export const CALL_LIMITS: Record<EntitlementPlan, { audio: number; video: number }> = {
  FREE: { audio: 5, video: 5 },
  SILVER: { audio: 15, video: 15 },
  GOLD: { audio: 30, video: 30 },
  CUSTOM_INSTITUTION: { audio: 100, video: 100 },
};

export const DEFAULT_TRIAL_DAYS = 7;
export const MAX_TRIAL_DAYS = 30;

export function planIncludes(
  plan: EntitlementPlan,
  feature: EntitlementFeatureDefinition,
): boolean {
  if (plan === "FREE") return feature.free;
  if (plan === "SILVER") return feature.silver;
  if (plan === "GOLD") return feature.gold;
  return feature.custom;
}

export function getCallParticipantLimit(plan: EntitlementPlan, mode: CallMode): number {
  return CALL_LIMITS[plan][mode === "VIDEO" ? "video" : "audio"];
}

export function planRank(plan: EntitlementPlan): number {
  return PLAN_RANK[plan];
}

export function isPaidPlan(plan: EntitlementPlan): plan is TrialPlan {
  return plan !== "FREE";
}
