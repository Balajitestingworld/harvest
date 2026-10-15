import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { bankName, networkName, PAYMENT_APPS } from '@harvest/core';
import { useVault } from '@/state/vault';
import { STORAGE_LABEL } from '@/lib/vault-storage';

export default function CardsScreen() {
  const router = useRouter();
  const { cards, locked, unlock, removeCard, apps, toggleApp, wipe } = useVault();

  const confirmRemove = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Remove ${name}?`)) removeCard(id);
      return;
    }
    Alert.alert('Remove card', `Remove ${name} from this phone?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeCard(id) },
    ]);
  };

  const confirmWipe = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Remove all cards and apps from this device?')) wipe();
      return;
    }
    Alert.alert('Wipe my data', 'Remove all cards and apps from this phone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Wipe', style: 'destructive', onPress: () => wipe() },
    ]);
  };

  if (locked) {
    return (
      <SafeAreaView className="flex-1 bg-paper px-6 justify-center">
        <Text className="font-display text-ink text-3xl">Your cards are locked</Text>
        <Text className="font-body text-slate text-base mt-2">Unlock with Face ID, fingerprint or your passcode.</Text>
        <Pressable onPress={unlock} className="bg-ink rounded-2xl py-4 mt-8 active:bg-ink-soft">
          <Text className="font-semibold text-white text-center text-lg">Unlock</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="px-5 pt-6 pb-12 gap-4">
        <Text className="font-display text-ink text-3xl">My cards</Text>
        <Text className="font-body text-slate text-sm -mt-2">{STORAGE_LABEL}. Never the card number.</Text>

        {cards.length === 0 && (
          <View className="rounded-2xl border border-dashed border-line px-5 py-8">
            <Text className="font-semibold text-ink text-lg">No cards yet</Text>
            <Text className="font-body text-slate mt-1">
              Add the cards in your wallet. It takes about ten seconds each.
            </Text>
          </View>
        )}

        {cards.map((c) => {
          const name = c.nickname || `${bankName(c.issuer)} ${c.type}`;
          return (
            <View key={c.id} className="rounded-2xl bg-ink px-5 py-5 flex-row items-center">
              <View className="flex-1">
                <Text className="font-semibold text-white text-lg">{name}</Text>
                <Text className="font-body text-white/70 text-sm mt-0.5">
                  {bankName(c.issuer)} · {networkName(c.network)} · {c.type === 'credit' ? 'Credit' : 'Debit'}
                  {c.tier ? ` · ${c.tier}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmRemove(c.id, name)}
                accessibilityLabel={`Remove ${name}`}
                className="px-3 py-2 rounded-lg active:bg-ink-soft"
              >
                <Text className="font-medium text-white/80">Remove</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable
          onPress={() => router.push('/add-card')}
          className="rounded-2xl border-2 border-ink py-4 active:bg-surface"
        >
          <Text className="font-semibold text-ink text-center text-base">Add a card</Text>
        </Pressable>

        <View className="mt-4 gap-2">
          <Text className="font-display text-ink text-2xl">UPI and wallet apps</Text>
          <Text className="font-body text-slate text-sm">
            Tick the apps you pay with. Some stores give extra off when you pay through them.
          </Text>
          <View className="flex-row flex-wrap gap-2 mt-1">
            {PAYMENT_APPS.map((a) => {
              const on = apps.includes(a.slug);
              return (
                <Pressable
                  key={a.slug}
                  onPress={() => toggleApp(a.slug)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  className={`rounded-full border px-4 py-2 ${on ? 'bg-ink border-ink' : 'bg-surface border-line'}`}
                >
                  <Text className={`font-medium text-sm ${on ? 'text-white' : 'text-ink'}`}>{a.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable onPress={confirmWipe} className="py-3 mt-2">
          <Text className="font-medium text-slate text-center text-sm">Wipe my data</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
