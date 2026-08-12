import { Card } from "@/components/ui/card";

export function TasksPanel({ orgId, userId, isAdmin, members }: { orgId: string, userId: string, isAdmin: boolean, members: any[] }) {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold">Tasks</h3>
      <p className="text-sm text-muted-foreground">Task management functionality coming soon.</p>
    </Card>
  );
}
