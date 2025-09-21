import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';
import axios from 'axios';
import { createWriteStream, promises as fsp, existsSync } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
//
// Optional runtime-only dependency for resource sampling; types not required
let pidusage: any;
try { pidusage = require('pidusage'); } catch { pidusage = null; }
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { ProcessingError, TimeoutError, UnsupportedFormatError } from '@/errors/ProcessingError';
import { VideoCreateRequest, VideoElement } from '@/types/api';

type FitMode = 'auto' | 'contain' | 'cover' | 'fill';

export interface ProcessingProgress {
  frames?: number;
  currentFps?: number;
  currentKbps?: number;
  targetSizeKB?: number;
  timemark?: string;
  percent?: number | undefined;
  step?: string;
  cpuPercent?: number | undefined;
  memoryMB?: number | undefined;
}

export interface ProcessingResult {
  outputPath: string;
  durationMs: number;
  outputSizeBytes: number;
  width: number;
  height: number;
  format: string;
  logs: string[];
}

export interface QualityOptions {
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  crf?: number; // 18-28 typical for x264
  videoBitrate?: string; // e.g. '3500k'
  audioBitrate?: string; // e.g. '128k'
  fps?: number; // optional target fps
  codec?: 'libx264' | 'libx265' | 'libvpx-vp9' | 'libaom-av1';
}

export interface ProcessOptions extends QualityOptions {
  timeoutMs?: number;
  onProgress?: (progress: ProcessingProgress) => void;
  cancelSignal?: AbortSignal;
}

interface DownloadedMedia {
  element: VideoElement;
  path: string;
  width?: number | undefined;
  height?: number | undefined;
  duration?: number | undefined; // for videos
  type: 'video' | 'image';
}

interface FilterBuildResult {
  filterComplex: string[];
  lastLabel: string; // label of the composed final video stream
}

/**
 * VideoProcessor builds a filtergraph to composite multiple media elements (video/image)
 * with percentage-based positioning, scaling, and fit modes, producing a final video.
 */
export class VideoProcessor {
  private readonly tmpDir = '/tmp/video-processing';

  constructor() {
    if (config.processing.ffprobePath) {
      ffmpeg.setFfprobePath(config.processing.ffprobePath);
    } else {
      ffmpeg.setFfprobePath(ffprobe.path);
    }
    if (config.processing.ffmpegPath) {
      ffmpeg.setFfmpegPath(config.processing.ffmpegPath);
    }
  }

  /**
   * Process a VideoCreateRequest and produce a composed video file on disk.
   * Uses complex filtergraphs with overlay chains. Downloads remote media to temp files.
   *
   * @param {VideoCreateRequest} request Request describing canvas and elements
   * @param {ProcessOptions} options Processing options such as quality, timeout, and progress callback
   * @returns {Promise<ProcessingResult>} Result containing output path and metadata
   * @throws {UnsupportedFormatError | TimeoutError | ProcessingError}
   */
  async process(request: VideoCreateRequest, options: ProcessOptions = {}): Promise<ProcessingResult> {
    const start = Date.now();
    const logs: string[] = [];

    this.ensureTmpDir();

    const { output_format, width: canvasWidth, height: canvasHeight, elements } = request;
    if (!['mp4', 'mov', 'avi'].includes(output_format)) {
      throw new UnsupportedFormatError(output_format);
    }

    const timeoutMs = options.timeoutMs ?? config.processing.timeoutMs;

    // Prepare base canvas (black background) as first input: color source via lavfi
    const baseLabel = 'base0';
    const baseInput = `color=c=black:s=${canvasWidth}x${canvasHeight}:r=${options.fps ?? 30}`;

    const downloaded: DownloadedMedia[] = [];
    try {
      // Download all media in parallel
      const downloads = elements.map((el) => this.downloadAndProbe(el));
      const mediaList = await Promise.all(downloads);
      downloaded.push(...mediaList);

      // Build command
      const command = ffmpeg();
      const estDuration = this.estimateTargetDuration(mediaList);
      command.input(`lavfi:${baseInput}`).inputOptions(['-t', estDuration.toString()]);

      // Add inputs for each element
      for (const media of mediaList) {
        command.input(media.path);
      }

      // Assemble filtergraph
      const { filterComplex, lastLabel } = this.buildFilterGraph(canvasWidth, canvasHeight, mediaList, logs);
      (command as any).complexFilter(filterComplex as any, lastLabel as any);

      // Output options
      const quality = this.resolveQualityOptions(output_format, options);
      if (quality.videoBitrate) command.videoBitrate(quality.videoBitrate);
      if (quality.audioBitrate) command.audioBitrate(quality.audioBitrate);
      if (quality.preset) command.addOption('-preset', quality.preset);
      if (quality.crf !== undefined) command.addOption('-crf', String(quality.crf));
      if (options.fps) command.fps(options.fps);
      if (quality.codec) command.videoCodec(quality.codec);

      // Ensure pixel format for compatibility
      if (output_format === 'mp4' || output_format === 'mov') {
        command.addOption('-pix_fmt', 'yuv420p');
      }

      // Container format
      const outfile = join(this.tmpDir, `${randomUUID()}.${output_format}`);
      command.output(outfile);

      // Progress handling
      command.on('progress', (p) => {
        const prog: ProcessingProgress = {
          frames: p.frames,
          currentFps: p.currentFps,
          currentKbps: p.currentKbps,
          targetSizeKB: p.targetSize,
          timemark: p.timemark,
          percent: this.parsePercent(p.timemark, mediaList),
          step: 'ffmpeg-processing',
        };
        options.onProgress?.(prog);
      });

      // Collect stderr for detailed error reporting
      command.on('stderr', (line: string) => {
        logs.push(line);
      });

      // Cancellation support
      const abortListener = () => {
        try { command.kill('SIGKILL'); } catch {}
      };
      options.cancelSignal?.addEventListener('abort', abortListener, { once: true });

      // Timeout handling
      const execPromise = new Promise<ProcessingResult>((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | undefined;
        let resourceInterval: NodeJS.Timeout | undefined;
        if (timeoutMs > 0) {
          timeoutId = setTimeout(() => {
            try { command.kill('SIGKILL'); } catch {}
            reject(new TimeoutError(`Processing exceeded ${timeoutMs}ms`));
          }, timeoutMs);
        }

        command
          .on('end', async () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (resourceInterval) clearInterval(resourceInterval);
            try {
              const stat = await fsp.stat(outfile);
              const durationMs = Date.now() - start;
              options.onProgress?.({ percent: 100, step: 'completed' });
              resolve({
                outputPath: outfile,
                durationMs,
                outputSizeBytes: stat.size,
                width: canvasWidth,
                height: canvasHeight,
                format: output_format,
                logs,
              });
            } catch (e) {
              // Attempt to cleanup partial output
              try { await fsp.unlink(outfile); } catch {}
              reject(this.wrapError(e, logs));
            }
          })
          .on('error', (err) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (resourceInterval) clearInterval(resourceInterval);
            // Attempt to cleanup partial output
            (async () => { try { await fsp.unlink(outfile); } catch {} })();
            reject(this.parseFfmpegError(err, logs));
          })
          .on('start', () => {
            // Start resource usage monitoring once the process exists
            resourceInterval = setInterval(async () => {
              try {
                const pid = (command as any).ffmpegProc?.pid as number | undefined;
                if (!pid) return;
                if (pidusage) {
                  const stats = await pidusage(pid);
                  options.onProgress?.({
                    step: 'resource',
                    cpuPercent: typeof stats.cpu === 'number' ? Math.round(stats.cpu) : undefined,
                    memoryMB: typeof stats.memory === 'number' ? Math.round(stats.memory / (1024 * 1024)) : undefined,
                  });
                }
              } catch {
                // ignore sampling errors
              }
            }, 1000);
          })
          .run();
      });

      const result = await execPromise;
      return result;
    } catch (e) {
      throw this.wrapError(e, logs);
    } finally {
      // Cleanup inputs
      await this.safeCleanup(downloaded.map((m) => m.path));
    }
  }

  /**
   * Download media from URL to a temp file and probe dimensions/duration.
   *
   * @param {VideoElement} element The element to download and probe
   * @returns {Promise<DownloadedMedia>} Downloaded media and metadata
   * @throws {ProcessingError}
   */
  private async downloadAndProbe(element: VideoElement): Promise<DownloadedMedia> {
    const url = element.source;
    const ext = this.inferExtensionFromUrl(url, element.type);
    const tmpPath = join(this.tmpDir, `${randomUUID()}${ext}`);

    await this.downloadFile(url, tmpPath);
    const probed = await this.ffprobe(tmpPath);

    return {
      element,
      path: tmpPath,
      width: probed.width,
      height: probed.height,
      duration: probed.duration,
      type: element.type,
    };
  }

  /**
   * Build the complex filter graph for overlays. Each input gets scaled and placed
   * based on percentage coordinates and fit mode, composited over the base canvas.
   *
   * @param {number} canvasW Canvas width in pixels
   * @param {number} canvasH Canvas height in pixels
   * @param {DownloadedMedia[]} mediaList Downloaded media list
   * @param {string[]} logs Log array for debug/error contexts
   * @returns {FilterBuildResult} Filter complex lines and final label
   */
  private buildFilterGraph(
    canvasW: number,
    canvasH: number,
    mediaList: DownloadedMedia[],
    logs: string[],
  ): FilterBuildResult {
    const filters: string[] = [];

    // Start from base label
    let currentLabel = 'base';
    filters.push(`[0:v]format=rgba,setsar=1[${currentLabel}]`);

    // For each media input (index + 1 because 0 is lavfi base)
    mediaList.forEach((media, idx) => {
      const inputLabel = `in${idx}`;
      const scaledLabel = `scaled${idx}`;
      const outLabel = `out${idx}`;

      // Map input stream to label
      filters.push(`[${idx + 1}:v]format=rgba,setsar=1[${inputLabel}]`);

      const el = media.element;
      const fit: FitMode = el.fit_mode ?? 'auto';
      const { targetW, targetH } = this.computeTargetSize(canvasW, canvasH, media.width, media.height, el.width, el.height, fit);
      const { x, y } = this.computePosition(canvasW, canvasH, targetW, targetH, el.x ?? '0%', el.y ?? '0%');

      // Scale with preservation of aspect ratio as needed
      const scaleExpr = this.scaleExpr(media.width, media.height, targetW, targetH, fit);
      filters.push(`[${inputLabel}]${scaleExpr}[${scaledLabel}]`);

      // Overlay onto currentLabel
      filters.push(`[${currentLabel}][${scaledLabel}]overlay=${x}:${y}:format=auto:eval=init[${outLabel}]`);
      currentLabel = outLabel;
    });

    return { filterComplex: filters, lastLabel: currentLabel };
  }

  /**
   * Compute target size in pixels from percentage strings and fit mode.
   *
   * @param {number} canvasW Canvas width
   * @param {number} canvasH Canvas height
   * @param {number|undefined} mediaW Source media width when known
   * @param {number|undefined} mediaH Source media height when known
   * @param {string|undefined} widthPct Target width percent string
   * @param {string|undefined} heightPct Target height percent string
   * @param {FitMode} fit Fit mode selection
   * @returns {{ targetW: number; targetH: number }} Target pixel size
   */
  private computeTargetSize(
    canvasW: number,
    canvasH: number,
    mediaW?: number,
    mediaH?: number,
    widthPct?: string,
    heightPct?: string,
    fit: FitMode = 'auto',
  ): { targetW: number; targetH: number } {
    const pct = (p?: string) => (p ? Math.max(0, Math.min(100, parseFloat(p))) / 100 : undefined);
    const wPct = pct(widthPct);
    const hPct = pct(heightPct);

    // Default to full canvas size if both undefined
    let targetW = Math.round((wPct ?? 1) * canvasW);
    let targetH = Math.round((hPct ?? 1) * canvasH);

    if (fit === 'auto' && mediaW && mediaH) {
      // Constrain within target box while preserving AR
      const ar = mediaW / mediaH;
      const boxAr = targetW / targetH;
      if (ar > boxAr) {
        targetH = Math.round(targetW / ar);
      } else {
        targetW = Math.round(targetH * ar);
      }
    }

    return { targetW: Math.max(1, targetW), targetH: Math.max(1, targetH) };
  }

  /**
   * Compute top-left position from percentage coordinates relative to canvas.
   * Defaults to 0% when not provided.
   *
   * @param {number} canvasW Canvas width
   * @param {number} canvasH Canvas height
   * @param {number} targetW Target width in pixels
   * @param {number} targetH Target height in pixels
   * @param {string|undefined} xPct X position percentage
   * @param {string|undefined} yPct Y position percentage
   * @returns {{ x: number; y: number }} Top-left pixel position
   */
  private computePosition(
    canvasW: number,
    canvasH: number,
    targetW: number,
    targetH: number,
    xPct?: string,
    yPct?: string,
  ): { x: number; y: number } {
    const pct = (p?: string) => (p ? Math.max(0, Math.min(100, parseFloat(p))) / 100 : 0);
    const x = Math.round(pct(xPct) * (canvasW - targetW));
    const y = Math.round(pct(yPct) * (canvasH - targetH));
    return { x, y };
  }

  /**
   * Build scaling expression considering fit mode semantics.
   *
   * @param {number|undefined} mediaW Source width
   * @param {number|undefined} mediaH Source height
   * @param {number} targetW Target width
   * @param {number} targetH Target height
   * @param {FitMode} fit Fit mode selection
   * @returns {string} FFmpeg scale/crop/pad expression
   */
  private scaleExpr(
    mediaW: number | undefined,
    mediaH: number | undefined,
    targetW: number,
    targetH: number,
    fit: FitMode,
  ): string {
    // Use FFmpeg scale with force_original_aspect_ratio and crop/pad for cover/contain
    // Use eval=init values from computed pixel sizes to keep graph simple
    if (fit === 'fill') {
      return `scale=${targetW}:${targetH}:flags=lanczos`;
    }

    if (!mediaW || !mediaH) {
      return `scale=${targetW}:${targetH}:flags=lanczos`;
    }

    const ar = mediaW / mediaH;
    const boxAr = targetW / targetH;

    if (fit === 'cover') {
      // Scale to cover then crop center to target
      // First scale so that smaller dimension matches, then crop
      const scaleW = ar < boxAr ? targetW : Math.round(targetH * ar);
      const scaleH = ar < boxAr ? Math.round(targetW / ar) : targetH;
      const cropX = Math.max(0, Math.round((scaleW - targetW) / 2));
      const cropY = Math.max(0, Math.round((scaleH - targetH) / 2));
      return `scale=${scaleW}:${scaleH}:flags=lanczos,crop=${targetW}:${targetH}:${cropX}:${cropY}`;
    }

    if (fit === 'contain' || fit === 'auto') {
      // Scale to fit within box, pad with transparent/black as necessary
      const scaleW = ar > boxAr ? targetW : Math.round(targetH * ar);
      const scaleH = ar > boxAr ? Math.round(targetW / ar) : targetH;
      const padX = Math.max(0, Math.round((targetW - scaleW) / 2));
      const padY = Math.max(0, Math.round((targetH - scaleH) / 2));
      return `scale=${scaleW}:${scaleH}:flags=lanczos,pad=${targetW}:${targetH}:${padX}:${padY}:color=0x00000000`;
    }

    return `scale=${targetW}:${targetH}:flags=lanczos`;
  }

  /**
   * Estimate target duration for the output when using a lavfi color base.
   * Use max of all video durations when available, otherwise default to 10s.
   *
   * @param {DownloadedMedia[]} mediaList List of media with probed durations
   * @returns {number} Duration in seconds
   */
  private estimateTargetDuration(mediaList: DownloadedMedia[]): number {
    const durations = mediaList.map((m) => m.duration ?? 0);
    const max = Math.max(0, ...durations);
    return max > 0 ? Math.ceil(max) : 10;
  }

  /**
   * Parse a progress percent from ffmpeg timemark based on estimated duration.
   *
   * @param {string|undefined} timemark FFmpeg timemark (HH:MM:SS.xx)
   * @param {DownloadedMedia[]} mediaList Media list to estimate total duration
   * @returns {number|undefined} Percent complete 0-100
   */
  private parsePercent(timemark: string | undefined, mediaList: DownloadedMedia[]): number | undefined {
    if (!timemark) return undefined;
    const total = this.estimateTargetDuration(mediaList);
    const seconds = this.parseTimeToSeconds(timemark);
    if (!seconds || total <= 0) return undefined;
    const pct = Math.max(0, Math.min(100, (seconds / total) * 100));
    return Math.round(pct);
  }

  /**
   * Convert HH:MM:SS.xx timemark to seconds.
   *
   * @param {string} t Timemark
   * @returns {number|undefined} Seconds
   */
  private parseTimeToSeconds(t: string | undefined): number | undefined {
    const m = (t ?? '').match(/(?:(\d+):)?(\d+):(\d+\.?\d*)/);
    if (!m) return undefined;
    const hours = m[1] ? parseInt(String(m[1]), 10) : 0;
    const minutes = parseInt(String(m[2]), 10);
    const seconds = parseFloat(String(m[3]));
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Resolve quality options by format defaults.
   *
   * @param {string} format Output container format
   * @param {QualityOptions} options Requested quality options
   * @returns {QualityOptions} Final merged options
   */
  private resolveQualityOptions(format: string, options: QualityOptions): QualityOptions {
    const defaults: Record<string, QualityOptions> = {
      mp4: { codec: 'libx264', crf: 23, preset: 'medium', audioBitrate: '128k' },
      mov: { codec: 'libx264', crf: 20, preset: 'slow', audioBitrate: '192k' },
      avi: { codec: 'libx264', crf: 23, preset: 'medium', audioBitrate: '128k' },
    };
    const base = defaults[format] ?? {};
    return { ...base, ...options };
  }

  /**
   * Download a file via HTTP(S) to the specified path with streaming and validation.
   *
   * @param {string} url Source URL
   * @param {string} destPath Destination file path
   * @returns {Promise<void>}
   * @throws {ProcessingError}
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 30000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'VideoProcessor/1.0' },
        validateStatus: (s) => s >= 200 && s < 400,
      });

      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(destPath);
        (response.data as NodeJS.ReadableStream)
          .on('error', reject)
          .pipe(writer)
          .on('error', reject)
          .on('finish', () => resolve());
      });
    } catch (e) {
      throw new ProcessingError(`Failed to download media: ${url}`, undefined, { cause: this.errInfo(e) });
    }
  }

  /**
   * Probe media file for metadata using ffprobe.
   *
   * @param {string} path Local file path
   * @returns {Promise<{ width?: number; height?: number; duration?: number }>} Metadata
   */
  private async ffprobe(path: string): Promise<{ width?: number; height?: number; duration?: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(path, (err, meta) => {
        if (err) return reject(err);
        const video = meta.streams.find((s) => s.codec_type === 'video');
        const duration = meta.format.duration;
        const out: any = {};
        if (typeof video?.width === 'number') out.width = video.width;
        if (typeof video?.height === 'number') out.height = video.height;
        if (typeof duration === 'number') out.duration = duration;
        resolve(out);
      });
    });
  }

  /**
   * Infer local file extension from URL and element type to help container selection.
   *
   * @param {string} url Source URL
   * @param {'video'|'image'} type Element type
   * @returns {string} Extension with dot
   */
  private inferExtensionFromUrl(url: string, type: 'video' | 'image'): string {
    const u = new URL(url);
    const file = basename(u.pathname);
    const ext = extname(file).toLowerCase();
    if (ext) return ext;
    return type === 'image' ? '.png' : '.mp4';
  }

  /**
   * Ensure temporary directory exists.
   */
  private ensureTmpDir(): void {
    if (!existsSync(this.tmpDir)) {
      // Using fs.promises.mkdir with recursive true to avoid race
      try { require('fs').mkdirSync(this.tmpDir, { recursive: true }); } catch (e) {
        logger.warn('Failed to pre-create tmp dir, attempting later ops may create it', { error: this.errInfo(e) });
      }
    }
  }

  /**
   * Best-effort cleanup of temporary files.
   *
   * @param {string[]} paths Paths to unlink
   */
  private async safeCleanup(paths: string[]): Promise<void> {
    await Promise.all(paths.map(async (p) => {
      try { await fsp.unlink(p); } catch {}
    }));
  }

  /**
   * Create a ProcessingError with parsed FFmpeg stderr for better diagnostics.
   *
   * @param {unknown} err Original error
   * @param {string[]} logs Stderr lines
   * @returns {ProcessingError} Wrapped error with details
   */
  private parseFfmpegError(err: unknown, logs: string[]): ProcessingError {
    const message = err instanceof Error ? err.message : String(err);
    const stderr = logs.slice(-200).join('\n');
    const parsed = this.parseStderr(stderr);
    return new ProcessingError('FFmpeg processing failed', undefined, { message, ...parsed });
  }

  /**
   * Normalize non-ProcessingError into ProcessingError, attaching stderr context.
   *
   * @param {unknown} err Error
   * @param {string[]} logs Stderr lines
   * @returns {ProcessingError}
   */
  private wrapError(err: unknown, logs: string[]): ProcessingError {
    if (err instanceof ProcessingError) return err;
    if (err instanceof TimeoutError) return err;
    const message = err instanceof Error ? err.message : String(err);
    const stderr = logs.slice(-200).join('\n');
    const parsed = this.parseStderr(stderr);
    return new ProcessingError(message, undefined, parsed);
  }

  private errInfo(e: unknown): any {
    if (e instanceof Error) {
      return { name: e.name, message: e.message, stack: e.stack };
    }
    return { message: String(e) };
  }

  /**
   * Parse FFmpeg stderr to extract structured diagnostics.
   *
   * @param {string} stderr FFmpeg stderr capture
   * @returns {{ stderr: string; code?: string; reason?: string }} Parsed details
   */
  private parseStderr(stderr: string): { stderr: string; code?: string; reason?: string } {
    const s = stderr || '';
    if (/No such file or directory/i.test(s)) {
      return { stderr: s, code: 'ENOENT', reason: 'Input file missing or unreadable' };
    }
    if (/Invalid data found when processing input/i.test(s)) {
      return { stderr: s, code: 'EBADINPUT', reason: 'Invalid input stream or corrupt file' };
    }
    if (/Decoder \(.*\) not found/i.test(s)) {
      return { stderr: s, code: 'EDECODER', reason: 'Required decoder not found in ffmpeg build' };
    }
    if (/Time limit exceeded|SIGKILL/i.test(s)) {
      return { stderr: s, code: 'ETIME', reason: 'Processing interrupted or exceeded time limit' };
    }
    if (/Cannot allocate memory/i.test(s)) {
      return { stderr: s, code: 'ENOMEM', reason: 'Insufficient memory during processing' };
    }
    return { stderr: s };
  }
}


