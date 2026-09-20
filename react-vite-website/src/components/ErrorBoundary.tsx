import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logger } from '../lib/logger';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('react', 'ErrorBoundary', 'Uncaught rendering error', error, { componentStack: errorInfo.componentStack });
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-zinc-950 p-4 font-sans antialiased text-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
              <AlertTriangle size={32} />
            </div>
            
            <div className="space-y-1.5 w-full">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Something went wrong</h2>
              <p className="text-sm text-slate-500 font-medium">
                The application encountered an unexpected error and could not recover.
              </p>
              <div className="w-full bg-slate-100 p-3 rounded-lg overflow-x-auto text-left max-h-[300px] overflow-y-auto mt-4">
                <code className="text-xs text-rose-600 whitespace-pre-wrap break-all">
                  {this.state.error?.toString()}
                </code>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-slate-700 mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </div>

            <div className="w-full bg-slate-50 rounded-lg border border-slate-200 p-3 text-left overflow-auto max-h-32 mt-2">
              <p className="text-[10px] font-mono text-rose-600 whitespace-pre-wrap break-words">
                {this.state.error?.toString() || 'Unknown Error'}
              </p>
            </div>

            <button
              onClick={this.handleReload}
              className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
