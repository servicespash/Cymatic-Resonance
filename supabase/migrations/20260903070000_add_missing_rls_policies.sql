-- Add missing RLS policies for communication tables

-- 1. Channels: Add INSERT, UPDATE, DELETE
-- Assuming org_id check as per channels_admin_all
CREATE POLICY "channels_insert" ON "public"."channels"
    FOR INSERT TO "authenticated"
    WITH CHECK (is_org_admin() AND (org_id = current_org_id()));

CREATE POLICY "channels_update" ON "public"."channels"
    FOR UPDATE TO "authenticated"
    USING (is_org_admin() AND (org_id = current_org_id()))
    WITH CHECK (is_org_admin() AND (org_id = current_org_id()));

CREATE POLICY "channels_delete" ON "public"."channels"
    FOR DELETE TO "authenticated"
    USING (is_org_admin() AND (org_id = current_org_id()));

-- 2. Call Signals: Add UPDATE, DELETE
-- Assuming participant check as per existing insert/select
CREATE POLICY "participants_update_signals" ON "public"."call_signals"
    FOR UPDATE TO "authenticated"
    USING (EXISTS (SELECT 1 FROM call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()));

CREATE POLICY "participants_delete_signals" ON "public"."call_signals"
    FOR DELETE TO "authenticated"
    USING (EXISTS (SELECT 1 FROM call_participants cp WHERE cp.call_id = call_signals.call_id AND cp.user_id = auth.uid()));
