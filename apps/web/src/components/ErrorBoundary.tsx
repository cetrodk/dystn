import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? "" } },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="font-display text-3xl font-bold">Ups!</p>
          <p className="text-[var(--color-text-muted)]">
            Noget gik galt. Prøv at genindlæse siden.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold cursor-pointer"
          >
            Genindlæs
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
