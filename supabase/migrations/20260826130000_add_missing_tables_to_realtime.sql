-- Add missing tables to realtime publication

DO $$
BEGIN
  -- Check if publication exists
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles, public.groups, public.group_members, public.org_invites, public.organizations, public.channels, public.message_reads, public.leave_requests;
  END IF;
END $$;
