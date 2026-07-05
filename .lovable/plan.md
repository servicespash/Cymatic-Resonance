# Plan: Spacious WhatsApp-style Comms + Live Calls + Notifications

## 1. Backend (current Lovable Cloud Supabase — `amoopevwutclqkyimpsx`)

Unless you paste credentials for a separate Supabase project, I'll stay on the current one — it's already your backend.

### New tables (one migration, with GRANTs + RLS):

- **`calls`** — `id`, `org_id`, `channel_id` (FK channels — works for both DM channels and group channels), `initiator_id`, `kind` (`audio`|`video`), `status` (`ringing`|`active`|`ended`|`missed`|`declined`), `started_at`, `ended_at`. RLS: org members SELECT; initiator INSERT; participants UPDATE.
- **`call_participants`** — `call_id`, `user_id`, `joined_at`, `left_at`, `state` (`invited`|`joined`|`declined`|`left`). RLS: participants and channel members SELECT; self UPDATE.
- Realtime publication: `calls`, `call_participants`, plus reuse existing `messages` + `message_attachments`.

No schema change to messages — already supports threads.

## 2. WebRTC signaling (pure peer-to-peer, free Google STUN)

- `src/lib/webrtc/signaling.ts` — wraps `supabase.channel('call-' + callId)` broadcast for SDP offers/answers + ICE candidates. Each peer's events keyed by `from_user_id` / `to_user_id`.
- `src/lib/webrtc/peer.ts` — `RTCPeerConnection` factory using `stun:stun.l.google.com:19302` + `stun:stun1.l.google.com:19302`. Mesh topology (each peer connects to every other) — fine up to ~6 participants; beyond that quality degrades (documented limitation; SFU would need a paid provider).
- `src/hooks/use-call.ts` — orchestrates: get user media (audio + optional video), create peer connections per participant, handle offer/answer/ICE exchange, expose `remoteStreams`, `localStream`, `toggleMic`, `toggleCamera`, `leave`.

## 3. Call UI (inside `/comms`)

- **Header call buttons** — phone + video icons in active conversation header. Clicking: inserts `calls` row + `call_participants` for all channel members (status `invited` except self = `joined`) → broadcasts `ring` event on `org-{orgId}-calls` channel.
- **`<IncomingCallOverlay>`** mounted in `_authenticated/route.tsx` — subscribes to `org-{orgId}-calls`; on ring event shows accept/decline modal with caller avatar, name, kind. Plays ringtone via Web Audio (no asset needed, simple oscillator).
- **`<CallRoom>`** full-screen overlay route: video grid (1 = full-screen, 2 = split, 3-6 = grid), mic/camera/hangup controls bottom, participant list, call duration timer. Shows audio-only avatars with talking indicator (Web Audio analyser on remote stream) when video off.
- **Call history** rendered inline in message thread as system messages ("📞 Voice call · 4:23" / "📹 Video call · missed").

## 4. WhatsApp-style spacious comms redesign (`src/routes/_authenticated/comms.tsx`)

Mobile-first single-column with full-screen conversation transitions.

### List view (default on mobile, sidebar on `lg:`)

- Full-width rows, **72px tall**, generous padding (`px-5 py-4`).
- Each row: 48px avatar with online dot, name + verified badge, last message preview (1 line, truncate), right side: timestamp + unread count pill.
- Search bar sticky top. "New chat" FAB bottom-right.
- Tabs at top: **All / Channels / DMs / Verified** (verified = pinned/announcement channels marked by admin).

### Thread view (full-screen on mobile, right pane on `lg:`)

- Sticky header: back arrow (mobile only) + avatar + name + presence + 📞 + 📹 + ⋮ menu.
- Message area: `max-w-3xl mx-auto`, generous gap (`gap-2`), grouped by sender + minute, day separator chips.
- WhatsApp-style bubbles:
  - Mine: `bg-frequency text-primary-foreground` right-aligned, `rounded-2xl rounded-br-md`, padding `px-4 py-2.5`.
  - Theirs: `bg-card` left-aligned with avatar, `rounded-2xl rounded-bl-md`.
  - Tail effect via the asymmetric corner.
  - Timestamp + read receipt (✓✓) inside bubble, bottom-right, small.
- Composer: full-width pill `rounded-full`, 📎 left, 🎙️ right of input, send button morphs to mic when input empty (WhatsApp pattern).

## 5. Wider layouts across landing + auth + comms

Audit & widen any `max-w-md`/`max-w-lg`/`max-w-xl` text/layout containers:

- `src/routes/index.tsx` (landing) — hero + sections to `max-w-6xl` / `max-w-7xl`, content blocks `max-w-3xl mx-auto` for readability but containers go wide.
- `src/routes/auth.tsx` — split-screen layout (`lg:grid-cols-2`): left = brand panel with imagery + tagline, right = form. Container `max-w-6xl`.
- `src/routes/_authenticated/dashboard.tsx`, `pulse.tsx`, `settings.tsx` — bump main container to `max-w-7xl`, use cinematic grids.
- `src/routes/_authenticated/comms.tsx` — full-bleed, no max-width on the shell itself.

## 6. Web Notifications

- `src/lib/notifications.ts` — `requestPermission()` called once in `_authenticated/route.tsx` on first mount. Stores `granted`/`denied` in localStorage to not re-prompt.
- Hook into existing realtime message subscriber: when `document.hidden || document.visibilityState !== 'visible'` AND message not from self → fire `new Notification(senderName, { body: preview, icon: '/logo.png', tag: channelId })`. Click → `window.focus()` + navigate to thread.
- Same for incoming calls: high-priority notification with sender + "Incoming voice/video call".

## 7. Assets (image four / five / six)

Will verify `src/assets/` for these — if absent or referenced placeholders, I'll generate appropriate brand imagery (Cymatic-styled hero/auth visuals).

## Files touched

**New**

- `supabase/migrations/<new>.sql` — calls + call_participants + realtime
- `src/lib/webrtc/signaling.ts`
- `src/lib/webrtc/peer.ts`
- `src/hooks/use-call.ts`
- `src/lib/notifications.ts`
- `src/components/call-room.tsx`
- `src/components/incoming-call-overlay.tsx`
- `src/components/conversation-list.tsx` (extracted from comms.tsx)
- `src/components/message-bubble.tsx`

**Edited**

- `src/routes/_authenticated/route.tsx` — mount IncomingCallOverlay + notification permission request
- `src/routes/_authenticated/comms.tsx` — full redesign (WhatsApp layout)
- `src/routes/_authenticated/dashboard.tsx`, `pulse.tsx`, `settings.tsx` — widen containers
- `src/routes/index.tsx`, `auth.tsx` — widen + split-screen auth

## Explicit non-goals (ask if you want them)

- SFU/MCU for >6 participant calls (needs paid infra — LiveKit/Daily/Agora).
- Screen sharing, call recording, picture-in-picture.
- TURN server (calls will fail for ~15-20% of strict-NAT users; can add Twilio TURN later if needed — cheap, not free).
- Push notifications when browser tab closed (would need service worker + a push provider).
- Migration to a separate `servicespash` Supabase project (need new creds).

Reply with **go** to build, or tell me what to change.
