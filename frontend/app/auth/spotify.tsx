import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function SpotifyAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.code) {
      router.replace('/');
    }
  }, [params, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Processing Spotify authentication...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
  },
});