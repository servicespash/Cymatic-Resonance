ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'completed'::text, 'archived'::text]));
