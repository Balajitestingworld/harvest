import { useCallback, useMemo, useRef, useState } from 'react';
import { isStale, matchSearch, type MatchOptions, type SearchResponse, type VaultCard } from '@harvest/core';
import { search } from '@/lib/api';

type Status = 'idle' | 'loading' | 'done' | 'error';

/**
 * Fetches global offers for a query, then matches them against the given
 * cards and payment apps ON DEVICE. Re-matching when cards or options change
 * needs no new request.
 */
export function useSearch(cards: VaultCard[], opts: MatchOptions = {}) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const run = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length < 2) {
      setError('Type at least 2 characters.');
      setStatus('error');
      return;
    }
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setStatus('loading');
    setError(null);
    try {
      const r = await search(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResponse(r);
      setStatus('done');
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      setError(e?.message ?? 'Search failed. Check your connection and try again.');
      setStatus('error');
    }
  }, []);

  const { includeEmi, includeExchange, paymentApps } = opts;
  const results = useMemo(
    () => (response ? matchSearch(response, cards, { includeEmi, includeExchange, paymentApps }) : []),
    [response, cards, includeEmi, includeExchange, paymentApps],
  );
  const stale = response ? isStale(response.cachedAt) : false;

  return { status, error, results, response, stale, run };
}
