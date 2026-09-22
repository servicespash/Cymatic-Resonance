import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Trash2, Download, ChevronRight, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Progress } from "@/components/ui/progress";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useDropzone } from 'react-dropzone';

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
  const [activity, setActivity] = useState<any[]>([]);

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
      
      const { data: actData } = await supabase.from('task_activity').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
      if (actData) setActivity(actData);
    };
    fetchData();

    // Realtime subscription for task and activity
    const taskChannel = supabase.channel(`task-${taskId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, (payload) => {
        setTask(payload.new);
        setResearch(payload.new.task_notes || '');
    }).subscribe();
    
    const activityChannel = supabase.channel(`activity-${taskId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_activity', filter: `task_id=eq.${taskId}` }, (payload) => {
        setActivity(prev => [...prev, payload.new]);
    }).subscribe();

    return () => { supabase.removeChannel(taskChannel); supabase.removeChannel(activityChannel); };
  }, [taskId]);

  const advanceStatus = async () => {
    const currentIndex = steps.findIndex(s => s.id === task.status);
    if (currentIndex < steps.length - 1) {
      const nextStatus = steps[currentIndex + 1].id;
      await supabase.from('tasks').update({ status: nextStatus }).eq('id', taskId);
      await supabase.from('task_activity').insert({ task_id: taskId, status: nextStatus });
    }
  };

  const saveNotes = async () => {
    const { error } = await supabase.from('tasks').update({ task_notes: research }).eq('id', taskId);
    if (!error) toast.success('Notes saved');
    else toast.error('Failed to save notes');
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
        const { data, error } = await supabase.storage.from('task-attachments').upload(`${taskId}/${file.name}`, file);
        if (error) { toast.error(`Upload failed: ${file.name}`); continue; }
        await supabase.from('task_attachments').insert({ task_id: taskId, file_url: data.path, file_name: file.name, file_type: file.type });
    }
    toast.success('Files uploaded');
    const { data: attData } = await supabase.from('task_attachments').select('*').eq('task_id', taskId);
    if (attData) setAttachments(attData);
  }, [taskId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const deleteAttachment = async (id: string, path: string) => {
    await supabase.storage.from('task-attachments').remove([path]);
    await supabase.from('task_attachments').delete().eq('id', id);
    setAttachments(attachments.filter(a => a.id !== id));
    toast.success('File deleted');
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text(`Task Report: ${task.title}`, 10, 10);
    doc.text(`Status: ${task.status}`, 10, 20);
    doc.text(`Notes:`, 10, 30);
    doc.text(research, 10, 40);
    (doc as any).autoTable({ head: [['File Name']], body: attachments.map(a => [a.file_name]), startY: 70 });
    doc.save(`${task.title}_report.pdf`);
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
        <h2 className="text-lg">Activity Timeline</h2>
        <ul className="space-y-2">
            {activity.map(act => <li key={act.id} className="text-xs">{act.status} at {new Date(act.created_at).toLocaleString()}</li>)}
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg">Research / Notes</h2>
        <Textarea value={research} onChange={(e) => setResearch(e.target.value)} placeholder="Do your research and notes here..." className="h-64" />
        <Button onClick={saveNotes}>Save Progress</Button>
      </div>

      <div className="border p-4 rounded space-y-4">
        <h2 className="text-lg">Attachments</h2>
        <div {...getRootProps()} className={cn("border-2 border-dashed p-6 text-center cursor-pointer", isDragActive ? "border-primary" : "border-border")}>
            <input {...getInputProps()} />
            <Upload className="mx-auto size-8 mb-2 text-muted-foreground" />
            <p>Drag & drop files here, or click to select</p>
        </div>
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
      
      <Button onClick={generatePDF} className="w-full">Download Report</Button>
    </div>
  );
};
