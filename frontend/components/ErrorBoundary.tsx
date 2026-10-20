"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Report to Sentry with the React component stack so the Sentry event
    // points to the exact component that threw, not just the generic boundary.
    Sentry.captureException(error, {
      tags: { errorBoundary: "inline" },
      extra: {
        // componentStack shows the React tree path to the failing component.
        componentStack: info.componentStack ?? undefined,
      },
    });

    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <section className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-start justify-center gap-6 rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">
              Error
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Retry
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
