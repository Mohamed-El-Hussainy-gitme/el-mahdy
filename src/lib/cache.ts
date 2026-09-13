/**
 * src/lib/cache.ts
 *
 * Lightweight in-memory TTL cache for client-side catalog data.
 * Eliminates redundant Supabase fetches during the same browser session.
 *
 * Architecture:
 * - Products + Categories + Models are fetched once, then held in memory
 * - TTL = 5 minutes (300s) — after which the next call re-fetches
 * - Cache is keyed by table name
 * - On mutation (add/update/delete), the relevant key is invalidated
 * - Zero external dependencies — pure Map + Date
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  /** Returns milliseconds until expiry for a key, or 0 if expired/absent */
  ttlRemaining(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;
    return Math.max(0, entry.expiresAt - Date.now());
  }
}

/** Singleton cache instance — shared across the browser session */
export const clientCache = new TtlCache();

// Well-known cache keys
export const CACHE_KEYS = {
  PRODUCTS: 'catalog:products',
  CATEGORIES: 'catalog:categories',
  MODELS: 'catalog:models',
  ORDERS_ADMIN: 'admin:orders',
} as const;

/**
 * Invalidate all catalog-related cache entries.
 * Call this after any product/category mutation.
 */
export function invalidateCatalogCache(): void {
  clientCache.invalidate(CACHE_KEYS.PRODUCTS);
  clientCache.invalidate(CACHE_KEYS.CATEGORIES);
  clientCache.invalidate(CACHE_KEYS.MODELS);
}
