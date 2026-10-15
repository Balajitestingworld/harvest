import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SearchBox } from '@/components/SearchBox';
import { Results } from '@/components/Results';
import { useSearch } from '@/state/useSearch';
import { useVault } from '@/state/vault';
import { USING_DEMO_DATA } from '@/lib/api';
import { getFlag, setFlag } from '@/lib/prefs';
import { useWatch } from '@/state/watch';

export default function SearchScreen() {
  const router = useRouter();
  const { cards, locked, unlock, apps } = useVault();
  const { add: addWatch } = useWatch();
  const [includeEmi, setEmi] = useState(false);
  const [includeExchange, setExchange] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const s = useSearch(locked ? [] : cards, { paymentApps: locked ? [] : apps, includeEmi, includeExchange });

  useEffect(() => {
    getFlag('includeEmi').then(setEmi);
    getFlag('includeExchange').then(setExchange);
  }, []);

  const flip = (key: string, on: boolean, set: (v: boolean) => void) => {
    set(on);
    setFlag(key, on);
  };
  const onSearch = (q: string) => {
    setLastQuery(q.trim());
    setWatchMsg(null);
    return s.run(q);
  };
  const onWatch = async () => {
    const r = await addWatch(lastQuery);
    setWatchMsg(r.ok ? 'Added to Price watch.' : r.error);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="px-5 pt-6 pb-12 gap-5" keyboardShouldPersistTaps="handled">
        <Text className="font-display text-ink text-3xl">What are you buying?</Text>
        <SearchBox onSearch={onSearch} loading={s.status === 'loading'} />

        {locked ? (
          <Pressable onPress={unlock} className="rounded-xl border border-line bg-surface px-4 py-3 active:bg-paper">
            <Text className="font-medium text-ink">Unlock your cards to see your prices</Text>
          </Pressable>
        ) : cards.length === 0 ? (
          <Pressable
            onPress={() => router.push('/add-card')}
            className="rounded-xl border border-line bg-surface px-4 py-3 active:bg-paper"
          >
            <Text className="font-medium text-ink">Add a card to unlock its offers</Text>
          </Pressable>
        ) : (
          <Text className="font-body text-slate text-sm">
            Matching against {cards.length} {cards.length === 1 ? 'card' : 'cards'} on this phone
          </Text>
        )}

        <View className="flex-row gap-2">
          {[
            { label: 'Include EMI offers', on: includeEmi, set: () => flip('includeEmi', !includeEmi, setEmi) },
            { label: 'Include exchange offers', on: includeExchange, set: () => flip('includeExchange', !includeExchange, setExchange) },
          ].map((t) => (
            <Pressable
              key={t.label}
              onPress={t.set}
              accessibilityRole="switch"
              accessibilityState={{ checked: t.on }}
              className={`rounded-full border px-3 py-1.5 ${t.on ? 'bg-ink border-ink' : 'bg-surface border-line'}`}
            >
              <Text className={`font-medium text-xs ${t.on ? 'text-white' : 'text-ink'}`}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Results
          status={s.status}
          error={s.error}
          results={s.results}
          stale={s.stale}
          hasCards={!locked && cards.length > 0}
        />

        {s.status === 'done' && lastQuery && (
          <View>
            <Pressable onPress={onWatch} className="rounded-xl border border-ink py-3 active:bg-surface">
              <Text className="font-semibold text-ink text-center">Watch this price</Text>
            </Pressable>
            {watchMsg && <Text className="font-body text-slate text-xs mt-2 text-center">{watchMsg}</Text>}
          </View>
        )}

        {USING_DEMO_DATA && (
          <Text className="font-body text-slate text-xs">
            Demo prices and sample offers. Connect the search service to see live data.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
