import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

export const registerUser = async ({ email, password, full_name, role, phone_number }) => {
  // Hash password menggunakan bcrypt
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // Simpan data pengguna ke tabel public.users
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        email,
        password_hash,
        full_name,
        role: role || 'citizen',
        phone_number: phone_number || null,
      },
    ])
    .select('id, email, full_name, role, phone_number, created_at')
    .single();

  if (error) {
    if (error.code === '23505') { // Kode error PostgreSQL untuk Unique Violation
      throw new Error('Email sudah terdaftar. Silakan gunakan email lain.');
    }
    throw new Error(error.message);
  }

  return data;
};

export const loginUser = async ({ email, password }) => {
  // Cari pengguna berdasarkan email di tabel public.users
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    throw new Error('Email atau password salah.');
  }

  // Cocokkan password dengan hash yang ada di database
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Email atau password salah.');
  }

  // Buat token JWT kustom yang berisi payload data user
  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  // Hilangkan password_hash sebelum dikirim ke klien
  const { password_hash, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword,
  };
};