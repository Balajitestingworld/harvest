import { parseOfferText } from "../offer-parser.js";
import { extractWithLlm } from "./llm.js";
import { parsedToRow } from "./rows.js";
/** Offers this generous are almost always a misread (or a hostile banner). A person must look. */
export function looksImplausible(o) {
    return (o.kind === 'percent' && o.value > 60) || (o.kind === 'flat' && o.value > 50_000);
}
/**
 * Banner text in, database rows out. Order of attempts:
 *   1. regex parser  → live if confident enough and the store allows it, else pending
 *   2. LLM fallback  → always pending
 *   3. neither works → parse_failures queue
 */
export async function classifyBanners(input) {
    const { merchantId, llm, autoPublishMin } = input;
    const rows = [];
    const failures = [];
    const seen = new Set();
    const stats = { regex: 0, llm: 0, failed: 0, autoPublished: 0 };
    const doneText = new Set();
    for (const raw of input.banners) {
        const text = raw.replace(/\s+/g, ' ').trim();
        if (!text || doneText.has(text))
            continue;
        doneText.add(text);
        let parsed = parseOfferText(text);
        let status = 'pending';
        if (parsed) {
            stats.regex++;
            if (autoPublishMin != null && parsed.confidence >= autoPublishMin && !looksImplausible(parsed)) {
                status = 'live';
                stats.autoPublished++;
            }
        }
        else if (llm) {
            parsed = await extractWithLlm(text, llm);
            if (parsed)
                stats.llm++;
        }
        if (!parsed) {
            stats.failed++;
            failures.push(text);
            continue;
        }
        const row = parsedToRow(merchantId, parsed, { status, rawText: text });
        if (seen.has(row.fingerprint))
            continue;
        seen.add(row.fingerprint);
        rows.push(row);
    }
    return { rows, failures, seen: [...seen], stats };
}
