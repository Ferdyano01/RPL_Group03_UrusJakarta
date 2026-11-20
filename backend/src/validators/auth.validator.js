const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Memvalidasi payload registrasi akun baru.
 */
export const validateRegisterPayload = ({ email, password, full_name, phone_number } = {}) => {
  if (!email || !password || !full_name) {
    throw new Error('Email, password, dan nama lengkap wajib diisi.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new Error('Format alamat email tidak valid.');
  }

  if (String(password).length < 8) {
    throw new Error('Password minimal 8 karakter.');
  }

  const trimmedName = String(full_name).trim();
  if (!trimmedName) {
    throw new Error('Nama lengkap wajib diisi.');
  }

  return {
    email: normalizedEmail,
    password: String(password),
    full_name: trimmedName,
    phone_number: phone_number ? String(phone_number).trim() : null,
  };
};

/**
 * Memvalidasi payload login pengguna.
 */
export const validateLoginPayload = ({ email, password } = {}) => {
  if (!email || !password) {
    throw new Error('Email dan password wajib diisi.');
  }

  return {
    email: String(email).trim().toLowerCase(),
    password: String(password),
  };
};

/**
 * Memvalidasi payload pembaruan profil pengguna.
 */
export const validateProfileUpdatePayload = ({ full_name, phone_number } = {}) => {
  const result = {};

  if (full_name !== undefined) {
    const trimmed = String(full_name).trim();
    if (!trimmed) {
      throw new Error('Nama lengkap tidak boleh kosong.');
    }
    result.full_name = trimmed;
  }

  if (phone_number !== undefined) {
    result.phone_number = phone_number ? String(phone_number).trim() : null;
  }

  return result;
};
