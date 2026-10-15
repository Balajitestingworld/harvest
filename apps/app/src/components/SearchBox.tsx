import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export function SearchBox({
  onSearch,
  loading,
  placeholder = 'Search a product, e.g. Sony WH-1000XM5',
  initial = '',
}: {
  onSearch: (q: string) => void;
  loading: boolean;
  placeholder?: string;
  initial?: string;
}) {
  const [q, setQ] = useState(initial);
  return (
    <View className="flex-row rounded-2xl bg-surface border-2 border-ink overflow-hidden">
      <TextInput
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => onSearch(q)}
        placeholder={placeholder}
        placeholderTextColor="#8A8FA6"
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Product to search"
        className="flex-1 min-w-0 px-4 py-3.5 font-body text-ink text-base"
      />
      <Pressable
        onPress={() => onSearch(q)}
        disabled={loading}
        accessibilityRole="button"
        className="bg-ink px-4 justify-center active:bg-ink-soft"
      >
        <Text className="font-semibold text-white text-base">{loading ? 'Searching' : 'Search'}</Text>
      </Pressable>
    </View>
  );
}
