import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { getJwtSecret } from '../config/jwt.js';
import {
  readLocalDb,
  writeLocalDb,
  shouldFallbackToLocal,
  setStorageMode,
} from '../config/localStore.js';

const SALT_ROUNDS = 10;

export const registerUser = async ({ email, password, full_name, phone_number, role = 'citizen' }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // Simpan data pengguna ke tabel public.users menggunakan klien server (bypass RLS)
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([
      {
        email: normalizedEmail,
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

    if (shouldFallbackToLocal(error)) {
      setStorageMode('local_fallback');
      const db = readLocalDb();
      const exists = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (exists) {
        throw new Error('Email sudah terdaftar. Silakan gunakan email lain.');
      }

      const now = new Date().toISOString();
      const newUser = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        password_hash,
        full_name,
        role: role || 'citizen',
        phone_number: phone_number || null,
        created_at: now,
        updated_at: now,
      };
      db.users.push(newUser);
      writeLocalDb(db);

      const { password_hash: _ph, ...safeUser } = newUser;
      return safeUser;
    }

    throw new Error(error.message);
  }

  setStorageMode('supabase');
  return data;
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Cari pengguna berdasarkan email di tabel public.users
  let { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', normalizedEmail)
    .single();

  if (error && shouldFallbackToLocal(error)) {
    setStorageMode('local_fallback');
    const db = readLocalDb();
    user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail) || null;
    error = null;
  } else if (!error) {
    setStorageMode('supabase');
  }

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

  const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '7d' });

  // Hilangkan password_hash sebelum dikirim ke klien
  const { password_hash, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword,
  };
};

export const getUserById = async (userId) => {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, phone_number, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error && shouldFallbackToLocal(error)) {
    setStorageMode('local_fallback');
    const db = readLocalDb();
    const localUser = db.users.find((u) => u.id === userId);
    if (!localUser) {
      throw new Error('Pengguna tidak ditemukan.');
    }
    const { password_hash, ...safeUser } = localUser;
    return safeUser;
  }

  if (error || !user) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  setStorageMode('supabase');
  return user;
};

export const updateUserProfile = async (userId, { full_name, phone_number }) => {
  const updates = {
    updated_at: new Date().toISOString(),
  };
  if (full_name !== undefined && full_name.trim() !== '') {
    updates.full_name = full_name.trim();
  }
  if (phone_number !== undefined) {
    updates.phone_number = phone_number ? phone_number.trim() : null;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, email, full_name, role, phone_number, created_at, updated_at')
    .single();

  if (error && shouldFallbackToLocal(error)) {
    setStorageMode('local_fallback');
    const db = readLocalDb();
    const idx = db.users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      throw new Error('Pengguna tidak ditemukan.');
    }
    db.users[idx] = {
      ...db.users[idx],
      ...updates,
    };
    writeLocalDb(db);
    const { password_hash, ...safeUser } = db.users[idx];
    return safeUser;
  }

  if (error || !data) {
    throw new Error(error?.message || 'Gagal memperbarui profil.');
  }

  setStorageMode('supabase');
  return data;
};