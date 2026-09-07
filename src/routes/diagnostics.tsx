import { createFileRoute } from '@tanstack/react-router';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const Route = createFileRoute('/diagnostics')({
  component: DiagnosticsPanel,
});

function DiagnosticsPanel() {
  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  const isConfigured = !!envVars.VITE_SUPABASE_URL && (!!envVars.VITE_SUPABASE_ANON_KEY || !!envVars.VITE_SUPABASE_PUBLISHABLE_KEY);

  const maskString = (str?: string) => {
    if (!str) return 'Not set';
    if (str.length < 8) return '***';
    return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center space-x-3 pb-4 border-b border-border">
          <Info className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Environment Diagnostics</h1>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
            <span className="font-mono text-sm font-medium">Supabase Configuration</span>
            {isConfigured ? (
              <span className="flex items-center text-sm font-medium text-green-500">
                <CheckCircle className="mr-2 h-4 w-4" /> Ready
              </span>
            ) : (
              <span className="flex items-center text-sm font-medium text-amber-500">
                <AlertTriangle className="mr-2 h-4 w-4" /> Missing Keys
              </span>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex flex-col space-y-1">
                <span className="text-xs font-medium text-muted-foreground">{key}</span>
                <span className="font-mono text-sm text-foreground">
                  {key.includes('URL') ? value || 'Not set' : maskString(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
