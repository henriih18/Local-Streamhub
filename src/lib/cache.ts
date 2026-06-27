interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheItem<unknown>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_CACHE_SIZE = 500;

  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (this.isExpired(item)) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    let count = 0;
    for (const item of this.cache.values()) {
      if (!this.isExpired(item)) count++;
    }
    return count;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// Instancia única de caché de usuarios
export const userCache = new MemoryCache();

// Limpieza automática cada 5 minutos
setInterval(
  () => {
    userCache.cleanup();
  },
  2 * 60 * 1000,
);

// Keys de cache para distintos tipos de datos de usuario
export const cacheKeys = {
  userByEmail: (email: string) => `user:${email}`,
  userPermissions: (userId: string) => `user:permissions:${userId}`,
  userStats: (userId: string) => `user:stats:${userId}`,
};

// Invalidar cache de un usuario
export function invalidateUserCache(email: string, userId?: string): void {
  userCache.delete(cacheKeys.userByEmail(email));
  if (userId) {
    userCache.delete(cacheKeys.userPermissions(userId));
    userCache.delete(cacheKeys.userStats(userId));
  }
}
