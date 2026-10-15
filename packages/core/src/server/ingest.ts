import { parseOfferText, type ParsedOffer } from '../offer-parser.ts';
import { extractWithLlm } from './llm.ts';
import { parsedToRow, type OfferRow } from './rows.ts';

export interface ClassifyResult {
  /** Rows to insert (existing fingerprints are skipped by the database). */
  rows: OfferRow[];
  /** Banners nobody could read. Shown to ops. */
  failures: string[];
  /** Fingerprints seen this crawl, used to refresh last_seen_at. */
  seen: string[];
  stats: { regex: number; llm: number; failed: number; autoPublished: number };
}

export interface ClassifyInput {
  merchantId: string;
  banners: string[];
  /** Model call; omit to skip the LLM step. */
  llm?: (system: string, user: string) => Promise<string>;
  /**
   * Regex parses at or above this confidence go live without review.
   * null / undefined = everything waits for a person (the safe default).
   */
  autoPublishMin?: number | null;
}

/** Offers this generous are almost always a misread (or a hostile banner). A person must look. */
export function looksImplausible(o: ParsedOffer): boolean {
  return (o.kind === 'percent' && o.value > 60) || (o.kind === 'flat' && o.value > 50_000);
}

/**
 * Banner text in, database rows out. Order of attempts:
 *   1. regex parser  → live if confident enough and the store allows it, else pending
 *   2. LLM fallback  → always pending
 *   3. neither works → parse_failures queue
 */
export async function classifyBanners(input: ClassifyInput): Promise<ClassifyResult> {
  const { merchantId, llm, autoPublishMin } = input;
  const rows: OfferRow[] = [];
  const failures: string[] = [];
  const seen = new Set<string>();
  const stats = { regex: 0, llm: 0, failed: 0, autoPublished: 0 };
  const doneText = new Set<string>();

  for (const raw of input.banners) {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text || doneText.has(text)) continue;
    doneText.add(text);

    let parsed: ParsedOffer | null = parseOfferText(text);
    let status: 'live' | 'pending' = 'pending';
    if (parsed) {
      stats.regex++;
      if (autoPublishMin != null && parsed.confidence >= autoPublishMin && !looksImplausible(parsed)) {
        status = 'live';
        stats.autoPublished++;
      }
    } else if (llm) {
      parsed = await extractWithLlm(text, llm);
      if (parsed) stats.llm++;
    }

    if (!parsed) {
      stats.failed++;
      failures.push(text);
      continue;
    }
    const row = parsedToRow(merchantId, parsed, { status, rawText: text });
    if (seen.has(row.fingerprint!)) continue;
    seen.add(row.fingerprint!);
    rows.push(row);
  }
  return { rows, failures, seen: [...seen], stats };
}
