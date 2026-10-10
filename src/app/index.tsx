import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>URUS</Text>
        <Text style={styles.logoText}>JAKARTA</Text>
      </View>

      <TouchableOpacity 
        style={styles.navButton} 
        onPress={() => router.push('/signup')}
      >
        <Text style={styles.navButtonText}>Mulai →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    backgroundColor: '#FF5E00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 4,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    letterSpacing: 2,
  },
  navButton: {
    marginTop: 50,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 30,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  navButtonText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
  }
});