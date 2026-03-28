import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado ao carregar a aplicacao.',
    };
  }

  componentDidCatch(error, errorInfo) {
    // Keep diagnostics in dev to avoid a blank screen without context.
    if (import.meta.env.DEV) {
      console.error('Erro capturado no ErrorBoundary:', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: '#f8fbfb', color: '#0f172a' }}
      >
        <div className="w-full max-w-[560px] bg-white border-[3px] border-red-200 rounded-2xl p-6 shadow-lg">
          <h1 className="text-[20px] font-bold text-red-600 mb-2">O app encontrou um erro</h1>
          <p className="text-[14px] text-[#475569] mb-4">
            Evitamos a tela em branco e mantivemos o sistema ativo. Tente recarregar.
          </p>
          <div className="bg-[#f8fbfb] border border-[#e2e8f0] rounded-lg p-3 text-[12px] text-[#334155] mb-4 break-words">
            {this.state.message}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="bg-[#00a88e] hover:bg-[#00967f] text-white font-bold px-4 py-2 rounded-xl transition-colors"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

