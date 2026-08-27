import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] p-6 text-red-400 font-mono text-xs">
          <h2 className="text-sm font-bold uppercase tracking-wider text-red-500">
            Application Crash
          </h2>
          <pre className="mt-3 max-w-lg overflow-x-auto rounded border border-red-900/40 bg-red-950/20 p-4">
            {this.state.error?.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = AppErrorBoundary;
