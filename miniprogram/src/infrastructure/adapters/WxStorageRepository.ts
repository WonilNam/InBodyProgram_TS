import { IStorageRepository, StorageSchema } from '../../domain/ports/IStorageRepository';

export class WxStorageRepository implements IStorageRepository {
  private readonly memoryFallback = new Map<string, unknown>();
  private readonly pendingWrites = new Set<string>();

  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null {
    if (this.pendingWrites.has(key)) {
      return (this.memoryFallback.get(key) as StorageSchema[K] | undefined) ?? null;
    }
    try {
      if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
        const val = wx.getStorageSync(key);
        if (val !== undefined && val !== '') {
          return val as StorageSchema[K];
        }
        return null;
      }
    } catch {
      // Fallback to memory store
    }
    const mem = this.memoryFallback.get(key);
    return (mem !== undefined ? (mem as StorageSchema[K]) : null);
  }

  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
    this.memoryFallback.set(key, value);
    this.pendingWrites.add(key);
    try {
      if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
        wx.setStorageSync(key, value);
        this.pendingWrites.delete(key);
      }
    } catch {
      // Ignore quota or sync errors
    }
  }

  remove<K extends keyof StorageSchema>(key: K): void {
    this.memoryFallback.delete(key);
    this.pendingWrites.add(key);
    try {
      if (typeof wx !== 'undefined' && typeof wx.removeStorageSync === 'function') {
        wx.removeStorageSync(key);
        this.pendingWrites.delete(key);
      }
    } catch {
      // Ignore
    }
  }

  clearAll(): void {
    for (const key of this.memoryFallback.keys()) this.pendingWrites.add(key);
    this.memoryFallback.clear();
    try {
      if (typeof wx !== 'undefined' && typeof wx.clearStorageSync === 'function') {
        wx.clearStorageSync();
      }
    } catch {
      // Ignore
    }
  }
}
