import { esc } from '../app/utils.ts';

export class ErrorBoundary {
  constructor({ fallback, onError, logErrors = true } = {}) {
    this.fallback = fallback || this.defaultFallback;
    this.onError = onError;
    this.logErrors = logErrors;
    this.error = null;
    this.errorInfo = null;
  }

  defaultFallback(error, retry) {
    return `
      <div class="error-boundary" role="alert">
        <div class="error-content">
          <div class="error-icon" aria-hidden="true">⚠️</div>
          <h2>Algo deu errado</h2>
          <p class="error-message">${esc(error?.message || 'Erro desconhecido')}</p>
          ${error?.stack ? `<details class="error-stack"><summary>Detalhes técnicos</summary><pre>${esc(error.stack)}</pre></details>` : ''}
          <div class="error-actions">
            <button type="button" class="btn btn-primary" data-retry>Tentar novamente</button>
            <button type="button" class="btn btn-ghost" data-reload>Recarregar página</button>
            <a href="/" class="btn btn-ghost">Ir para o início</a>
          </div>
        </div>
      </div>
    `;
  }

  handleError(error, errorInfo) {
    this.error = error;
    this.errorInfo = errorInfo;

    if (this.logErrors) {
      this.logToService(error, errorInfo);
    }

    if (this.onError) {
      this.onError(error, errorInfo);
    }

    this.renderFallback();
  }

  logToService(error, errorInfo) {
    const errorData = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Send to logging service (console for now, can be replaced with Sentry, etc.)
    console.error('[ErrorBoundary]', errorData);

    // Store in sessionStorage for potential recovery
    try {
      const errors = JSON.parse(sessionStorage.getItem('arena_errors') || '[]');
      errors.push(errorData);
      if (errors.length > 50) {errors.shift();}
      sessionStorage.setItem('arena_errors', JSON.stringify(errors));
    } catch {
      // Error reporting must never prevent the fallback UI from rendering.
    }
  }

  renderFallback() {
    const root = document.getElementById('app');
    if (!root) {return;}

    const fallbackHtml = typeof this.fallback === 'function' 
      ? this.fallback(this.error, () => this.reset())
      : this.fallback;

    root.innerHTML = fallbackHtml;

    // Bind retry buttons
    root.querySelectorAll('[data-retry]').forEach(btn => {
      btn.addEventListener('click', () => this.reset());
    });
    root.querySelectorAll('[data-reload]').forEach(btn => {
      btn.addEventListener('click', () => window.location.reload());
    });
  }

  reset() {
    this.error = null;
    this.errorInfo = null;
    // Trigger app re-render by dispatching a custom event
    window.dispatchEvent(new CustomEvent('arena:error-reset'));
  }

  wrap(componentFn) {
    return (...args) => {
      try {
        return componentFn(...args);
      } catch (error) {
        this.handleError(error, { componentStack: new Error().stack });
        return null;
      }
    };
  }

  // Promise wrapper for async operations
  static async safeAsync(promise, context = {}) {
    try {
      return await promise;
    } catch (error) {
      const enrichedError = new Error(`${context.operation || 'Async operation'} failed: ${error.message}`);
      enrichedError.stack = error.stack;
      enrichedError.originalError = error;
      enrichedError.context = context;
      throw enrichedError;
    }
  }
}

// Global error handler for unhandled promise rejections
export function setupGlobalErrorHandlers(errorBoundary) {
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    errorBoundary.handleError(
      new Error(`Unhandled promise rejection: ${event.reason?.message || event.reason}`),
      { type: 'unhandledrejection', reason: event.reason }
    );
  });

  window.addEventListener('error', (event) => {
    if (event.target !== window) {return;} // Only handle global errors
    errorBoundary.handleError(
      event.error || new Error(event.message),
      { type: 'global', filename: event.filename, lineno: event.lineno, colno: event.colno }
    );
  });
}

// Error display component for inline errors
export function ErrorDisplay({ message, type = 'error', dismissible = true, onDismiss }) {
  const el = document.createElement('div');
  el.className = `error-display error-display-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  
  el.innerHTML = `
    <span class="error-display-icon" aria-hidden="true">
      ${type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
    </span>
    <span class="error-display-message">${esc(message)}</span>
    ${dismissible ? '<button type="button" class="error-display-close" aria-label="Fechar">✕</button>' : ''}
  `;

  if (dismissible) {
    el.querySelector('.error-display-close').addEventListener('click', () => {
      el.remove();
      onDismiss?.();
    });
  }

  return el;
}

// Network error helper
export function handleNetworkError(error, fallbackMessage = 'Erro de conexão. Verifique sua internet.') {
  if (!navigator.onLine) {
    return new Error('Você está offline. Verifique sua conexão.');
  }
  
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return new Error(fallbackMessage);
  }
  
  if (error.code === 'permission-denied') {
    return new Error('Permissão negada. Verifique suas credenciais.');
  }
  
  if (error.code === 'unavailable') {
    return new Error('Serviço temporariamente indisponível. Tente novamente.');
  }
  
  return error;
}

