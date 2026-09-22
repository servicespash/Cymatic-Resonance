import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TaskWorkaroundPage } from './task-workaround-page';

export const TaskModal = ({ taskId, trigger }: { taskId: string; trigger: React.ReactNode }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto h-full">
          <TaskWorkaroundPage taskId={taskId} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
