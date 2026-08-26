-- Fix RPC permission denied errors and task schema mismatches
-- Grant EXECUTE permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_org_settings(text, text, time, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_org_brand(text, text) TO authenticated;

-- Ensure tasks table has task_kind column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_kind text DEFAULT 'general';

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
