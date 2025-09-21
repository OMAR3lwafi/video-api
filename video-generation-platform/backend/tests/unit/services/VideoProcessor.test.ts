import { VideoProcessor } from '@/services/VideoProcessor';
import { TestDataFactory } from '../../factories/TestDataFactory';
import { DatabaseFixtures } from '../../fixtures/DatabaseFixtures';
import * as fs from 'fs';
import * as path from 'path';
import { VideoElement, VideoJob } from '@/types';

// Mock dependencies
jest.mock('fluent-ffmpeg');
jest.mock('fs');
jest.mock('path');

describe('VideoProcessor', () => {
  let videoProcessor: VideoProcessor;
  let mockFfmpeg: any;
  let mockFs: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup FFmpeg mock
    mockFfmpeg = {
      input: jest.fn().mockReturnThis(),
      output: jest.fn().mockReturnThis(),
      format: jest.fn().mockReturnThis(),
      size: jest.fn().mockReturnThis(),
      fps: jest.fn().mockReturnThis(),
      videoCodec: jest.fn().mockReturnThis(),
      audioCodec: jest.fn().mockReturnThis(),
      complexFilter: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      run: jest.fn().mockImplementation(callback => {
        setTimeout(() => callback(), 100);
      }),
      ffprobe: jest.fn((inputPath, callback) => {
        callback(null, {
          streams: [
            {
              codec_type: 'video',
              width: 1920,
              height: 1080,
              duration: '30.0',
              bit_rate: '5000000',
            },
            {
              codec_type: 'audio',
              duration: '30.0',
              bit_rate: '128000',
            },
          ],
          format: {
            duration: '30.0',
            size: '18750000',
            format_name: 'mp4',
          },
        });
      }),
    };

    // Mock fluent-ffmpeg constructor
    const fluentFfmpeg = require('fluent-ffmpeg');
    fluentFfmpeg.mockImplementation(() => mockFfmpeg);

    // Setup fs mock
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.promises.unlink = jest.fn().mockResolvedValue(undefined);
    mockFs.promises.access = jest.fn().mockResolvedValue(undefined);
    mockFs.promises.stat = jest.fn().mockResolvedValue({ size: 1024 });

    videoProcessor = new VideoProcessor();
  });

  describe('processVideo', () => {
    it('should successfully process a simple video job', async () => {
      const job = TestDataFactory.createVideoJob({
        elements: [
          TestDataFactory.createVideoElement({
            source: 'https://test-bucket.s3.amazonaws.com/input.mp4',
            track: 1,
          }),
        ],
        output_format: 'mp4',
        width: 1920,
        height: 1080,
      });

      const result = await videoProcessor.processVideo(job);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('outputPath');
      expect(result).toHaveProperty('processingTime');
      expect(result.outputPath).toMatch(/\.mp4$/);
      expect(mockFfmpeg.input).toHaveBeenCalled();
      expect(mockFfmpeg.output).toHaveBeenCalled();
      expect(mockFfmpeg.run).toHaveBeenCalled();
    });

    it('should handle video jobs with multiple elements', async () => {
      const job = TestDataFactory.createVideoJob({
        elements: [
          TestDataFactory.createVideoElement({ track: 1 }),
          TestDataFactory.createImageElement({ track: 2 }),
          TestDataFactory.createVideoElement({ track: 3 }),
        ],
        output_format: 'mp4',
        width: 1920,
        height: 1080,
      });

      const result = await videoProcessor.processVideo(job);

      expect(result.success).toBe(true);
      expect(mockFfmpeg.complexFilter).toHaveBeenCalled();
      expect(mockFfmpeg.input).toHaveBeenCalledTimes(3);
    });

    it('should handle different output formats', async () => {
      const formats = ['mp4', 'mov', 'avi'] as const;

      for (const format of formats) {
        const job = TestDataFactory.createVideoJob({
          elements: [TestDataFactory.createVideoElement()],
          output_format: format,
        });

        const result = await videoProcessor.processVideo(job);

        expect(result.success).toBe(true);
        expect(result.outputPath).toMatch(new RegExp(`\\.${format}$`));
        expect(mockFfmpeg.format).toHaveBeenCalledWith(format);
      }
    });

    it('should handle image elements with duration', async () => {
      const job = TestDataFactory.createVideoJob({
        elements: [
          TestDataFactory.createImageElement({
            duration: '10',
            track: 1,
          }),
        ],
        output_format: 'mp4',
      });

      const result = await videoProcessor.processVideo(job);

      expect(result.success).toBe(true);
      expect(mockFfmpeg.input).toHaveBeenCalled();
    });

    it('should apply scaling and positioning filters', async () => {
      const job = TestDataFactory.createVideoJob({
        elements: [
          TestDataFactory.createVideoElement({
            x: '10%',
            y: '20%',
            width: '80%',
            height: '60%',
            fit_mode: 'contain',
            track: 1,
          }),
        ],
        width: 1920,
        height: 1080,
      });

      const result = await videoProcessor.processVideo(job);

      expect(result.success).toBe(true);
      expect(mockFfmpeg.complexFilter).toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      mockFfmpeg.run = jest.fn().mockImplementation(callback => {
        setTimeout(() => callback(new Error('FFmpeg processing failed')), 100);
      });

      const job = TestDataFactory.createVideoJob();

      const result = await videoProcessor.processVideo(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('FFmpeg processing failed');
    });

    it('should validate input files before processing', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(false);

      const job = TestDataFactory.createVideoJob({
        elements: [
          TestDataFactory.createVideoElement({
            source: 'https://test-bucket.s3.amazonaws.com/nonexistent.mp4',
          }),
        ],
      });

      const result = await videoProcessor.processVideo(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input file not found');
    });

    it('should timeout long-running processes', async () => {
      jest.setTimeout(10000);

      mockFfmpeg.run = jest.fn().mockImplementation(() => {
        // Simulate a process that never completes
      });

      const job = TestDataFactory.createVideoJob();

      const startTime = Date.now();
      const result = await videoProcessor.processVideo(job, { timeout: 1000 });
      const endTime = Date.now();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(endTime - startTime).toBeLessThan(2000);
    }, 10000);

    it('should clean up temporary files after processing', async () => {
      const job = TestDataFactory.createVideoJob();

      await videoProcessor.processVideo(job);

      expect(mockFs.promises.unlink).toHaveBeenCalled();
    });

    it('should generate progress updates during processing', async () => {
      const progressCallback = jest.fn();
      const job = TestDataFactory.createVideoJob();

      mockFfmpeg.on = jest.fn().mockImplementation((event, callback) => {
        if (event === 'progress') {
          setTimeout(() => {
            callback({ percent: 25, timemark: '00:00:07.50' });
            callback({ percent: 50, timemark: '00:00:15.00' });
            callback({ percent: 75, timemark: '00:00:22.50' });
            callback({ percent: 100, timemark: '00:00:30.00' });
          }, 50);
        }
        return mockFfmpeg;
      });

      await videoProcessor.processVideo(job, { onProgress: progressCallback });

      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({
        percent: expect.any(Number),
        currentStep: expect.any(String),
      }));
    });
  });

  describe('estimateProcessingTime', () => {
    it('should estimate processing time based on job complexity', () => {
      const simpleJob = TestDataFactory.createVideoJob({
        elements: [TestDataFactory.createImageElement()],
        width: 1280,
        height: 720,
      });

      const complexJob = TestDataFactory.createVideoJob({
        elements: [
          TestDataFactory.createVideoElement(),
          TestDataFactory.createVideoElement(),
          TestDataFactory.createImageElement(),
        ],
        width: 3840,
        height: 2160,
      });

      const simpleEstimate = videoProcessor.estimateProcessingTime(simpleJob);
      const complexEstimate = videoProcessor.estimateProcessingTime(complexJob);

      expect(simpleEstimate).toBeGreaterThan(0);
      expect(complexEstimate).toBeGreaterThan(simpleEstimate);
    });

    it('should consider different element types in estimation', () => {
      const videoJob = TestDataFactory.createVideoJob({
        elements: [TestDataFactory.createVideoElement()],
      });

      const imageJob = TestDataFactory.createVideoJob({
        elements: [TestDataFactory.createImageElement()],
      });

      const videoEstimate = videoProcessor.estimateProcessingTime(videoJob);
      const imageEstimate = videoProcessor.estimateProcessingTime(imageJob);

      expect(videoEstimate).toBeGreaterThan(imageEstimate);
    });

    it('should consider output resolution in estimation', () => {
      const hdJob = TestDataFactory.createVideoJob({
        elements: [TestDataFactory.createVideoElement()],
        width: 1920,
        height: 1080,
      });

      const fourKJob = TestDataFactory.createVideoJob({
        elements: [TestDataFactory.createVideoElement()],
        width: 3840,
        height: 2160,
      });

      const hdEstimate = videoProcessor.estimateProcessingTime(hdJob);
      const fourKEstimate = videoProcessor.estimateProcessingTime(fourKJob);

      expect(fourKEstimate).toBeGreaterThan(hdEstimate);
    });
  });

  describe('validateElements', () => {
    it('should validate video elements successfully', async () => {
      const elements = [
        TestDataFactory.createVideoElement(),
        TestDataFactory.createImageElement(),
      ];

      const result = await videoProcessor.validateElements(elements);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid element sources', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(false);

      const elements = [
        TestDataFactory.createVideoElement({
          source: 'https://invalid-url.com/nonexistent.mp4',
        }),
      ];

      const result = await videoProcessor.validateElements(elements);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Invalid source'));
    });

    it('should validate element positioning', async () => {
      const elements = [
        TestDataFactory.createVideoElement({
          x: '150%', // Invalid position
          y: '-10%', // Invalid position
        }),
      ];

      const result = await videoProcessor.validateElements(elements);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate element durations', async () => {
      const elements = [
        TestDataFactory.createImageElement({
          duration: '-5', // Invalid duration
        }),
      ];

      const result = await videoProcessor.validateElements(elements);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('duration'));
    });

    it('should validate track numbers', async () => {
      const elements = [
        TestDataFactory.createVideoElement({ track: 0 }), // Invalid track
        TestDataFactory.createVideoElement({ track: -1 }), // Invalid track
      ];

      const result = await videoProcessor.validateElements(elements);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getVideoInfo', () => {
    it('should extract video metadata', async () => {
      const videoPath = '/path/to/test-video.mp4';

      const info = await videoProcessor.getVideoInfo(videoPath);

      expect(info).toHaveProperty('width', 1920);
      expect(info).toHaveProperty('height', 1080);
      expect(info).toHaveProperty('duration', 30.0);
      expect(info).toHaveProperty('format', 'mp4');
      expect(mockFfmpeg.ffprobe).toHaveBeenCalledWith(videoPath, expect.any(Function));
    });

    it('should handle ffprobe errors', async () => {
      mockFfmpeg.ffprobe = jest.fn((inputPath, callback) => {
        callback(new Error('Unable to probe video file'), null);
      });

      const videoPath = '/path/to/invalid-video.mp4';

      await expect(videoProcessor.getVideoInfo(videoPath)).rejects.toThrow('Unable to probe video file');
    });

    it('should handle missing video streams', async () => {
      mockFfmpeg.ffprobe = jest.fn((inputPath, callback) => {
        callback(null, {
          streams: [], // No video streams
          format: { duration: '0' },
        });
      });

      const videoPath = '/path/to/audio-only.mp3';

      await expect(videoProcessor.getVideoInfo(videoPath)).rejects.toThrow('No video stream found');
    });
  });

  describe('generateFilterChain', () => {
    it('should generate filter chain for single element', () => {
      const elements = [TestDataFactory.createVideoElement({ track: 1 })];
      const outputWidth = 1920;
      const outputHeight = 1080;

      const filterChain = videoProcessor.generateFilterChain(elements, outputWidth, outputHeight);

      expect(filterChain).toContain('scale');
      expect(filterChain).toContain('overlay');
    });

    it('should generate complex filter chain for multiple elements', () => {
      const elements = [
        TestDataFactory.createVideoElement({ track: 1 }),
        TestDataFactory.createImageElement({ track: 2 }),
        TestDataFactory.createVideoElement({ track: 3 }),
      ];
      const outputWidth = 1920;
      const outputHeight = 1080;

      const filterChain = videoProcessor.generateFilterChain(elements, outputWidth, outputHeight);

      expect(filterChain).toContain('[0:v]');
      expect(filterChain).toContain('[1:v]');
      expect(filterChain).toContain('[2:v]');
      expect(filterChain.split('overlay').length).toBe(3); // Two overlay operations for 3 elements
    });

    it('should apply fit modes correctly', () => {
      const elements = [
        TestDataFactory.createVideoElement({
          fit_mode: 'contain',
          track: 1,
        }),
      ];

      const filterChain = videoProcessor.generateFilterChain(elements, 1920, 1080);

      expect(filterChain).toContain('scale');
      expect(filterChain).toContain('pad');
    });

    it('should handle positioning correctly', () => {
      const elements = [
        TestDataFactory.createVideoElement({
          x: '25%',
          y: '50%',
          track: 1,
        }),
      ];

      const filterChain = videoProcessor.generateFilterChain(elements, 1920, 1080);

      expect(filterChain).toContain('overlay=480:540'); // 25% of 1920 and 50% of 1080
    });
  });

  describe('performance optimization', () => {
    it('should use hardware acceleration when available', async () => {
      const job = TestDataFactory.createVideoJob();

      await videoProcessor.processVideo(job, { useHardwareAcceleration: true });

      expect(mockFfmpeg.videoCodec).toHaveBeenCalledWith(expect.stringContaining('h264'));
    });

    it('should optimize for different quality settings', async () => {
      const job = TestDataFactory.createVideoJob();

      await videoProcessor.processVideo(job, { quality: 'high' });

      expect(mockFfmpeg.output).toHaveBeenCalled();
    });

    it('should handle concurrent processing limits', async () => {
      const jobs = Array.from({ length: 5 }, () => TestDataFactory.createVideoJob());

      const promises = jobs.map(job => videoProcessor.processVideo(job));
      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('error handling and recovery', () => {
    it('should retry failed operations', async () => {
      let attempt = 0;
      mockFfmpeg.run = jest.fn().mockImplementation(callback => {
        attempt++;
        if (attempt < 3) {
          setTimeout(() => callback(new Error('Temporary failure')), 100);
        } else {
          setTimeout(() => callback(), 100);
        }
      });

      const job = TestDataFactory.createVideoJob();

      const result = await videoProcessor.processVideo(job, { maxRetries: 3 });

      expect(result.success).toBe(true);
      expect(mockFfmpeg.run).toHaveBeenCalledTimes(3);
    });

    it('should handle out of memory errors', async () => {
      mockFfmpeg.run = jest.fn().mockImplementation(callback => {
        setTimeout(() => callback(new Error('Cannot allocate memory')), 100);
      });

      const job = TestDataFactory.createVideoJob();

      const result = await videoProcessor.processVideo(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('memory');
    });

    it('should handle disk space errors', async () => {
      mockFfmpeg.run = jest.fn().mockImplementation(callback => {
        setTimeout(() => callback(new Error('No space left on device')), 100);
      });

      const job = TestDataFactory.createVideoJob();

      const result = await videoProcessor.processVideo(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('space');
    });
  });

  describe('cleanup and resource management', () => {
    it('should clean up temporary files on success', async () => {
      const job = TestDataFactory.createVideoJob();

      await videoProcessor.processVideo(job);

      expect(mockFs.promises.unlink).toHaveBeenCalled();
    });

    it('should clean up temporary files on error', async () => {
      mockFfmpeg.run = jest.fn().mockImplementation(callback => {
        setTimeout(() => callback(new Error('Processing failed')), 100);
      });

      const job = TestDataFactory.createVideoJob();

      await videoProcessor.processVideo(job);

      expect(mockFs.promises.unlink).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockFs.promises.unlink = jest.fn().mockRejectedValue(new Error('Permission denied'));

      const job = TestDataFactory.createVideoJob();

      const result = await videoProcessor.processVideo(job);

      // Should still complete successfully even if cleanup fails
      expect(result.success).toBe(true);
    });
  });
});
