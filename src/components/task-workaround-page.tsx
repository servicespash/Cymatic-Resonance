import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Trash2, Download, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Progress } from "@/components/ui/progress";

const steps = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
];

export const TaskWorkaroundPage = ({ taskId }: { taskId: string }) => {
  const [task, setTask] = useState<any>(null);
  const [research, setResearch] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    if (!taskId) return;
    const fetchData = async () => {
      const { data: taskData } = await supabase.from('tasks').select('*').eq('id', taskId).single();
      if (taskData) {
        setTask(taskData);
        setResearch(taskData.task_notes || '');
      }
      const { data: attData } = await supabase.from('task_attachments').select('*').eq('task_id', taskId);
      if (attData) setAttachments(attData);
    };
    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel(`task-updates-${taskId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, (payload) => {
        setTask(payload.new);
        setResearch(payload.new.task_notes || '');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [taskId]);

  const advanceStatus = async () => {
    const currentIndex = steps.findIndex(s => s.id === task.status);
    if (currentIndex < steps.length - 1) {
      const nextStatus = steps[currentIndex + 1].id;
      const { error } = await supabase.from('tasks').update({ status: nextStatus }).eq('id', taskId);
      if (error) toast.error('Failed to update status');
    }
  };

  const saveNotes = async () => {
    const { error } = await supabase.from('tasks').update({ task_notes: research }).eq('id', taskId);
    if (!error) toast.success('Notes saved');
    else toast.error('Failed to save notes');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { data, error } = await supabase.storage.from('task-attachments').upload(`${taskId}/${file.name}`, file);
    if (error) { toast.error('Upload failed'); return; }
    await supabase.from('task_attachments').insert({ task_id: taskId, file_url: data.path, file_name: file.name, file_type: file.type });
    toast.success('File uploaded');
    const { data: attData } = await supabase.from('task_attachments').select('*').eq('task_id', taskId);
    if (attData) setAttachments(attData);
  };

  const deleteAttachment = async (id: string, path: string) => {
    await supabase.storage.from('task-attachments').remove([path]);
    await supabase.from('task_attachments').delete().eq('id', id);
    setAttachments(attachments.filter(a => a.id !== id));
    toast.success('File deleted');
  };

  if (!task) return <div>Loading...</div>;

  const currentStepIndex = steps.findIndex(s => s.id === task.status);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">{task.title}</h1>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
        </div>
        <Progress value={progressPercentage} />
      </div>

      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center gap-2">
            <div className={cn("size-8 rounded-full border flex items-center justify-center", index <= currentStepIndex ? "bg-primary border-primary" : "border-border")}>
              {index <= currentStepIndex && <Check className="size-4 text-white" />}
            </div>
            <span className="text-xs">{step.label}</span>
          </div>
        ))}
      </div>
      
      {currentStepIndex < steps.length - 1 && (
        <Button onClick={advanceStatus} className="w-full">
            Advance to {steps[currentStepIndex + 1].label} <ChevronRight className="size-4 ml-2"/>
        </Button>
      )}

      <div className="space-y-4">
        <h2 className="text-lg">Research / Notes</h2>
        <Textarea value={research} onChange={(e) => setResearch(e.target.value)} placeholder="Do your research and notes here..." className="h-64" />
        <Button onClick={saveNotes}>Save Progress</Button>
      </div>

      <div className="border p-4 rounded space-y-4">
        <h2 className="text-lg">Attachments</h2>
        <input type="file" onChange={handleFileUpload} />
        <ul className="space-y-2">
          {attachments.map(att => (
            <li key={att.id} className="flex items-center justify-between p-2 bg-secondary rounded">
              <span>{att.file_name}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => window.open(supabase.storage.from('task-attachments').getPublicUrl(att.file_url).data.publicUrl)}><Download className="size-4"/></Button>
                <Button variant="ghost" size="icon" onClick={() => deleteAttachment(att.id, att.file_url)}><Trash2 className="size-4 text-red-500"/></Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
