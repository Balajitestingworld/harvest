import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { VaultCard } from '@harvest/core';
import { SearchBox } from './SearchBox';
import { Results } from './Results';
import { useSearch } from '@/state/useSearch';

/** Sample wallet for the hero demo. Not saved anywhere. */
const SAMPLE: VaultCard[] = [
  { id: 's-hdfc', issuer: 'hdfc', network: 'visa', type: 'credit', nickname: 'HDFC credit' },
  { id: 's-icici', issuer: 'icici', network: 'mastercard', type: 'credit', nickname: 'ICICI credit' },
  { id: 's-axis', issuer: 'axis', network: 'visa', type: 'credit', nickname: 'Axis credit' },
  { id: 's-sbi', issuer: 'sbi', network: 'rupay', type: 'credit', nickname: 'SBI RuPay credit' },
  { id: 's-kotak', issuer: 'kotak', network: 'visa', type: 'credit', nickname: 'Kotak credit' },
];

export function Landing() {
  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="pb-16">
      <Header />
      <Hero />
      <Steps />
      <Privacy />
      <Footer />
    </ScrollView>
  );
}

function Wrap({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <View className={`w-full max-w-5xl self-center px-5 md:px-8 ${className}`}>{children}</View>;
}

/** Web only: this landing page never renders on native. */
function jumpToDemo() {
  (globalThis as any).document?.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Header() {
  return (
    <Wrap className="flex-row items-center justify-between py-5">
      <Text className="font-display text-ink text-2xl">Harvest</Text>
      <Pressable
        onPress={jumpToDemo}
        accessibilityRole="link"
        accessibilityHint="Scrolls to the live demo"
        className="rounded-full border-2 border-ink px-4 py-2 active:bg-surface"
      >
        <Text className="font-semibold text-ink">Try the demo</Text>
      </Pressable>
    </Wrap>
  );
}

function Hero() {
  const [picked, setPicked] = useState<string[]>(['s-hdfc', 's-axis']);
  const wallet = useMemo(() => SAMPLE.filter((c) => picked.includes(c.id)), [picked]);
  const s = useSearch(wallet);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Wrap className="pt-4 md:pt-8 gap-8 md:flex-row md:items-start">
      <View className="md:flex-1 md:pt-2">
        <Text className="font-display text-ink text-4xl md:text-5xl leading-tight">
          The card in your wallet is worth more than you think.
        </Text>
        <Text className="font-body text-slate text-base md:text-lg mt-4 leading-relaxed max-w-md">
          Banks run instant discounts on Amazon, Flipkart and Croma. Harvest checks them against your cards
          and shows what you'd really pay. It never sees your card.
        </Text>
      </View>

      <View
        nativeID="demo"
        className="md:flex-1 rounded-3xl bg-surface border border-line p-5 md:p-6 gap-4"
      >
        <View>
          <View className="flex-row items-baseline justify-between">
            <Text className="font-semibold text-ink text-base">1. Pick the cards you carry</Text>
            <Text className="font-medium text-slate text-sm">{picked.length} of {SAMPLE.length} selected</Text>
          </View>
          <View className="flex-row flex-wrap gap-2 mt-3">
            {SAMPLE.map((c) => {
              const on = picked.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => toggle(c.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5 border ${on ? 'bg-ink border-ink' : 'bg-surface border-line'}`}
                >
                  <Text aria-hidden className={`font-bold text-sm ${on ? 'text-white' : 'text-slate'}`}>
                    {on ? '✓' : '+'}
                  </Text>
                  <Text className={`font-medium text-sm ${on ? 'text-white' : 'text-ink'}`}>{c.nickname}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="font-body text-slate text-sm mt-3">
            Matches by bank, network and credit or debit. Card-specific offers, such as Regalia, are not matched yet.
          </Text>
        </View>

        <View>
          <Text className="font-semibold text-ink text-base mb-3">2. Search a product</Text>
          <SearchBox onSearch={s.run} loading={s.status === 'loading'} placeholder="Try: Galaxy S25" />
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-semibold text-turmeric-deep bg-turmeric-pale rounded-full px-3 py-1 text-xs">
            SAMPLE DATA
          </Text>
          <Text className="font-body text-slate text-xs flex-shrink">Sample prices and offers, not live.</Text>
        </View>

        {wallet.length === 0 && (
          <Text className="font-medium text-ink bg-paper rounded-xl px-4 py-2.5 text-sm">
            Pick at least one card to see the price it unlocks.
          </Text>
        )}

        {s.status === 'idle' ? null : (
          <Results status={s.status} error={s.error} results={s.results} stale={false} hasCards={wallet.length > 0} />
        )}

        {s.status === 'done' && s.results.length > 0 && (
          <Text className="font-body text-slate text-xs leading-relaxed">
            Sorted by the price you'd pay, not by commission. Harvest earns a small commission from stores when you
            buy through it.
          </Text>
        )}
      </View>
    </Wrap>
  );
}

const STEPS = [
  ['Add your cards', 'Pick the bank, network and card type. No card number, no account, no KYC.'],
  ['Search for what you want', 'Harvest pulls prices and every live bank offer from the big stores.'],
  ['Buy at the lowest real price', 'See which card to pay with, then check out on the store as usual.'],
] as const;

function Steps() {
  return (
    <Wrap className="mt-20">
      <Text className="font-display text-ink text-3xl md:text-4xl">How it works</Text>
      <View className="mt-8 gap-8 md:flex-row md:gap-10">
        {STEPS.map(([title, body], i) => (
          <View key={title} className="md:flex-1">
            <Text className="font-display text-turmeric text-5xl">{i + 1}</Text>
            <Text className="font-semibold text-ink text-xl mt-2">{title}</Text>
            <Text className="font-body text-slate text-base mt-2 leading-relaxed">{body}</Text>
          </View>
        ))}
      </View>
    </Wrap>
  );
}

/** Phone → server → phone. Cards never leave the phone. */
function Flow() {
  const node = (title: string, lines: string[], tone: 'dark' | 'light') => (
    <View className={`flex-1 rounded-2xl px-4 py-4 ${tone === 'dark' ? 'bg-white/10' : 'bg-white'}`}>
      <Text className={`font-semibold text-base ${tone === 'dark' ? 'text-white' : 'text-ink'}`}>{title}</Text>
      {lines.map((l) => (
        <Text key={l} className={`font-body text-sm mt-1 ${tone === 'dark' ? 'text-white/70' : 'text-slate'}`}>
          {l}
        </Text>
      ))}
    </View>
  );
  const arrow = (label: string) => (
    <View className="items-center justify-center px-1 py-2 md:py-0">
      <Text className="text-turmeric font-bold text-lg md:hidden">↓</Text>
      <Text className="text-turmeric font-bold text-lg hidden md:flex">→</Text>
      <Text className="text-white/70 text-xs text-center mt-1 max-w-[110px]">{label}</Text>
    </View>
  );
  return (
    <View className="mt-8 gap-2 md:flex-row md:items-stretch">
      {node('Your phone', ['Your cards', 'Matching happens here'], 'dark')}
      {arrow('product name only')}
      {node('Harvest server', ['Every live offer', 'No idea who is asking'], 'light')}
      {arrow('all offers back')}
      {node('Your phone', ['Matched to your cards', 'Lowest price first'], 'dark')}
    </View>
  );
}

function Privacy() {
  return (
    <Wrap className="mt-20">
      <View className="rounded-3xl bg-ink px-6 py-10 md:px-12 md:py-14">
        <Text className="font-display text-white text-3xl md:text-4xl max-w-xl">
          What leaves your phone when you search
        </Text>
        <View className="mt-10 gap-8 md:flex-row">
          <View className="md:flex-1">
            <Text className="font-semibold text-turmeric text-lg">Sent</Text>
            <Text className="font-body text-white text-2xl mt-2">"samsung galaxy s25"</Text>
            <Text className="font-body text-white/70 text-base mt-2 leading-relaxed">
              The product name. That's the whole request.
            </Text>
          </View>
          <View className="md:flex-1">
            <Text className="font-semibold text-turmeric text-lg">Never sent</Text>
            <Text className="font-body text-white text-base mt-2 leading-loose">
              Which cards you have. Your name, phone number or email. Anything that could identify you.
            </Text>
          </View>
        </View>
        <Flow />
        <Text className="font-body text-white/70 text-base mt-8 max-w-2xl leading-relaxed">
          The server sends every offer it knows, and your phone does the matching. We never see your cards,
          so we have nothing to sell about your spending.
        </Text>
      </View>
    </Wrap>
  );
}

function Footer() {
  return (
    <Wrap className="mt-20 gap-3 md:flex-row md:justify-between">
      <Text className="font-semibold text-ink">Harvest. Android app coming soon.</Text>
      <Text className="font-body text-slate text-sm max-w-md">
        Harvest earns a small commission from stores when you buy through it. Results are always sorted by the
        price you'd pay.
      </Text>
    </Wrap>
  );
}
