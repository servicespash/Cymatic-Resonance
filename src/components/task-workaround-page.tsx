import React, { useState, useEffect } from 'react';
import { useParams } from "@tanstack/react-router";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const steps = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
];

export const TaskWorkaroundPage = () => {
  const { taskId } = useParams({ from: '/_authenticated/tasks/$taskId' });
  const [task, setTask] = useState<any>(null);
  const [research, setResearch] = useState('');

  useEffect(() => {
    const fetchTask = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      if (data) {
        setTask(data);
        setResearch(data.description || '');
      }
    };
    fetchTask();
  }, [taskId]);

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);
    if (!error) setTask({ ...task, status: newStatus });
    else toast.error('Failed to update status');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const { data, error } = await supabase.storage
      .from('task-attachments')
      .upload(`${taskId}/${file.name}`, file);
      
    if (error) {
      toast.error('Upload failed');
      return;
    }
    
    await supabase.from('task_attachments').insert({
      task_id: taskId,
      file_url: data.path,
      file_name: file.name,
      file_type: file.type
    });
    
    toast.success('File uploaded');
  };

  if (!task) return <div>Loading...</div>;

  const currentStepIndex = steps.findIndex(s => s.id === task.status);

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">{task.title}</h1>
      
      {/* Workflow Timeline */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center gap-2">
            <div className={cn(
              "size-8 rounded-full border flex items-center justify-center",
              index <= currentStepIndex ? "bg-primary border-primary" : "border-border"
            )}>
              {index <= currentStepIndex && <Check className="size-4 text-white" />}
            </div>
            <span className="text-xs">{step.label}</span>
          </div>
        ))}
      </div>
      
      <div className="flex gap-2">
        {steps.map(step => (
          <Button key={step.id} variant={task.status === step.id ? "default" : "outline"} onClick={() => updateStatus(step.id)}>
            Mark {step.label}
          </Button>
        ))}
      </div>

      <div className="border p-4 rounded">
        <h2 className="text-lg">Attachments</h2>
        <input type="file" onChange={handleFileUpload} />
      </div>
      
      <Button variant="outline" onClick={() => window.print()}>Download Task Report</Button>
    </div>
  );
};
