import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Fix: TypeScript error where setState is not found on class
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-8 text-center font-sans">
          <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-3xl max-w-2xl w-full shadow-2xl backdrop-blur-sm">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold mb-4">Application Error</h1>
            <p className="text-slate-300 mb-6">
              Synthesis encountered a critical error during rendering.
            </p>
            
            <div className="bg-black/50 p-4 rounded-xl text-left overflow-auto max-h-64 mb-6 border border-white/10 custom-scrollbar">
              <p className="font-mono text-red-300 font-bold text-sm mb-2 break-words">
                {this.state.error?.toString()}
              </p>
              <pre className="font-mono text-xs text-slate-500 whitespace-pre-wrap break-words">
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    // Fix: TypeScript error where props is not found on class
    return this.props.children;
  }
}