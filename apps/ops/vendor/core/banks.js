/** Indian card issuers the MVP recognises. Extend as merchants show new ones. */
export const BANKS = [
    { slug: 'hdfc', name: 'HDFC Bank', aliases: ['hdfc bank', 'hdfc'] },
    { slug: 'icici', name: 'ICICI Bank', aliases: ['icici bank', 'icici'] },
    { slug: 'sbi', name: 'SBI Card', aliases: ['sbi card', 'sbi bank', 'state bank of india', 'sbi'] },
    { slug: 'axis', name: 'Axis Bank', aliases: ['axis bank', 'axis'] },
    { slug: 'kotak', name: 'Kotak Mahindra Bank', aliases: ['kotak mahindra bank', 'kotak bank', 'kotak'] },
    { slug: 'amex', name: 'American Express', aliases: ['american express', 'amex'] },
    { slug: 'idfc', name: 'IDFC FIRST Bank', aliases: ['idfc first bank', 'idfc first', 'idfc'] },
    { slug: 'au', name: 'AU Small Finance Bank', aliases: ['au small finance bank', 'au bank'] },
    { slug: 'yes', name: 'YES Bank', aliases: ['yes bank'] },
    { slug: 'indusind', name: 'IndusInd Bank', aliases: ['indusind bank', 'indusind'] },
    { slug: 'bob', name: 'Bank of Baroda', aliases: ['bank of baroda', 'bobcard', 'bob card', 'bob'] },
    { slug: 'hsbc', name: 'HSBC', aliases: ['hsbc bank', 'hsbc'] },
    { slug: 'sc', name: 'Standard Chartered', aliases: ['standard chartered', 'stanchart'] },
    { slug: 'rbl', name: 'RBL Bank', aliases: ['rbl bank', 'rbl'] },
    { slug: 'federal', name: 'Federal Bank', aliases: ['federal bank'] },
    { slug: 'onecard', name: 'OneCard', aliases: ['onecard', 'one card'] },
];
export const NETWORKS = [
    { slug: 'visa', name: 'Visa', aliases: ['visa'] },
    { slug: 'mastercard', name: 'Mastercard', aliases: ['mastercard', 'master card'] },
    { slug: 'rupay', name: 'RuPay', aliases: ['rupay'] },
    { slug: 'amex', name: 'American Express', aliases: ['american express', 'amex'] },
    { slug: 'diners', name: 'Diners Club', aliases: ['diners club', 'diners'] },
];
/** UPI and wallet apps that run their own checkout offers. */
export const PAYMENT_APPS = [
    { slug: 'phonepe', name: 'PhonePe', aliases: ['phonepe', 'phone pe'] },
    { slug: 'paytm', name: 'Paytm', aliases: ['paytm'] },
    { slug: 'amazonpay', name: 'Amazon Pay', aliases: ['amazon pay'] },
    { slug: 'cred', name: 'CRED', aliases: ['cred'] },
    { slug: 'gpay', name: 'Google Pay', aliases: ['google pay', 'gpay', 'g pay'] },
    { slug: 'bhim', name: 'BHIM', aliases: ['bhim'] },
    { slug: 'mobikwik', name: 'MobiKwik', aliases: ['mobikwik'] },
    { slug: 'freecharge', name: 'Freecharge', aliases: ['freecharge'] },
];
/** Bank shopping portals: buy through the bank's site, earn extra rewards. */
export const PORTALS = [
    { slug: 'smartbuy', name: 'HDFC SmartBuy', issuer: 'hdfc', aliases: ['smartbuy', 'smart buy'] },
    { slug: 'ishop', name: 'ICICI iShop', issuer: 'icici', aliases: ['ishop', 'i-shop'] },
    { slug: 'edge', name: 'Axis Edge Rewards', issuer: 'axis', aliases: ['edge rewards', 'axis edge', 'edge reward points'] },
];
export function paymentAppName(slug) {
    return PAYMENT_APPS.find((a) => a.slug === slug)?.name ?? slug;
}
export function portalName(slug) {
    return PORTALS.find((p) => p.slug === slug)?.name ?? slug;
}
export function bankName(slug) {
    return BANKS.find((b) => b.slug === slug)?.name ?? slug.toUpperCase();
}
export function networkName(slug) {
    return NETWORKS.find((n) => n.slug === slug)?.name ?? slug;
}
