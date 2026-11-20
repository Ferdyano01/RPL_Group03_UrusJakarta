/**
 * Middleware rate limiter in-memory sederhana (tanpa dependensi eksternal)
 * untuk mencegah brute-force autentikasi dan penyalahgunaan resource AI.
 */
export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  maxRequests = 100,
  message = 'Terlalu banyak permintaan dari IP Anda. Silakan coba lagi beberapa saat lagi.',
} = {}) => {
  const hits = new Map();

  // Pembersihan berkala entri yang sudah kedaluwarsa agar memori tetap terjaga
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now >= entry.resetAt) {
        hits.delete(key);
      }
    }
  }, Math.min(windowMs, 5 * 60 * 1000));
  cleanupTimer.unref?.();

  return (req, res, next) => {
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }

    const clientKey = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const existing = hits.get(clientKey);

    if (!existing || now >= existing.resetAt) {
      hits.set(clientKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        status: 'error',
        message,
      });
    }

    return next();
  };
};
