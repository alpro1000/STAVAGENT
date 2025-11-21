import React from 'react';
import { AlertCircle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  handleReset = () => {
    if (this.props.resetError) {
      this.props.resetError();
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { children, error: externalError } = this.props;
    const { hasError, error } = this.state;
    const activeError = externalError || error;
    const shouldShowError = hasError || !!externalError;

    if (shouldShowError) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-50">
          <div className="text-center">
            <AlertCircle size={48} className="text-red-600 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-red-900 mb-2">Chyba</h1>
            <p className="text-red-700 mb-4">
              {activeError?.message || 'Došlo k neočekávané chybě.'}
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Načíst znovu
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}
