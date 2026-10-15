import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BANKS, NETWORKS, containsPan, PAN_ERROR, type CardType, type Network } from '@harvest/core';
import { useVault } from '@/state/vault';

/**
 * PRD Vault: add a card by issuer, network and type. There is deliberately no
 * field that could hold a card number, and free-text fields are PAN-checked.
 */
export default function AddCard() {
  const router = useRouter();
  const { addCard } = useVault();
  const [issuer, setIssuer] = useState<string | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [type, setType] = useState<CardType>('credit');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  const nicknameHasPan = containsPan(nickname);
  const canSave = !!issuer && !!network && !nicknameHasPan;

  const save = async () => {
    if (!issuer || !network) return;
    const r = await addCard({ issuer, network, type, nickname });
    if (!r.ok) return setError(r.error);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="px-5 pt-4 pb-10 gap-7" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-ink text-3xl">Add a card</Text>
          <Pressable onPress={() => router.back()} className="px-2 py-2">
            <Text className="font-medium text-slate">Cancel</Text>
          </Pressable>
        </View>

        <Field label="Bank">
          <Chips
            options={BANKS.map((b) => ({ value: b.slug, label: b.name }))}
            value={issuer}
            onChange={(v) => {
              setIssuer(v);
              if (v === 'amex') setNetwork('amex');
            }}
          />
        </Field>

        <Field label="Network">
          <Chips options={NETWORKS.map((n) => ({ value: n.slug, label: n.name }))} value={network} onChange={setNetwork} />
        </Field>

        <Field label="Type">
          <Chips
            options={[
              { value: 'credit', label: 'Credit card' },
              { value: 'debit', label: 'Debit card' },
            ]}
            value={type}
            onChange={setType}
          />
        </Field>

        <Field label="Nickname (optional)">
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g. Millennia, Amazon Pay"
            placeholderTextColor="#8A8FA6"
            maxLength={40}
            className={`rounded-xl bg-surface border px-4 py-3 font-body text-ink text-base ${
              nicknameHasPan ? 'border-danger' : 'border-line'
            }`}
          />
          {nicknameHasPan && <Text className="font-medium text-danger text-sm mt-2">{PAN_ERROR}</Text>}
        </Field>

        {error && <Text className="font-medium text-danger">{error}</Text>}

        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityState={{ disabled: !canSave }}
          className={`rounded-2xl py-4 ${canSave ? 'bg-ink active:bg-ink-soft' : 'bg-line'}`}
        >
          <Text className={`font-semibold text-center text-lg ${canSave ? 'text-white' : 'text-slate'}`}>Save card</Text>
        </Pressable>
        <Text className="font-body text-slate text-sm text-center -mt-4">
          Saved on this device only. Harvest never asks for your card number.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="font-semibold text-ink text-base mb-2.5">{label}</Text>
      {children}
    </View>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            className={`rounded-full px-4 py-2 border ${on ? 'bg-ink border-ink' : 'bg-surface border-line active:bg-paper'}`}
          >
            <Text className={`font-medium text-sm ${on ? 'text-white' : 'text-ink'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
