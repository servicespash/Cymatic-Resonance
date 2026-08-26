-- Robustly add tables to supabase_realtime publication
DO $$
DECLARE
  _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY['tasks', 'profiles', 'leave_requests']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', _table);
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Table % already in publication, skipping', _table;
      WHEN undefined_table THEN
        RAISE NOTICE 'Table % does not exist, skipping', _table;
    END;
  END LOOP;
END
$$;
NOTIFY pgrst, 'reload schema';
