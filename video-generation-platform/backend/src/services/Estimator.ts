import axios from 'axios';
import { VideoCreateRequest } from '@/types/api';

export interface EstimationResult {
  estimatedMs: number;
  reasons: string[];
}

/**
 * Heuristic processing time estimator to decide sync vs async path.
 * Uses output resolution, number/type of elements, and approximate source sizes.
 * Designed to be fast and non-blocking with conservative upper-bound estimate.
 */
export class ProcessingEstimator {
  private readonly headTimeoutMs = 1500;

  async estimate(request: VideoCreateRequest): Promise<EstimationResult> {
    const reasons: string[] = [];

    const baseMs = 2000; // baseline overhead
    reasons.push(`base:${baseMs}`);

    const resolutionFactor = (request.width * request.height) / (1280 * 720);
    const resolutionMs = Math.min(8000, Math.max(0, Math.round((resolutionFactor - 1) * 3000)));
    if (resolutionMs > 0) reasons.push(`resolution:${resolutionMs}`);

    let elementsMs = 0;
    for (const el of request.elements) {
      elementsMs += el.type === 'video' ? 2000 : 500;
    }
    reasons.push(`elements:${elementsMs}`);

    const sizeEstimateMb = await this.estimateTotalSizeMb(request).catch(() => 0);
    const networkMs = Math.min(12000, Math.round(sizeEstimateMb * 60)); // ~60ms per MB upper-bound
    if (networkMs > 0) reasons.push(`network:${networkMs}`);

    const total = baseMs + resolutionMs + elementsMs + networkMs;
    return { estimatedMs: total, reasons };
  }

  private async estimateTotalSizeMb(request: VideoCreateRequest): Promise<number> {
    const heads = request.elements.map(async (el) => {
      try {
        const res = await axios.head(el.source, { timeout: this.headTimeoutMs, maxRedirects: 2, validateStatus: (s) => s >= 200 && s < 400 });
        const len = res.headers['content-length'] ? parseInt(String(res.headers['content-length']), 10) : 0;
        return isFinite(len) && len > 0 ? len / (1024 * 1024) : 0;
      } catch {
        return 0;
      }
    });
    const sizes = await Promise.all(heads);
    return sizes.reduce((a, b) => a + b, 0);
  }
}



