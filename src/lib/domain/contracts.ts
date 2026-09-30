/**
 * Cymatic Resonance Phase 2 domain contract.
 *
 * These types describe authoritative application state. They are intentionally
 * independent of UI state and generated Supabase table types.
 */

export type EntitlementPlan = "FREE" | "PAID" | "CUSTOM_INSTITUTION";
export type OrganizationRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";
export type RoomKind = "GENERAL" | "CLASS" | "TEAM" | "PRIVATE";
export type PresenceState =
  | "ONLINE"
  | "AWAY"
  | "IN_CALL"
  | "MEDIA_CONNECTING"
  | "MEDIA_CONNECTED"
  | "MEDIA_RECONNECTING"
  | "OFFLINE";
export type MeetingState = "SCHEDULED" | "STARTING" | "LIVE" | "ENDING" | "ENDED" | "FAILED";
export type CallState =
  | "IDLE"
  | "INVITING"
  | "RINGING"
  | "ACCEPTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "ENDING"
  | "ENDED"
  | "DECLINED"
  | "MISSED"
  | "FAILED";
export type AttendanceSessionState =
  | "SCHEDULED"
  | "OPEN"
  | "CHECKED_IN"
  | "TRACKING"
  | "LOCATION_VERIFIED"
  | "WITHIN_GEOFENCE"
  | "OUTSIDE_GEOFENCE"
  | "GRACE"
  | "ABSENT"
  | "ENDED"
  | "INVALIDATED";
export type AttendanceEventType =
  | "SESSION_OPENED"
  | "CHECK_IN_REQUESTED"
  | "CHECKED_IN"
  | "TRACKING_STARTED"
  | "LOCATION_VERIFIED"
  | "ENTERED_GEOFENCE"
  | "EXITED_GEOFENCE"
  | "GRACE_STARTED"
  | "GRACE_EXPIRED"
  | "CHECKED_OUT"
  | "SESSION_ENDED"
  | "MARKED_ABSENT"
  | "INVALIDATED";
export type LocationEvidenceQuality = "HIGH" | "MEDIUM" | "LOW" | "INVALID" | "UNAVAILABLE";

export interface OrganizationContract {
  id: string;
  name: string;
  timezone: string;
  createdBy: string;
}
export interface MembershipContract {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  active: boolean;
}
export interface EntitlementContract {
  organizationId: string;
  userId?: string;
  plan: EntitlementPlan;
  feature: string;
  enabled: boolean;
  limit?: number | null;
}
export interface RoomContract {
  id: string;
  organizationId: string;
  name: string;
  kind: RoomKind;
  archivedAt?: string | null;
}
export interface RoomMemberContract {
  roomId: string;
  userId: string;
  role: OrganizationRole | "ROOM_MEMBER";
  active: boolean;
}
export interface PresenceContract {
  organizationId: string;
  roomId: string;
  userId: string;
  state: PresenceState;
  observedAt: string;
}
export interface MeetingContract {
  id: string;
  roomId: string;
  organizationId: string;
  state: MeetingState;
  livekitRoomName: string;
  startedAt?: string | null;
  endedAt?: string | null;
}
export interface CallContract {
  id: string;
  organizationId: string;
  roomId: string;
  initiatorId: string;
  state: CallState;
  startedAt: string;
  endedAt?: string | null;
}
export interface AttendanceSessionContract {
  id: string;
  organizationId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  state: AttendanceSessionState;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  accuracyMeters: number;
  graceSeconds: number;
  trackingRequired: boolean;
}
export interface AttendanceEventContract {
  id: string;
  sessionId: string;
  userId: string;
  type: AttendanceEventType;
  occurredAt: string;
  serverRecordedAt: string;
  source: "DEVICE" | "SERVER" | "ADMIN" | "SYSTEM";
}
export interface LocationEvidenceContract {
  id: string;
  sessionId: string;
  userId: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  distanceMeters: number;
  quality: LocationEvidenceQuality;
  isInsideGeofence: boolean;
}

export const DOMAIN_INVARIANTS = [
  "Identity is authoritative in Supabase Auth.",
  "Membership and entitlements are authoritative in PostgreSQL/server authorization.",
  "Persistent state is authoritative in PostgreSQL.",
  "Presence is ephemeral and authoritative only for its observation window.",
  "Media state is authoritative in LiveKit/WebRTC, never inferred from UI.",
  "Attendance truth is established by authorized server/database events, not client-only state.",
  "Location coordinates are evidence; GPS alone is not cryptographic proof of physical presence.",
  "Entitlement checks are enforced server-side; UI visibility is not authorization.",
  "Call state, signaling state, media state, and UI state are separate concerns.",
  "Operational events are append-only evidence; derived status may be recomputed from them.",
] as const;