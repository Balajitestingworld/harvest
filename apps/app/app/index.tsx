import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { Landing } from '@/components/Landing';
import { getFlag } from '@/lib/prefs';

/**
 * "/" is the marketing site on web and a router on Android:
 * first launch → onboarding, otherwise straight to search.
 */
export default function Index() {
  if (Platform.OS === 'web') return <Landing />;
  return <NativeEntry />;
}

function NativeEntry() {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    getFlag('onboarded').then(setSeen);
  }, []);
  if (seen === null) return null;
  return <Redirect href={seen ? '/search' : '/onboarding'} />;
}
