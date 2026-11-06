import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import {
  registerUserApi,
  loginUserApi,
  loginOrRegisterDemoUser,
} from '@/services/api';

export default function SignUp() {
  const [mode, setMode] = useState<'signup' | 'login'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('warga@jakarta.id');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email dan password wajib diisi.');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setErrorMsg('Nama lengkap wajib diisi untuk pendaftaran.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await registerUserApi({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          phone_number: phoneNumber.trim() || undefined,
        });
      }
      await loginUserApi({
        email: email.trim(),
        password,
      });
      router.replace('/beranda');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginOrRegisterDemoUser();
      router.replace('/beranda');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk dengan akun demo.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setErrorMsg(null);
    if (mode === 'login') {
      setMode('signup');
      setEmail('');
      setPassword('');
    } else {
      setMode('login');
      setEmail('warga@jakarta.id');
      setPassword('Password123!');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        <Text style={styles.title}>{mode === 'signup' ? 'SIGN UP' : 'MASUK'}</Text>

        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        )}

        {/* Form Nama (Hanya saat Sign Up) */}
        {mode === 'signup' && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nama</Text>
            <TextInput
              style={styles.input}
              placeholder="Masukkan Nama Lengkap"
              placeholderTextColor="#666"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
        )}

        {/* Form Email */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan Email"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Form No Telepon (Opsional saat Sign Up) */}
        {mode === 'signup' && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>No. Telepon (Opsional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Contoh: 081234567890"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>
        )}

        {/* Form Password */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Tombol Utama (Daftar / Masuk) */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'signup' ? 'Daftar' : 'Masuk'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Tombol Cepat Akun Demo Warga */}
        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleQuickDemoLogin}
          disabled={loading}>
          <Text style={styles.demoButtonText}>
            ⚡ Masuk Cepat Akun Demo Warga
          </Text>
        </TouchableOpacity>

        {/* Teks Footer Toggle Mode */}
        <TouchableOpacity onPress={toggleMode} style={styles.footerBtn}>
          <Text style={styles.footerText}>
            {mode === 'signup'
              ? 'Sudah punya akun? Masuk di sini'
              : 'Belum punya akun? Daftar Baru'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 30,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 30,
    color: '#000',
    letterSpacing: 1,
  },
  errorBanner: {
    backgroundColor: '#FCA5A5',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  errorText: {
    fontWeight: '900',
    color: '#000',
    fontSize: 13,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
    color: '#000',
  },
  input: {
    backgroundColor: '#E5E7EB',
    borderWidth: 3,
    borderColor: '#FF5E00',
    padding: 15,
    fontSize: 16,
    color: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  button: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    padding: 15,
    marginTop: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  demoButton: {
    backgroundColor: '#C1FF72',
    borderWidth: 3,
    borderColor: '#000',
    padding: 12,
    marginTop: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  footerBtn: {
    marginTop: 25,
    padding: 8,
  },
  footerText: {
    textAlign: 'center',
    fontWeight: '900',
    color: '#000',
    textDecorationLine: 'underline',
  },
});
