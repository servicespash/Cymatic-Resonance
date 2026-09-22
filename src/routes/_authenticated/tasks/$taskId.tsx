import { createFileRoute } from "@tanstack/react-router";
import { TaskWorkaroundPage } from "@/components/task-workaround-page";

function TaskWorkaroundRoute() {
  const { taskId } = Route.useParams();
  return <TaskWorkaroundPage taskId={taskId} />;
}

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  component: TaskWorkaroundRoute,
});
