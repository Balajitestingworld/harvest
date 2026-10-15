import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { describeAlert, formatINR } from '@harvest/core';
import { useWatch } from '@/state/watch';
import { ensureNotificationPermission } from '@/lib/background';

export default function WatchScreen() {
  const { items, add, remove, checkNow, checking } = useWatch();
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<string[] | null>(null);

  const onAdd = async () => {
    const t = Number(target.replace(/[^\d]/g, ''));
    const r = await add(query, t || null);
    if (!r.ok) return setError(r.error);
    setError(null);
    setQuery('');
    setTarget('');
    ensureNotificationPermission();
  };

  const onCheck = async () => {
    const alerts = await checkNow();
    setFound(alerts.map((a) => describeAlert(a.item.query, a.alert, formatINR)));
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="px-5 pt-6 pb-12 gap-4" keyboardShouldPersistTaps="handled">
        <Text className="font-display text-ink text-3xl">Price watch</Text>
        <Text className="font-body text-slate text-sm -mt-2">
          Tell us what you want and the price you'd pay. We check from this phone and nudge you when it drops. Nothing
          about your list leaves the phone.
        </Text>

        <View className="rounded-2xl bg-surface border border-line p-4 gap-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. Sony WH-1000XM5"
            accessibilityLabel="What to watch"
            className="font-body text-ink text-base border border-line rounded-xl px-4 py-3"
          />
          <TextInput
            value={target}
            onChangeText={setTarget}
            placeholder="Target price in ₹ (optional)"
            keyboardType="number-pad"
            accessibilityLabel="Target price"
            className="font-body text-ink text-base border border-line rounded-xl px-4 py-3"
          />
          {error && <Text className="font-body text-danger text-sm">{error}</Text>}
          <Pressable onPress={onAdd} className="bg-ink rounded-xl py-3.5 active:bg-ink-soft">
            <Text className="font-semibold text-white text-center">Watch this</Text>
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text className="font-body text-slate text-sm">Nothing watched yet.</Text>
        ) : (
          <>
            {items.map((i) => (
              <View key={i.id} className="rounded-2xl bg-surface border border-line px-5 py-4 flex-row items-center">
                <View className="flex-1">
                  <Text className="font-semibold text-ink text-base">{i.query}</Text>
                  <Text className="font-body text-slate text-sm mt-0.5">
                    {i.lastPrice ? `Lowest now ${formatINR(i.lastPrice)}` : 'Not checked yet'}
                    {i.targetPrice ? ` · target ${formatINR(i.targetPrice)}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => remove(i.id)}
                  accessibilityLabel={`Stop watching ${i.query}`}
                  className="px-3 py-2 rounded-lg active:bg-paper"
                >
                  <Text className="font-medium text-slate">Remove</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={onCheck}
              disabled={checking}
              className="rounded-2xl border-2 border-ink py-3.5 active:bg-surface"
            >
              <Text className="font-semibold text-ink text-center">{checking ? 'Checking…' : 'Check prices now'}</Text>
            </Pressable>
            {found && (
              <View className="rounded-xl bg-turmeric-pale px-4 py-3 gap-1">
                {found.length === 0 ? (
                  <Text className="font-medium text-turmeric-deep text-sm">No big changes yet.</Text>
                ) : (
                  found.map((f) => (
                    <Text key={f} className="font-semibold text-turmeric-deep text-sm">
                      {f}
                    </Text>
                  ))
                )}
              </View>
            )}
          </>
        )}
        <Text className="font-body text-slate text-xs">
          Background checks run when your phone allows it, so timing isn't exact. They compare store prices; your cards
          can only make the real price lower.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
