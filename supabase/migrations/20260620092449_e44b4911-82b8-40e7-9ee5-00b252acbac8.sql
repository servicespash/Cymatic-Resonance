
CREATE POLICY "org_logos_select_member" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);

CREATE POLICY "org_logos_admin_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_admin()
);

CREATE POLICY "org_logos_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_admin()
);

CREATE POLICY "org_logos_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
  AND public.is_org_admin()
);
