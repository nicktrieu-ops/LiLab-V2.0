import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  variant?: 'fullscreen' | 'section';
  sectionLabel?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected display error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('LiLab Portal ErrorBoundary caught error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.variant === 'section') {
        return (
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-6 sm:p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#BE123C] flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-display text-base font-bold text-[#172154]">
                {this.props.sectionLabel
                  ? `${this.props.sectionLabel} encountered an error`
                  : 'This panel could not be displayed'}
              </h3>
              <p className="text-xs text-[#525E80] break-words">{this.state.message}</p>
            </div>
            <div className="pt-1 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Panel
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#F8F9FB] text-[#172154] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#172154]/10 rounded-2xl p-6 sm:p-8 space-y-5 text-center">
            <img
              src="/assets/lilab_logo.png"
              alt="LiLab Creative Talent Academy"
              referrerPolicy="no-referrer"
              className="h-11 w-auto mx-auto object-contain"
            />
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-bold text-[#172154]">
                Something went wrong / Đã xảy ra lỗi hiển thị
              </h2>
              <p className="text-xs text-[#525E80] break-words leading-relaxed">
                {this.state.message}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg border border-[#172154]/15 text-xs font-semibold text-[#172154] hover:bg-[#F2F4F8] cursor-pointer transition-colors"
              >
                Try Again / Thử lại
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-[#FF6B00] text-white text-xs font-semibold hover:bg-[#E05A00] cursor-pointer transition-colors"
              >
                Reload Portal / Tải lại
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
