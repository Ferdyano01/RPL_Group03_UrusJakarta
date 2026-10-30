import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const token = authHeader.split(' ')[1];

    // Verifikasi token JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Melampirkan data payload user ke objek req
    req.user = decoded; // Berisi { id, email, role, full_name }
    
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Token tidak valid atau telah kadaluwarsa.' });
  }
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        status: 'error', 
        message: `Akses ditolak. Endpoint ini khusus untuk peran: ${allowedRoles.join(', ')}.` 
      });
    }
    next();
  };
};