import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router'; // Tambahkan router di sini

export default function SignUp() {
  return (
    <View style={styles.container}>
      {/* Menyembunyikan header navigasi bawaan */}
      <Stack.Screen options={{ headerShown: false }} />
      
      <Text style={styles.title}>SIGN UP</Text>

      {/* Form Nama */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Nama</Text>
        <TextInput style={styles.input} placeholder="Masukkan Nama" placeholderTextColor="#666" />
      </View>

      {/* Form Email */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} placeholder="Masukkan Email" placeholderTextColor="#666" keyboardType="email-address" />
      </View>

      {/* Form Password */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} placeholder="Masukkan Password" placeholderTextColor="#666" secureTextEntry />
      </View>

      {/* Tombol Daftar */}
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.replace('/beranda')} // Navigasi ke halaman beranda
      >
        <Text style={styles.buttonText}>Daftar</Text>
      </TouchableOpacity>

      {/* Teks Footer */}
      <Text style={styles.footerText}>Sudah punya akun? Masuk</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Latar terang
    padding: 30,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '900', // Sangat tebal
    textAlign: 'center',
    marginBottom: 40,
    color: '#000',
    letterSpacing: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
    color: '#000',
  },
  input: {
    backgroundColor: '#E5E7EB', // Abu-abu pucat untuk isi kolom
    borderWidth: 3,
    borderColor: '#FF5E00', // Garis tepi oranye Neobrutalisme
    padding: 15,
    fontSize: 16,
    color: '#000',
    // Bayangan kotak hitam khas Neobrutalisme
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  button: {
    backgroundColor: '#fff', // Latar tombol putih
    borderWidth: 3,
    borderColor: '#000', // Garis tepi hitam
    padding: 15,
    marginTop: 20,
    alignItems: 'center',
    // Bayangan kotak hitam
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
  footerText: {
    textAlign: 'center',
    marginTop: 25,
    fontWeight: 'bold',
    color: '#000',
  }
});