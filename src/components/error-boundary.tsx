import React, { Component, ErrorInfo, ReactNode } from "react";
import { ErrorPandaBanner } from "@/components/supabase-env-banner";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, errorMessage: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    return (
      <>
        <ErrorPandaBanner runtimeError={this.state.errorMessage} />
        {this.props.children}
      </>
    );
  }
}
