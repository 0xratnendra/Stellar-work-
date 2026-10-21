import { getDescriptionCid } from "@/lib/contract";
import { fetchFromIpfs } from "@/lib/ipfs-service";

type AsyncTask<T> = () => Promise<T> | T;

export function createConcurrencyLimiter(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("Concurrency limit must be a positive integer.");
  }

  let activeCount = 0;
  const queue: Array<() => void> = [];

  return function run<T>(task: AsyncTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        activeCount += 1;
        void Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            activeCount -= 1;
            queue.shift()?.();
          });
      };

      if (activeCount < limit) {
        start();
      } else {
        queue.push(start);
      }
    });
  };
}

export function createInFlightDeduper<K, V>() {
  const inFlight = new Map<K, Promise<V>>();

  return function dedupe(key: K, task: AsyncTask<V>): Promise<V> {
    const existing = inFlight.get(key);
    if (existing) return existing;

    const pending = Promise.resolve()
      .then(task)
      .finally(() => {
        if (inFlight.get(key) === pending) inFlight.delete(key);
      });
    inFlight.set(key, pending);
    return pending;
  };
}

const DESCRIPTION_FETCH_CONCURRENCY = 4;
const runLimited = createConcurrencyLimiter(DESCRIPTION_FETCH_CONCURRENCY);
const dedupeDescriptionFetch = createInFlightDeduper<string, string | null>();

export function resolveJobDescription(hash: string): Promise<string | null> {
  return dedupeDescriptionFetch(hash, () =>
    runLimited(async () => {
      if (typeof window === "undefined") return null;

      const cacheKey = `job-desc:${hash}`;
      let cached: string | null = null;
      try {
        cached = localStorage.getItem(cacheKey);
      } catch {
        // Continue to the gateway when browser storage is unavailable.
      }

      try {
        const { verifyHtmlMatchesHash } = await import("@/lib/crypto");
        if (cached && await verifyHtmlMatchesHash(cached, hash)) return cached;
        if (cached) {
          try {
            localStorage.removeItem(cacheKey);
          } catch {
            // Continue fetching even when the stale value cannot be removed.
          }
        }

        const cid = await getDescriptionCid(hash);
        if (!cid) return null;

        const text = await fetchFromIpfs(cid);
        if (!await verifyHtmlMatchesHash(text, hash)) return null;

        try {
          localStorage.setItem(cacheKey, text);
        } catch {
          // The verified result can still be rendered without persisting it.
        }
        return text;
      } catch {
        return null;
      }
    }),
  );
}