-- Cleanup redundant storage bucket
-- This migration was originally intended to remove the 'comm_attachments' bucket.
-- Due to Supabase storage protection, direct deletion via SQL is blocked.
-- This migration is now a no-op to preserve migration history while preventing deployment failures.

DO $$
BEGIN
  -- No-op: Direct deletion via SQL is not allowed for storage buckets.
  -- If bucket removal is required, it must be performed via the Supabase Storage API,
  -- not via direct SQL migration.
  RAISE NOTICE 'Skipping cleanup of comm_attachments bucket: direct SQL deletion is not permitted.';
END $$;
