## Build order (3 slices)

### Slice 1 — Fix "Workspace not linked yet" + Pulse v2
Root cause: `profiles.org_id` is null for some users (e.g. admin who signed up but RPC didn't link, or pre-existing accounts). Pulse hard-blocks on it.

**Fixes**
- On Pulse load, if `org_id` is null, show a friendly "Join a workspace" empty state with CYM-code input → calls `join_org_with_code` RPC, then refetches. Admins see "Create workspace" CTA → opens dialog calling `create_org_as_admin`.
- Same guard added to Comms, Dashboard, Directory (shared `<RequireWorkspace>` wrapper component).

**Pulse v2 features**
- Check-in → Check-out → Break start/stop (state machine on today's row).
- Optional note field on check-in (textarea in glass dialog).
- Auto-flag `late` if check-in after configurable org cutoff (default 09:00) — shows amber chip.
- Today summary card: hours worked (live ticker), break minutes, status.
- Ledger row expanded: shows check-in, check-out, duration, late flag, note preview.
- "Resonance streak" — consecutive day count, glowing chip.

**DB migration**
- `attendance`: add `checked_out_at timestamptz`, `break_started_at timestamptz`, `total_break_minutes int default 0`, `is_late boolean default false`.
- `organizations`: add `day_start_cutoff time default '09:00'`, `timezone text default 'UTC'`.
- New RPC `pulse_checkout(_id)` and `pulse_toggle_break(_id)` (SECURITY DEFINER, scoped to `auth.uid()`).
- Update `attendance_self_update` policy already allows owner edits — keep.

### Slice 2 — DMs + unread + reactions in Comms
**DB migration**
- New table `direct_threads(id, org_id, user_a, user_b, last_message_at)` with unique pair index.
- New table `message_reads(user_id, channel_id, last_read_at)` for unread counts.
- New table `message_reactions(id, message_id, user_id, emoji)` with unique `(message_id, user_id, emoji)`.
- RLS: org-scoped select, self insert; full GRANTs.
- RPC `open_dm(_other_user)` → returns or creates a thread + a hidden `kind='dm'` channel; existing `channels.kind` already supports `'dm'`.
- Enable realtime on new tables.

**UI**
- Comms left rail: tabs **Channels** | **Direct**. Direct list shows org members with avatar, last message snippet, unread badge.
- Click member → opens/creates DM, routes to that channel.
- Unread badges on every channel/DM (computed from `message_reads`).
- Replace `prompt()` channel creation with a proper shadcn `<Dialog>`.
- Long-press / hover message → emoji reaction picker (8 quick emojis). Reactions render as chips below the bubble with counts; clicking toggles own reaction.
- Typing indicator via realtime broadcast channel (ephemeral, no DB).
- Mark-as-read: writes `message_reads.last_read_at = now()` on channel open + on new incoming while active.

### Slice 3 — Org settings page upgrade
**Settings → new "Workspace" tab (admin-only section under existing Settings route)**
- Edit org name, org type, timezone, day-start cutoff.
- Rotate access code (RPC `rotate_access_code`).
- Member list with role badges; admin can promote/demote (RPC `set_member_role`) and remove (`remove_member` → nulls `org_id`).
- Danger zone: delete workspace (admin + confirm typing org name).
- Non-admins see read-only org card (already exists).

**DB migration**
- RPCs: `rotate_access_code()`, `set_member_role(_user, _role)`, `remove_member(_user)`, `delete_org()` — all SECURITY DEFINER with `is_org_admin()` guard.

---

## Files touched

**New**
- `src/components/require-workspace.tsx` (guard wrapper + join/create flows)
- `src/components/pulse/check-in-dialog.tsx`, `streak-chip.tsx`
- `src/components/comms/dm-list.tsx`, `reaction-bar.tsx`, `new-channel-dialog.tsx`, `unread-badge.tsx`
- `src/components/settings/workspace-panel.tsx`, `member-row.tsx`
- 3 migrations (one per slice)

**Edited**
- `src/routes/_authenticated/pulse.tsx` — rebuilt around v2 state machine + RequireWorkspace
- `src/routes/_authenticated/comms.tsx` — tabs, DMs, reactions, dialog, read receipts
- `src/routes/_authenticated/settings.tsx` — admin workspace panel
- `src/routes/_authenticated/dashboard.tsx`, `directory.tsx` — RequireWorkspace wrap

## Order of execution
1. Migration 1 (pulse v2 + org timezone) → rebuild Pulse + RequireWorkspace guard wired everywhere.
2. Migration 2 (DMs, reads, reactions) → rebuild Comms.
3. Migration 3 (admin RPCs) → Settings workspace panel.

Each slice is independently shippable; the workspace-link fix lands inside slice 1.
