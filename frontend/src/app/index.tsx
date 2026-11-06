import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { checkSystemHealth, getAuthToken } from '@/services/api';

export default function Index() {
  const [health, setHealth] = useState<{
    backendOnline: boolean;
    aiOnline: boolean;
    modelLoaded: boolean;
  } | null>(null);

  useEffect(() => {
    checkSystemHealth().then(setHealth);
  }, []);

  const handleStart = () => {
    if (getAuthToken()) {
      router.push('/beranda' as any);
    } else {
      router.push('/signup');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>URUS</Text>
        <Text style={styles.logoText}>JAKARTA</Text>
      </View>

      <Text style={styles.subtitle}>
        Sistem Pelaporan Jalan Rusak Berbasis AI (YOLO Vision)
      </Text>

      {health && (
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: health.backendOnline ? '#C1FF72' : '#FCA5A5' },
            ]}>
            <Text style={styles.statusChipText}>
              Backend API: {health.backendOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: health.aiOnline ? '#C1FF72' : '#FFD700' },
            ]}>
            <Text style={styles.statusChipText}>
              Road-AI YOLO: {health.aiOnline ? 'READY' : 'FALLBACK MODE'}
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.navButton} onPress={handleStart}>
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
    padding: 24,
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
  subtitle: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  statusChip: {
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  navButton: {
    marginTop: 40,
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
  },
});
