import React, { createContext, useContext, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskWorkaroundPage } from './task-workaround-page';

interface TaskModalContextType {
  openTask: (taskId: string) => void;
  closeModal: () => void;
}

const TaskModalContext = createContext<TaskModalContextType | undefined>(undefined);

export const TaskModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const openTask = (taskId: string) => setActiveTaskId(taskId);
  const closeModal = () => setActiveTaskId(null);

  return (
    <TaskModalContext.Provider value={{ openTask, closeModal }}>
      {children}
      <Dialog open={!!activeTaskId} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto">
            {activeTaskId && <TaskWorkaroundPage taskId={activeTaskId} />}
          </div>
        </DialogContent>
      </Dialog>
    </TaskModalContext.Provider>
  );
};

export const useTaskModal = () => {
  const context = useContext(TaskModalContext);
  if (!context) throw new Error('useTaskModal must be used within a TaskModalProvider');
  return context;
};
