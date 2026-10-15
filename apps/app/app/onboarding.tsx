import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setFlag } from '@/lib/prefs';
import { useVault } from '@/state/vault';
import { BIOMETRICS_AVAILABLE, LOCK_NAME } from '@/lib/auth';

/** PRD Onboarding: explain the privacy model, then ask for the biometric unlock. */
export default function Onboarding() {
  const router = useRouter();
  const { unlock } = useVault();

  const start = async () => {
    const ok = await unlock();
    if (!ok) return;
    await setFlag('onboarded');
    router.replace('/cards');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="px-6 pt-10 pb-8 grow">
        <Text className="font-display text-ink text-4xl leading-tight">
          Your cards already have discounts. Harvest finds them.
        </Text>
        <Text className="font-body text-slate text-lg mt-4 leading-relaxed">
          Tell Harvest which cards you carry. When you search for something, it works out the lowest
          price each card unlocks on Amazon, Flipkart and Croma.
        </Text>

        <View className="mt-10 gap-6">
          <Point title="Your cards stay on this phone">
            We store the bank, network and card type, encrypted on your device. Never the card number.
          </Point>
          <Point title="We only see what you search for">
            Our server sends back every offer it knows. Your phone picks the ones that fit your cards.
          </Point>
          <Point title="No account, no name, no email">
            There's nothing to sign up for, so there's nothing about you to leak.
          </Point>
        </View>

        <View className="flex-1" />
        <Pressable
          onPress={start}
          accessibilityRole="button"
          className="bg-ink rounded-2xl py-4 mt-10 active:bg-ink-soft"
        >
          <Text className="font-semibold text-white text-center text-lg">
            {BIOMETRICS_AVAILABLE ? `Lock my cards with ${LOCK_NAME}` : 'Add my cards'}
          </Text>
        </Pressable>
        <Text className="font-body text-slate text-sm text-center mt-3">
          Uses your phone's own Face ID, fingerprint or passcode.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Point({ title, children }: { title: string; children: string }) {
  return (
    <View className="border-l-4 border-turmeric pl-4">
      <Text className="font-semibold text-ink text-lg">{title}</Text>
      <Text className="font-body text-slate text-base mt-1 leading-relaxed">{children}</Text>
    </View>
  );
}
