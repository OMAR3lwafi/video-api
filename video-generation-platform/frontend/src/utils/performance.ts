import { lazy, ComponentType, Suspense, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createCache, LRUCache } from 'lru-cache';

// Performance monitoring interfaces
interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  mountTime: number;
  updateTime: number;
  memoryUsage: number;
  timestamp: number;
}

interface LazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  placeholder?: ReactNode;
  fallback?: ComponentType;
  timeout?: number;
}

interface ImageOptimizationOptions {
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  sizes?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
}

interface PrefetchOptions {
  priority?: 'low' | 'high' | 'auto';
  as?: 'script' | 'style' | 'image' | 'fetch';
  crossOrigin?: 'anonymous' | 'use-credentials';
  timeout?: number;
}

interface VirtualScrollOptions {
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  buffer?: number;
  threshold?: number;
}

// Performance cache instances
const componentCache = new LRUCache<string, ComponentType>({
  max: 100,
  ttl: 1000 * 60 * 30, // 30 minutes
});

const resourceCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

const metricsCache = new LRUCache<string, PerformanceMetrics>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private observer: PerformanceObserver | null = null;
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private isEnabled: boolean = process.env.NODE_ENV !== 'production';

  private constructor() {
    this.initializeObserver();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeObserver(): void {
    if (!this.isEnabled || !window.PerformanceObserver) return;

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });

      this.observer.observe({
        entryTypes: ['measure', 'navigation', 'resource', 'paint', 'largest-contentful-paint']
      });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.handleNavigationEntry(entry as PerformanceNavigationTiming);
        break;
      case 'resource':
        this.handleResourceEntry(entry as PerformanceResourceTiming);
        break;
      case 'paint':
        this.handlePaintEntry(entry as PerformancePaintTiming);
        break;
      case 'largest-contentful-paint':
        this.handleLCPEntry(entry as any);
        break;
      case 'measure':
        this.handleMeasureEntry(entry as PerformanceMeasure);
        break;
    }
  }

  private handleNavigationEntry(entry: PerformanceNavigationTiming): void {
    const metrics = {
      domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      loadComplete: entry.loadEventEnd - entry.loadEventStart,
      domInteractive: entry.domInteractive - entry.navigationStart,
      ttfb: entry.responseStart - entry.requestStart,
    };

    console.log('Navigation Performance:', metrics);
  }

  private handleResourceEntry(entry: PerformanceResourceTiming): void {
    if (entry.duration > 1000) { // Log slow resources (>1s)
      console.warn('Slow resource loading:', {
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize || 0,
      });
    }
  }

  private handlePaintEntry(entry: PerformancePaintTiming): void {
    console.log(`${entry.name}:`, entry.startTime);
  }

  private handleLCPEntry(entry: any): void {
    console.log('Largest Contentful Paint:', entry.startTime);
  }

  private handleMeasureEntry(entry: PerformanceMeasure): void {
    const metrics = metricsCache.get(entry.name);
    if (metrics) {
      metrics.renderTime = entry.duration;
      metricsCache.set(entry.name, metrics);
    }
  }

  measureComponent(name: string, fn: () => void): void {
    if (!this.isEnabled) return fn();

    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

    performance.mark(`${name}-start`);

    try {
      fn();
    } finally {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);

      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const metrics: PerformanceMetrics = {
        componentName: name,
        renderTime: endTime - startTime,
        mountTime: 0,
        updateTime: 0,
        memoryUsage: endMemory - startMemory,
        timestamp: Date.now(),
      };

      this.metrics.set(name, metrics);
      metricsCache.set(name, metrics);
    }
  }

  getMetrics(componentName?: string): PerformanceMetrics[] {
    if (componentName) {
      const metrics = this.metrics.get(componentName);
      return metrics ? [metrics] : [];
    }
    return Array.from(this.metrics.values());
  }

  clearMetrics(): void {
    this.metrics.clear();
    metricsCache.clear();
  }
}

/**
 * Enhanced lazy loading with intersection observer
 */
export function createLazyComponent<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: LazyLoadOptions = {}
): ComponentType<T> {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true,
    placeholder = null,
    timeout = 10000,
  } = options;

  // Check cache first
  const cacheKey = importFn.toString();
  const cachedComponent = componentCache.get(cacheKey);
  if (cachedComponent) {
    return cachedComponent as ComponentType<T>;
  }

  const LazyComponent = lazy(() => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Component import timeout after ${timeout}ms`));
      }, timeout);

      performanceMonitor.measureComponent('lazy-import', async () => {
        try {
          const module = await importFn();
          clearTimeout(timeoutId);
          resolve(module);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    });
  });

  const WrappedComponent: ComponentType<T> = (props) => (
    <Suspense
      fallback={
        <div className="animate-pulse bg-gray-200 rounded-lg h-32 w-full flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );

  // Cache the component
  componentCache.set(cacheKey, WrappedComponent);

  return WrappedComponent;
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  options: LazyLoadOptions = {}
): [React.RefCallback<Element>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [element, setElement] = useState<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true,
  } = options;

  const ref = useCallback((node: Element | null) => {
    if (node) setElement(node);
  }, []);

  useEffect(() => {
    if (!element || !window.IntersectionObserver) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          if (triggerOnce && observerRef.current) {
            observerRef.current.disconnect();
          }
        } else if (!triggerOnce) {
          setIsIntersecting(false);
        }
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [element, threshold, rootMargin, triggerOnce]);

  return [ref, isIntersecting];
}

/**
 * Optimized image component with lazy loading
 */
export function OptimizedImage({
  src,
  alt,
  className = '',
  options = {},
  ...props
}: {
  src: string;
  alt: string;
  className?: string;
  options?: ImageOptimizationOptions;
  [key: string]: any;
}) {
  const [ref, isIntersecting] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
    triggerOnce: true,
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const {
    quality = 80,
    format = 'webp',
    loading = 'lazy',
    priority = false,
    placeholder = 'blur',
  } = options;

  // Generate optimized image URL (assuming you have an image optimization service)
  const getOptimizedImageUrl = (originalSrc: string): string => {
    const url = new URL('/api/v1/image/optimize', window.location.origin);
    url.searchParams.set('src', originalSrc);
    url.searchParams.set('quality', quality.toString());
    url.searchParams.set('format', format);
    return url.toString();
  };

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  const shouldLoad = priority || isIntersecting;

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {shouldLoad && (
        <>
          <img
            src={getOptimizedImageUrl(src)}
            alt={alt}
            loading={priority ? 'eager' : loading}
            onLoad={handleLoad}
            onError={handleError}
            className={`transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            } ${hasError ? 'hidden' : ''}`}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />

          {/* Fallback image */}
          {hasError && (
            <img
              src={src}
              alt={alt}
              onLoad={handleLoad}
              className="transition-opacity duration-300 opacity-100"
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          )}

          {/* Loading placeholder */}
          {!isLoaded && !hasError && placeholder === 'blur' && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse" />
          )}
        </>
      )}

      {!shouldLoad && placeholder === 'blur' && (
        <div className="absolute inset-0 bg-gray-200" />
      )}
    </div>
  );
}

/**
 * Resource prefetching utilities
 */
export class ResourcePrefetcher {
  private static instance: ResourcePrefetcher;
  private prefetchedResources = new Set<string>();

  private constructor() {}

  static getInstance(): ResourcePrefetcher {
    if (!ResourcePrefetcher.instance) {
      ResourcePrefetcher.instance = new ResourcePrefetcher();
    }
    return ResourcePrefetcher.instance;
  }

  prefetchResource(url: string, options: PrefetchOptions = {}): Promise<void> {
    const { priority = 'low', as = 'fetch', crossOrigin, timeout = 10000 } = options;

    // Check if already prefetched
    if (this.prefetchedResources.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Prefetch timeout: ${url}`));
      }, timeout);

      if ('requestIdleCallback' in window && priority === 'low') {
        requestIdleCallback(() => {
          this.performPrefetch(url, as, crossOrigin)
            .then(() => {
              clearTimeout(timeoutId);
              this.prefetchedResources.add(url);
              resolve();
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        });
      } else {
        this.performPrefetch(url, as, crossOrigin)
          .then(() => {
            clearTimeout(timeoutId);
            this.prefetchedResources.add(url);
            resolve();
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      }
    });
  }

  private async performPrefetch(
    url: string,
    as: string,
    crossOrigin?: string
  ): Promise<void> {
    // Try using link prefetch first
    if (document.head) {
      const link = document.createElement('link');
      link.rel = as === 'fetch' ? 'prefetch' : 'preload';
      link.as = as;
      link.href = url;
      if (crossOrigin) {
        link.crossOrigin = crossOrigin;
      }

      return new Promise((resolve, reject) => {
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to prefetch: ${url}`));
        document.head.appendChild(link);
      });
    }

    // Fallback to fetch for data prefetching
    if (as === 'fetch') {
      const response = await fetch(url, {
        method: 'GET',
        mode: crossOrigin ? 'cors' : 'same-origin',
        cache: 'force-cache',
      });

      if (!response.ok) {
        throw new Error(`Prefetch failed: ${response.status}`);
      }
    }
  }

  prefetchRoute(route: string): Promise<void> {
    // This would integrate with your router to prefetch route chunks
    const chunkUrl = `/chunks/${route.replace('/', '')}.js`;
    return this.prefetchResource(chunkUrl, { as: 'script', priority: 'low' });
  }

  isPrefetched(url: string): boolean {
    return this.prefetchedResources.has(url);
  }

  clearCache(): void {
    this.prefetchedResources.clear();
  }
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualScroll<T>(
  items: T[],
  options: VirtualScrollOptions
) {
  const { itemHeight, containerHeight, buffer = 5, threshold = 0 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const getItemHeight = typeof itemHeight === 'function' ? itemHeight : () => itemHeight;

  // Calculate visible range
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / getItemHeight(0)) - buffer
  );

  const visibleCount = Math.ceil(containerHeight / getItemHeight(0)) + buffer * 2;
  const endIndex = Math.min(items.length - 1, startIndex + visibleCount);

  // Calculate total height and offset
  const totalHeight = items.reduce((acc, _, index) => acc + getItemHeight(index), 0);
  const offsetY = startIndex > 0
    ? items.slice(0, startIndex).reduce((acc, _, index) => acc + getItemHeight(index), 0)
    : 0;

  const visibleItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
    item,
    index: startIndex + index,
  }));

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScrollEvent = (event: Event) => {
      const target = event.target as HTMLDivElement;
      setScrollTop(target.scrollTop);
    };

    container.addEventListener('scroll', handleScrollEvent, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScrollEvent);
    };
  }, []);

  return {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
  };
}

/**
 * Memory leak prevention utilities
 */
export class MemoryManager {
  private static cleanupFunctions = new Set<() => void>();
  private static observers = new Set<IntersectionObserver | ResizeObserver | MutationObserver>();
  private static timeouts = new Set<number>();
  private static intervals = new Set<number>();

  static addCleanupFunction(fn: () => void): void {
    this.cleanupFunctions.add(fn);
  }

  static removeCleanupFunction(fn: () => void): void {
    this.cleanupFunctions.delete(fn);
  }

  static addObserver(observer: IntersectionObserver | ResizeObserver | MutationObserver): void {
    this.observers.add(observer);
  }

  static removeObserver(observer: IntersectionObserver | ResizeObserver | MutationObserver): void {
    observer.disconnect();
    this.observers.delete(observer);
  }

  static addTimeout(id: number): void {
    this.timeouts.add(id);
  }

  static clearTimeout(id: number): void {
    clearTimeout(id);
    this.timeouts.delete(id);
  }

  static addInterval(id: number): void {
    this.intervals.add(id);
  }

  static clearInterval(id: number): void {
    clearInterval(id);
    this.intervals.delete(id);
  }

  static cleanupAll(): void {
    // Run cleanup functions
    this.cleanupFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.warn('Cleanup function error:', error);
      }
    });

    // Disconnect observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Observer cleanup error:', error);
      }
    });

    // Clear timeouts and intervals
    this.timeouts.forEach(id => clearTimeout(id));
    this.intervals.forEach(id => clearInterval(id));

    // Clear sets
    this.cleanupFunctions.clear();
    this.observers.clear();
    this.timeouts.clear();
    this.intervals.clear();

    // Clear caches
    componentCache.clear();
    resourceCache.clear();
    metricsCache.clear();
  }

  static getMemoryUsage(): {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  static checkMemoryLeaks(): void {
    const memoryInfo = this.getMemoryUsage();
    if (!memoryInfo) return;

    const memoryUsageMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
    const memoryLimitMB = memoryInfo.jsHeapSizeLimit / 1024 / 1024;
    const usagePercentage = (memoryUsageMB / memoryLimitMB) * 100;

    if (usagePercentage > 80) {
      console.warn('High memory usage detected:', {
        used: `${memoryUsageMB.toFixed(2)}MB`,
        limit: `${memoryLimitMB.toFixed(2)}MB`,
        percentage: `${usagePercentage.toFixed(1)}%`,
      });

      // Trigger garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }
    }
  }
}

/**
 * Bundle size optimization utilities
 */
export const BundleOptimizer = {
  /**
   * Dynamic import with chunk name
   */
  dynamicImport: <T = any>(
    importFn: () => Promise<T>,
    chunkName?: string
  ): Promise<T> => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    return new Promise((resolve, reject) => {
      performanceMonitor.measureComponent(`dynamic-import-${chunkName || 'unknown'}`, async () => {
        try {
          const module = await importFn();
          resolve(module);
        } catch (error) {
          reject(error);
        }
      });
    });
  },

  /**
   * Code splitting by route
   */
  splitByRoute: (routeName: string) => {
    return createLazyComponent(
      () => BundleOptimizer.dynamicImport(
        () => import(`../pages/${routeName}`),
        `page-${routeName}`
      ),
      {
        timeout: 15000,
        threshold: 0,
        triggerOnce: true,
      }
    );
  },

  /**
   * Split by feature
   */
  splitByFeature: (featureName: string) => {
    return createLazyComponent(
      () => BundleOptimizer.dynamicImport(
        () => import(`../features/${featureName}`),
        `feature-${featureName}`
      ),
      {
        timeout: 10000,
        threshold: 0.1,
        triggerOnce: true,
      }
    );
  },
};

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitoring(componentName: string) {
  const performanceMonitor = PerformanceMonitor.getInstance();
  const renderCountRef = useRef(0);
  const mountTimeRef = useRef<number>(0);

  useEffect(() => {
    mountTimeRef.current = performance.now();

    return () => {
      const unmountTime = performance.now();
      const totalMountTime = unmountTime - mountTimeRef.current;

      performanceMonitor.measureComponent(`${componentName}-lifecycle`, () => {
        console.log(`${componentName} was mounted for ${totalMountTime.toFixed(2)}ms`);
      });
    };
  }, [componentName, performanceMonitor]);

  useEffect(() => {
    renderCountRef.current++;

    if (renderCountRef.current > 1) {
      performanceMonitor.measureComponent(`${componentName}-render`, () => {
        console.log(`${componentName} rendered ${renderCountRef.current} times`);
      });
    }
  });

  return {
    renderCount: renderCountRef.current,
    getMetrics: () => performanceMonitor.getMetrics(componentName),
  };
}

/**
 * Export main instances and utilities
 */
export const performanceMonitor = PerformanceMonitor.getInstance();
export const resourcePrefetcher = ResourcePrefetcher.getInstance();

// Initialize memory monitoring
if (typeof window !== 'undefined') {
  // Check memory usage every 30 seconds
  const memoryCheckInterval = setInterval(() => {
    MemoryManager.checkMemoryLeaks();
  }, 30000);

  MemoryManager.addInterval(memoryCheckInterval);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    MemoryManager.cleanupAll();
  });
}

// Export all utilities
export {
  MemoryManager,
  BundleOptimizer,
};
