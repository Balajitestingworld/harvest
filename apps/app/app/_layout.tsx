import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useEffect } from 'react';
import { VaultProvider } from '@/state/vault';
import { WatchProvider } from '@/state/watch';
import { registerWatchTask } from '@/lib/background';

export default function RootLayout() {
  const [loaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_800ExtraBold,
  });
  useEffect(() => {
    registerWatchTask();
  }, []);
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <VaultProvider>
        <WatchProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F6FA' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-card" options={{ presentation: 'modal' }} />
        </Stack>
        </WatchProvider>
      </VaultProvider>
    </SafeAreaProvider>
  );
}
