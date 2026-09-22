import { createFileRoute } from "@tanstack/react-router";
import { TaskWorkaroundPage } from "@/components/task-workaround-page";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  component: TaskWorkaroundPage,
});
