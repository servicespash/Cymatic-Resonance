import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full items-center justify-center p-4 text-center">
          <div className="glass-strong p-8 rounded-2xl max-w-sm">
            <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">The application encountered an unexpected error.</p>
            <button 
              className="bg-frequency text-primary-foreground px-4 py-2 rounded-lg text-sm"
              onClick={() => window.location.reload()}
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
