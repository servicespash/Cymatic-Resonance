
## Slice 1 — Dashboard v2 (date-range, CSV, sortable roll-call)

**UI (`src/routes/_authenticated/dashboard.tsx`)**
- Date-range picker (shadcn calendar in popover, two-month, presets: Today / 7d / 30d / This month / Custom). Range stored in URL search params via `validateSearch` + `zodValidator` so it's shareable/bookmarkable.
- Metrics row re-derives from range: total check-ins, on-time %, avg hours, late count, active members.
- Recharts area chart of daily attendance in range.
- Roll-call matrix: shadcn table, columns Name · Category · Check-in · Check-out · Hours · Status · Late. All columns sortable (click header), text filter input, status filter chips.
- "Export CSV" button → downloads filtered rows as `pulse_YYYY-MM-DD_YYYY-MM-DD.csv` (client-side blob, no server roundtrip).

**No DB changes** — existing `attendance` + `profiles` cover it.

---

## Slice 2 — Pulse v2: Leave Requests

Check-out, breaks, notes already shipped. Adding leave.

**DB migration**
- New table `leave_requests` (org_id, user_id, type enum: `sick|vacation|personal|other`, start_date, end_date, reason text, status enum: `pending|approved|denied`, decided_by, decided_at).
- GRANTs + RLS: members can read own + insert; admins can read/update all in org.
- RPCs: `request_leave(_type, _start, _end, _reason)`, `decide_leave(_id, _approved)`.

**UI**
- New section in Pulse: "Time off" card → "Request leave" button opens dialog (type select, date range, reason textarea).
- "My requests" list with status chips.
- Admin-only panel in Dashboard (or Settings): pending requests with Approve / Deny.

---

## Slice 3 — Org Branding + Invites + Google OAuth + Password Reset

**3a. Brand (logo + accent color)**
- Migration: add `logo_url text`, `accent_color text` to `organizations`.
- Storage bucket `org-logos` (public read, admin write via RLS on `storage.objects`).
- Settings → Workspace panel (admin): logo uploader (drag/drop, writes to bucket + `update_org_settings`), color picker for accent.
- AppShell reads org row → swaps brand mark in header; accent feeds a CSS var (`--brand-accent`) so glow/buttons retint per workspace.

**3b. Email invites**
- Migration: `org_invites` table (org_id, email, role, token, expires_at, accepted_at). RPC `create_invite(_email, _role)` returns token; `accept_invite(_token)` links current user to org.
- Settings → Workspace → Invites: input email + role → generates a link `/auth?invite=<token>`. Copy-to-clipboard. List of outstanding invites with revoke.
- Auth page reads `?invite=` from URL, calls `accept_invite` after sign-in/up. (Actual SMTP email sending is **out of scope** for this slice — link-share invites only. Flag if you want me to wire Lovable Cloud transactional emails after.)

**3c. Google OAuth**
- Run social-auth configurator for `google`.
- Add "Continue with Google" button on `auth.tsx` using `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`.

**3d. Password reset**
- "Forgot password?" link on auth.tsx → dialog asks for email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + "/auth?reset=1" })`.
- New flow on auth.tsx when `?reset=1`: shows "Set new password" form → `supabase.auth.updateUser({ password })`.

---

## File map

**New**
- `src/components/dashboard/date-range-picker.tsx`, `roll-call-table.tsx`, `export-csv.ts`
- `src/components/pulse/leave-dialog.tsx`, `leave-list.tsx`
- `src/components/settings/brand-panel.tsx`, `invite-panel.tsx`, `logo-uploader.tsx`
- `src/components/auth/forgot-password-dialog.tsx`, `reset-password-form.tsx`

**Edited**
- `src/routes/_authenticated/dashboard.tsx` (rebuild around date-range + table)
- `src/routes/_authenticated/pulse.tsx` (add leave card)
- `src/routes/_authenticated/settings.tsx` (brand + invites tabs)
- `src/routes/auth.tsx` (Google button, forgot/reset flows, invite token handling)
- `src/components/app-shell.tsx` (render org logo + accent)

**Migrations** — 3 (leave, brand cols, invites + storage bucket policies)

---

## Execution order
1. Slice 1 (frontend-only, ships fast).
2. Slice 2 migration → UI.
3. Slice 3a migration + bucket → 3b migration → 3c configurator + button → 3d auth UI.

Each slice independently shippable. Want me to start?
