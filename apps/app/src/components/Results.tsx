import { ActivityIndicator, Text, View } from 'react-native';
import type { MatchedResult } from '@harvest/core';
import { ResultCard } from './ResultCard';

export function Results({
  status,
  error,
  results,
  stale,
  hasCards,
}: {
  status: 'idle' | 'loading' | 'done' | 'error';
  error: string | null;
  results: MatchedResult[];
  stale: boolean;
  hasCards: boolean;
}) {
  if (status === 'loading')
    return (
      <View className="py-10 items-center">
        <ActivityIndicator color="#1F2559" />
        <Text className="font-body text-slate mt-3">Checking prices and card offers</Text>
      </View>
    );
  if (status === 'error')
    return <Text className="font-medium text-danger py-6">{error}</Text>;
  if (status === 'done' && !results.length)
    return (
      <Text className="font-body text-slate py-6">
        Nothing found for that search. Try a shorter name or the model number.
      </Text>
    );
  if (status !== 'done') return null;

  return (
    <View className="gap-4">
      {stale && (
        <Text className="font-medium text-turmeric-deep bg-turmeric-pale rounded-xl px-4 py-2.5 text-sm">
          These prices are over 2 hours old. Search again for current ones.
        </Text>
      )}
      {!hasCards && (
        <Text className="font-body text-slate text-sm">
          Add your cards to see the price each one unlocks.
        </Text>
      )}
      {results.map((r, i) => (
        <ResultCard key={r.listing.id} result={r} best={i === 0 && r.totalDiscount > 0} />
      ))}
    </View>
  );
}
