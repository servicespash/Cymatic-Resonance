## Goal
Let members attach files (images, PDFs, docs) and record voice notes inside any channel or DM in `/comms`, scoped per workspace with proper access control.

## Storage
- New private bucket `comm-attachments` (org-scoped paths: `{org_id}/{channel_id}/{message_id}/{filename}`).
- RLS on `storage.objects`:
  - SELECT: user must belong to the org that owns the channel.
  - INSERT: same, and path prefix must match their `org_id`.
  - DELETE: sender or org admin.
- Files served via short-lived signed URLs (no public bucket).

## Schema
New table `public.message_attachments`:
- `message_id` (FK → messages, cascade), `org_id`, `uploader_id`
- `storage_path`, `mime_type`, `size_bytes`, `kind` (`image` | `audio` | `file`)
- `duration_ms` (nullable, for audio), `width`/`height` (nullable, for images)
- RLS: SELECT to org members; INSERT by sender of the message; DELETE by sender or admin.
- GRANTs to `authenticated` + `service_role`.

Messages stay as-is — `body` becomes optional in the UI when an attachment is present (DB column already nullable in practice; we'll allow empty body if attachment exists, validated client-side).

## UI — `src/routes/_authenticated/comms.tsx`
Composer additions (left of send button):
- 📎 Paperclip → hidden `<input type="file" multiple>` (images, PDF, docs; 25 MB each, max 5).
- 🎙️ Mic → press-and-hold or click to start/stop recording via `MediaRecorder` (webm/opus, fallback to mp4 on Safari). Shows live timer + waveform bars (reuse `CymaticWave`). Cancel + send buttons.
- Drag-and-drop onto the thread area also queues files.
- Pending attachments render as chips above the input with remove (×).

Send flow:
1. Insert message row (body may be empty if attachments present).
2. Upload each file to storage at the org/channel/message path.
3. Insert `message_attachments` rows.
4. Realtime: subscribe to `message_attachments` inserts so other clients render attachments as they arrive.

Message rendering:
- Images → inline thumbnail (max 280px), click to open lightbox (reuse Dialog).
- Audio → custom player: play/pause button, waveform bars, mm:ss duration.
- Other files → card with icon, filename, size, download button.
- All URLs fetched via `supabase.storage.from('comm-attachments').createSignedUrl(path, 3600)`, cached in component state.

## Limits & UX
- Client-side: reject >25 MB, >5 files, unsupported mime.
- Voice notes capped at 5 min; auto-stop with toast.
- Toast on upload error; partial failures keep message but mark attachment failed.

## Files touched
- New migration: bucket + `message_attachments` table + RLS + storage policies.
- Edit `src/routes/_authenticated/comms.tsx` (composer, render, realtime).
- New `src/components/comm-attachment.tsx` (renderer for image/audio/file).
- New `src/components/voice-recorder.tsx` (MediaRecorder logic).

## Out of scope (ask if wanted)
- Video files, image compression on upload, transcription of voice notes, reactions on attachments specifically (existing message-level reactions already cover it).
