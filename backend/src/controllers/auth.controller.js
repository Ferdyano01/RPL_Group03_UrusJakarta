import * as authService from '../services/auth.service.js';

export const register = async (req, res) => {
  try {
    const { email, password, full_name, phone_number } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, password, dan nama lengkap wajib diisi.',
      });
    }

    const newUser = await authService.registerUser({
      email,
      password,
      full_name,
      phone_number,
      role: 'citizen'
    });

    return res.status(201).json({
      status: 'success',
      message: 'Registrasi berhasil!',
      data: newUser,
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email dan password wajib diisi.',
      });
    }

    const result = await authService.loginUser({ email, password });

    return res.status(200).json({
      status: 'success',
      message: 'Login berhasil!',
      data: result,
    });
  } catch (err) {
    return res.status(401).json({
      status: 'error',
      message: err.message,
    });
  }
};