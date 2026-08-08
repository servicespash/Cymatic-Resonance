import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <h1 className="font-display text-xl font-semibold">Resonance interrupted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went out of phase while rendering this view.
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground break-words">
            {error.message}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="inline-flex items-center justify-center rounded-md bg-frequency px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") window.location.href = "/";
              }}
              className="inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm font-medium"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
