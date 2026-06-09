/**
 * LRU Image Cache - keeps decoded HTMLImageElements in memory
 * with automatic eviction to prevent unbounded RAM usage.
 *
 * Usage:
 *   const cache = new LRUImageCache(10)
 *   const img = await cache.get('file:///path/to/image.webp')
 */
export class LRUImageCache {
  private cache = new Map<string, HTMLImageElement>()
  private order: string[] = []
  private maxSize: number

  constructor(maxSize = 10) {
    this.maxSize = maxSize
  }

  /** Check if an image is already cached (synchronous) */
  has(url: string): boolean {
    return this.cache.has(url)
  }

  /** Get a decoded image, using cache if available. Decodes and caches if not. */
  async get(url: string): Promise<HTMLImageElement> {
    if (!url) {
      // Return empty image for falsy URLs
      const empty = new Image()
      return empty
    }

    if (this.cache.has(url)) {
      // Move to end (most recently used)
      this.order = this.order.filter(u => u !== url)
      this.order.push(url)
      return this.cache.get(url)!
    }

    // Decode the image
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      // Even on decode error, return the image element
    }

    this.cache.set(url, img)
    this.order.push(url)

    // Evict oldest entries if over capacity
    this.evict()

    return img
  }

  /** Preload a URL into the cache without returning it */
  async preload(url: string): Promise<void> {
    if (!url || this.cache.has(url)) return
    await this.get(url)
  }

  /** Remove a specific URL from the cache */
  delete(url: string): void {
    this.cache.delete(url)
    this.order = this.order.filter(u => u !== url)
  }

  /** Clear the entire cache */
  clear(): void {
    this.cache.clear()
    this.order = []
  }

  /** Current number of cached items */
  get size(): number {
    return this.cache.size
  }

  private evict(): void {
    while (this.order.length > this.maxSize) {
      const oldest = this.order.shift()!
      this.cache.delete(oldest)
    }
  }
}

// Global singleton instance for fanart/system art caching
export const fanartCache = new LRUImageCache(10)
