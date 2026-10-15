/**
 * Rule R-001: the vault must never hold a card number (PAN).
 * Any free-text field the user fills in (nickname, notes) passes through
 * containsPan() before it is saved. We are deliberately strict: any run of
 * 12+ digits — even split by spaces or dashes — is rejected, Luhn-valid or not.
 * Real nicknames ("Sapphiro", "Amazon Pay ICICI") never need that many digits.
 */
const DIGIT_RUN = /(?:\d[\s\-.]?){12,}/;
export function containsPan(text) {
    if (!text)
        return false;
    return DIGIT_RUN.test(text);
}
/** Standard Luhn check — exported for tests / telemetry-free diagnostics. */
export function luhnValid(digits) {
    const clean = digits.replace(/\D/g, '');
    if (clean.length < 12)
        return false;
    let sum = 0;
    let double = false;
    for (let i = clean.length - 1; i >= 0; i--) {
        let d = Number(clean[i]);
        if (double) {
            d *= 2;
            if (d > 9)
                d -= 9;
        }
        sum += d;
        double = !double;
    }
    return sum % 10 === 0;
}
export const PAN_ERROR = 'That looks like a card number. Harvest never stores card numbers — just pick the bank, network and card type.';
