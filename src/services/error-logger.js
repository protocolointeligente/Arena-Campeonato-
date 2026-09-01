const ERROR_QUEUE_KEY = 'arena_error_queue';
const MAX_QUEUE_SIZE = 100;

class ErrorLogger {
  constructor({ endpoint = null, batchSize = 10, flushInterval = 30000, alertThreshold = 5, alertWindowMs = 60000, onAlert = null } = {}) {
    this.endpoint = endpoint;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.alertThreshold = alertThreshold;
    this.alertWindowMs = alertWindowMs;
    this.onAlert = onAlert;
    this.queue = [];
    this.flushTimer = null;
    this.init();
  }

  init() {
    this.loadQueue();
    this.startFlushTimer();
    this.setupBeforeUnload();
  }

  loadQueue() {
    try {
      const stored = sessionStorage.getItem(ERROR_QUEUE_KEY);
      this.queue = stored ? JSON.parse(stored) : [];
    } catch {
      this.queue = [];
    }
  }

  saveQueue() {
    try {
      sessionStorage.setItem(ERROR_QUEUE_KEY, JSON.stringify(this.queue.slice(-MAX_QUEUE_SIZE)));
    } catch {
      // Storage may be unavailable in private browsing or restricted contexts.
    }
  }

  log(error, context = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack,
      name: error?.name || 'Error',
      code: error?.code,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        ...context,
      },
    };

    this.queue.push(entry);
    const recentErrors = this.queue.filter((item) => Date.parse(item.timestamp) >= Date.now() - this.alertWindowMs);
    if (this.onAlert && recentErrors.length === this.alertThreshold) {this.onAlert({ type: 'error_spike', count: recentErrors.length, windowMs: this.alertWindowMs, last: entry });}
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue.shift();
    }
    this.saveQueue();
    this.maybeFlush();

    // Also log to console in development
    if (import.meta.env?.DEV) {
      console.error('[ErrorLogger]', entry);
    }
  }

  logWarning(message, context = {}) {
    this.log(new Error(message), { level: 'warning', ...context });
  }

  logInfo(message, context = {}) {
    this.log(new Error(message), { level: 'info', ...context });
  }

  maybeFlush() {
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush() {
    if (!this.endpoint || this.queue.length === 0) {return;}

    const batch = this.queue.splice(0, this.batchSize);
    this.saveQueue();

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors: batch }),
        keepalive: true,
      });
    } catch (err) {
      // Re-queue on failure
      this.queue.unshift(...batch);
      this.saveQueue();
      console.error('[ErrorLogger] Failed to flush:', err);
    }
  }

  startFlushTimer() {
    if (this.flushTimer) {clearInterval(this.flushTimer);}
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
  }

  stopFlushTimer() {
    if (this.flushTimer) {clearInterval(this.flushTimer);}
  }

  setupBeforeUnload() {
    window.addEventListener('beforeunload', () => this.flush());
  }

  getErrors() {
    return [...this.queue].reverse();
  }

  getHealth() {
    return { queued: this.queue.length, endpointConfigured: !!this.endpoint, online: navigator.onLine, lastError: this.queue[0] || null };
  }

  clear() {
    this.queue = [];
    this.saveQueue();
  }
}

// Singleton instance
let loggerInstance = null;

export function getErrorLogger(config) {
  if (!loggerInstance) {
    loggerInstance = new ErrorLogger(config);
  }
  return loggerInstance;
}

export function logError(error, context) {
  return getErrorLogger().log(error, context);
}

export function logWarning(message, context) {
  return getErrorLogger().logWarning(message, context);
}

export function logInfo(message, context) {
  return getErrorLogger().logInfo(message, context);
}

// Custom error classes
export class AppError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
  }
}

export class ValidationError extends AppError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

export class PermissionError extends AppError {
  constructor(message, resource, action) {
    super(message, 'PERMISSION_DENIED', { resource, action });
    this.name = 'PermissionError';
  }
}

export class NetworkError extends AppError {
  constructor(message, originalError) {
    super(message, 'NETWORK_ERROR', { originalError: originalError?.message });
    this.name = 'NetworkError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} não encontrado`, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

