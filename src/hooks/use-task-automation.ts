import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useTaskAutomation = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('tasks-automation')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `assignee_id=eq.${userId}`,
        },
        (payload) => {
          const newTask = payload.new;
          toast.info(`New Task Assigned: ${newTask.title}`, {
            description: newTask.description || "You have a new task to work on.",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
};
