import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[40vh] items-center justify-center px-4 py-10">
          <div className="glass-panel mx-auto w-full max-w-md rounded-2xl p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-7 w-7 text-red-500" />
            </div>
            <h2 className="mb-2 font-headline text-lg font-bold text-on-surface">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-on-surface-variant">
              An unexpected error occurred. Try refreshing the page or click the
              button below.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
