import { createFileRoute } from "@tanstack/react-router";
import { RegistryExport } from "@/components/registry-export";

export const Route = createFileRoute("/_authenticated/reporting")({
  component: ReportingPage,
});

function ReportingPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reporting Module</h1>
      <RegistryExport />
      <div className="bg-black/5 rounded-xl border border-white/5 p-4">
        <h3 className="font-semibold mb-3">Activity Logs</h3>
        <div className="text-muted-foreground text-sm">
          Tabulated activity log interface would go here.
        </div>
      </div>
    </div>
  );
}
