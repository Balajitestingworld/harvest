import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  bankName,
  describeApplied,
  explain,
  formatINR,
  networkName,
  paymentAppName,
  portalName,
  type MatchedResult,
  type VaultCard,
} from '@harvest/core';
import { openMerchant } from '@/lib/open-link';

export function cardLabel(card: VaultCard) {
  return card.nickname || `${bankName(card.issuer)} ${networkName(card.network)} ${card.type}`;
}

/**
 * One merchant result. The struck base price and the turmeric "you save"
 * strip are the product's signature: money found, made visible.
 */
export function ResultCard({ result, best }: { result: MatchedResult; best: boolean }) {
  const [open, setOpen] = useState(false);
  const { listing, basePrice, effectivePrice, totalDiscount, card, app, applied, priceCheck } = result;
  const saved = totalDiscount > 0;

  return (
    <View className={`rounded-2xl bg-surface border ${best ? 'border-ink' : 'border-line'} overflow-hidden`}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${listing.merchantName}, ${formatINR(effectivePrice)}. Show calculation`}
        className="px-5 pt-4 pb-4"
      >
        <View className="flex-row items-baseline justify-between">
          <Text className="font-semibold text-ink text-base">{listing.merchantName}</Text>
          {best && <Text className="font-medium text-ink text-xs">Lowest for your cards</Text>}
        </View>
        <Text numberOfLines={1} className="font-body text-slate text-sm mt-0.5">
          {listing.title}
        </Text>

        <View className="flex-row items-end mt-3 gap-3">
          <Text className="font-display text-ink text-3xl">{formatINR(effectivePrice)}</Text>
          {saved && (
            <Text className="font-body text-slate text-base mb-1 line-through">{formatINR(basePrice)}</Text>
          )}
        </View>
        {listing.shipping > 0 && (
          <Text className="font-body text-slate text-xs mt-1">Includes {formatINR(listing.shipping)} delivery</Text>
        )}
        {priceCheck.verdict !== 'unknown' && (
          <Text
            className={`font-medium text-xs mt-2 ${
              priceCheck.fakeSale || priceCheck.verdict === 'high' ? 'text-danger' : 'text-slate'
            }`}
          >
            {priceCheck.fakeSale ? 'Sale price looks inflated. ' : ''}
            {priceCheck.note}
          </Text>
        )}
      </Pressable>

      {saved ? (
        <View className="bg-turmeric-pale px-5 py-2.5 flex-row items-center justify-between">
          <Text className="font-semibold text-turmeric-deep text-sm">You save {formatINR(totalDiscount)}</Text>
          <Text numberOfLines={1} className="font-medium text-turmeric-deep text-sm ml-3 shrink">
            {card ? `with ${cardLabel(card)}` : app ? `paying with ${paymentAppName(app)}` : 'for everyone'}
          </Text>
        </View>
      ) : (
        <View className="bg-paper px-5 py-2.5">
          <Text className="font-body text-slate text-sm">None of your cards has an offer here</Text>
        </View>
      )}

      {open && (
        <View className="px-5 py-4 border-t border-line gap-2">
          <Text className="font-semibold text-ink text-sm">{explain(result)}</Text>
          {applied.map((a) => (
            <View key={a.offer.id}>
              <Text className="font-medium text-ink text-sm">{describeApplied(a)}</Text>
              <Text className="font-body text-slate text-xs">{a.offer.label}</Text>
              {a.offer.code && (
                <Text className="font-medium text-ink text-xs">Use code {a.offer.code} at checkout</Text>
              )}
              {a.offer.portal && (
                <Text className="font-body text-slate text-xs">
                  Book through {portalName(a.offer.portal)} to get this.
                </Text>
              )}
              {a.offer.rewardKind && a.offer.rewardKind !== 'instant' && (
                <Text className="font-body text-slate text-xs">
                  Paid back later as {a.offer.rewardKind === 'cashback' ? 'cashback' : 'reward points'}, not taken off now.
                </Text>
              )}
            </View>
          ))}
          <Text className="font-body text-slate text-xs">
            Offers are applied by the merchant at checkout. Check the final price before you pay.
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => openMerchant(listing.merchantId, listing.affiliateUrl)}
        accessibilityRole="link"
        className="bg-ink px-5 py-3.5 active:bg-ink-soft"
      >
        <Text className="font-semibold text-white text-center text-base">Buy on {listing.merchantName}</Text>
      </Pressable>
    </View>
  );
}
