import React from "react";
import { toast } from "sonner";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    // @ts-ignore
    window.__lastError = error;
    toast.error("An unexpected error occurred. Please refresh.");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="glass-strong rounded-2xl p-8 text-center border-2 border-red-500/50 shadow-2xl shadow-red-900/20">
            <h1 className="font-display text-2xl font-semibold text-red-500">System interrupted</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please try refreshing the page or contact support.</p>
            <div className="mt-6 text-left">
              <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">Technical Details:</p>
              <pre className="text-[10px] text-red-300 font-mono bg-black/80 p-4 rounded-lg overflow-auto max-h-60 border border-red-900/50">
                {/* @ts-ignore */}
                {window.__lastError?.message || "Unknown error"}
                {"\n\n"}
                {/* @ts-ignore */}
                {JSON.stringify(window.__lastError, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
