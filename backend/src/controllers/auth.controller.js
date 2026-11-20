import * as authService from '../services/auth.service.js';
import {
  validateLoginPayload,
  validateProfileUpdatePayload,
  validateRegisterPayload,
} from '../validators/auth.validator.js';

export const register = async (req, res) => {
  try {
    const validated = validateRegisterPayload(req.body);

    const newUser = await authService.registerUser({
      ...validated,
      role: 'citizen',
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
    const { email, password } = validateLoginPayload(req.body);

    const result = await authService.loginUser({ email, password });

    return res.status(200).json({
      status: 'success',
      message: 'Login berhasil!',
      data: result,
    });
  } catch (err) {
    const statusCode =
      err.message.includes('wajib diisi') ? 400 : 401;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message,
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Profil pengguna berhasil diambil.',
      data: user,
    });
  } catch (err) {
    return res.status(404).json({
      status: 'error',
      message: err.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const validated = validateProfileUpdatePayload(req.body);
    const updatedUser = await authService.updateUserProfile(req.user.id, validated);
    return res.status(200).json({
      status: 'success',
      message: 'Profil pengguna berhasil diperbarui.',
      data: updatedUser,
    });
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message,
    });
  }
};
