import { Router } from 'express';
import { register, login, getMe, updateProfile } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Terlalu banyak percobaan autentikasi. Silakan coba lagi beberapa menit lagi.',
});

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);
router.patch('/profile', requireAuth, updateProfile);

export default router;
