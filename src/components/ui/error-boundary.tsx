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
    toast.error("An unexpected error occurred. Please refresh.");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="glass-strong rounded-2xl p-8 text-center">
            <h1 className="font-display text-xl font-semibold">System interrupted</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please try refreshing the page.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
