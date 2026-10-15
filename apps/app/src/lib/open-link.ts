import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { outboundUrl } from './api';

/** "Buy" — opens the merchant with the affiliate tag (PRD: Affiliate Redirect). */
export async function openMerchant(merchantId: string, affiliateUrl: string) {
  const url = outboundUrl(merchantId, affiliateUrl);
  if (Platform.OS === 'web') {
    globalThis.open?.(url, '_blank', 'noopener');
    return;
  }
  // In-app browser keeps the user one tap from coming back to compare.
  await WebBrowser.openBrowserAsync(url, { toolbarColor: '#1F2559', showTitle: true });
}
