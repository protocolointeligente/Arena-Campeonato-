const STORAGE_KEY = 'arena_rate_limit';

class TokenBucket {
  constructor({ capacity = 5, refillRate = 1 / 60000, key = 'default' } = {}) {
    this.capacity = capacity;
    this.refillRate = refillRate; // tokens per ms
    this.key = key;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.load();
  }

  load() {
    try {
      const stored = sessionStorage.getItem(`${STORAGE_KEY}_${this.key}`);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        const elapsed = now - data.lastRefill;
        this.tokens = Math.min(this.capacity, data.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
      }
    } catch {
      // Session storage is optional; continue with an in-memory bucket.
    }
  }

  save() {
    try {
      sessionStorage.setItem(`${STORAGE_KEY}_${this.key}`, JSON.stringify({
        tokens: this.tokens,
        lastRefill: this.lastRefill,
      }));
    } catch {
      // Session storage is optional; rate limiting still works in memory.
    }
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  consume(tokens = 1) {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      this.save();
      return { allowed: true, remaining: Math.floor(this.tokens), retryAfter: 0 };
    }
    const retryAfter = Math.ceil((tokens - this.tokens) / this.refillRate);
    this.save();
    return { allowed: false, remaining: 0, retryAfter };
  }

  reset() {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.save();
  }

  getStatus() {
    this.refill();
    return {
      remaining: Math.floor(this.tokens),
      capacity: this.capacity,
      resetAt: this.lastRefill + (this.capacity - this.tokens) / this.refillRate,
    };
  }
}

// Rate limiter factory for different endpoints
export function createRateLimiter(config = {}) {
  const buckets = new Map();

  return {
    check(key, options = {}) {
      const bucketKey = `${key}_${options.action || 'default'}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = new TokenBucket({
          capacity: options.capacity || config.capacity || 5,
          refillRate: options.refillRate || config.refillRate || 1 / 60000, // 1 per minute default
          key: bucketKey,
        });
        buckets.set(bucketKey, bucket);
      }
      return bucket.consume(options.tokens || 1);
    },

    getStatus(key, options = {}) {
      const bucketKey = `${key}_${options.action || 'default'}`;
      const bucket = buckets.get(bucketKey);
      return bucket ? bucket.getStatus() : { remaining: config.capacity || 5 };
    },

    reset(key, options = {}) {
      const bucketKey = `${key}_${options.action || 'default'}`;
      const bucket = buckets.get(bucketKey);
      if (bucket) {bucket.reset();}
    },
  };
}

// Pre-configured limiters
export const registrationLimiter = createRateLimiter({
  capacity: 3,        // 3 submissions
  refillRate: 1 / 300000, // 1 per 5 minutes
});

export const apiLimiter = createRateLimiter({
  capacity: 60,       // 60 requests
  refillRate: 1 / 1000,   // 1 per second
});

export const authLimiter = createRateLimiter({
  capacity: 5,        // 5 attempts
  refillRate: 1 / 900000, // 1 per 15 minutes
});

// Utility to get client fingerprint for rate limiting
export async function getClientFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('arena-fingerprint', 2, 2);
  const canvasFp = canvas.toDataURL();

  const fp = [
    navigator.userAgent,
    navigator.language,
    `${screen.width  }x${  screen.height}`,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvasFp.slice(0, 50),
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < fp.length; i++) {
    hash = ((hash << 5) - hash) + fp.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Express-like rate limit middleware for Firebase Functions
export function rateLimitMiddleware(options = {}) {
  const limiter = createRateLimiter({
    capacity: options.capacity || 100,
    refillRate: options.refillRate || 1 / 60000,
  });

  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const result = limiter.check(key, { action: options.action || 'api' });

    res.set({
      'X-RateLimit-Limit': options.capacity || 100,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': Math.ceil((Date.now() + result.retryAfter) / 1000),
    });

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfter / 1000)} seconds.`,
        retryAfter: Math.ceil(result.retryAfter / 1000),
      });
    }

    next();
  };
}

