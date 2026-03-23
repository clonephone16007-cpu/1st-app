import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ExamHQ ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-6 text-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-tint)' }}
          >
            <AlertTriangle size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: '"Lora", serif', color: 'var(--text)' }}
          >
            Something went wrong
          </h2>
          <p className="text-sm max-w-md" style={{ color: 'var(--text-muted)' }}>
            An unexpected error occurred in this section. Your data is safe.
          </p>
          {this.state.error?.message && (
            <pre
              className="text-xs px-3 py-2 rounded-lg max-w-md overflow-auto"
              style={{
                background: 'var(--bg-sidebar)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.97]"
            style={{
              background: 'var(--accent)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
