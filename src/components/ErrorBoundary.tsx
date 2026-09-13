'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { auditLog } from '@/lib/logger';

interface Props {
  children: ReactNode;
  /** Optional fallback UI — if not provided, uses default error card */
  fallback?: ReactNode;
  /** Context label for the audit log (e.g. 'CartDrawer', 'ProductCatalog') */
  context?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * ErrorBoundary — catches render-time React errors and:
 * 1. Shows a friendly Arabic error card instead of a white screen
 * 2. Writes an audit log entry (fire-and-forget, non-blocking)
 * 3. Provides a "Retry" button that resets state
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'خطأ غير معروف' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const context = this.props.context || 'unknown';
    console.error(`[ErrorBoundary:${context}]`, error, info.componentStack);

    // Fire-and-forget audit entry
    auditLog({
      action: 'order_status_changed', // closest generic action — will be changed to 'client_error' in future
      targetType: `client_component:${context}`,
      severity: 'error',
      errorMessage: `${error.name}: ${error.message}`,
      metadata: {
        component: context,
        stack: info.componentStack?.slice(0, 500),
      },
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <div>
            <h3 className="mb-1 text-lg font-bold text-red-800">حدث خطأ غير متوقع</h3>
            <p className="text-sm text-red-600">
              {this.state.errorMessage || 'تعذّر تحميل هذا القسم. يرجى المحاولة مرة أخرى.'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
