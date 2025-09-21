import { ProcessingEstimator } from '../src/services/Estimator';
import { VideoCreateRequest } from '../src/types/api';

describe('ProcessingEstimator', () => {
  let estimator: ProcessingEstimator;

  beforeEach(() => {
    estimator = new ProcessingEstimator();
  });

  it('should return a base estimation for a simple request', async () => {
    const request: VideoCreateRequest = {
      output_format: 'mp4',
      width: 1280,
      height: 720,
      elements: [],
    };

    const result = await estimator.estimate(request);
    expect(result.estimatedMs).toBeGreaterThan(0);
  });

  it('should increase estimation for higher resolution', async () => {
    const lowResRequest: VideoCreateRequest = {
      output_format: 'mp4',
      width: 1280,
      height: 720,
      elements: [],
    };

    const highResRequest: VideoCreateRequest = {
      output_format: 'mp4',
      width: 1920,
      height: 1080,
      elements: [],
    };

    const lowResResult = await estimator.estimate(lowResRequest);
    const highResResult = await estimator.estimate(highResRequest);

    expect(highResResult.estimatedMs).toBeGreaterThan(lowResResult.estimatedMs);
  });

  it('should increase estimation for more elements', async () => {
    const oneElementRequest: VideoCreateRequest = {
      output_format: 'mp4',
      width: 1280,
      height: 720,
      elements: [{ id: '1', type: 'image', source: 'http://example.com/image.png', track: 0 }],
    };

    const twoElementRequest: VideoCreateRequest = {
      output_format: 'mp4',
      width: 1280,
      height: 720,
      elements: [
        { id: '1', type: 'image', source: 'http://example.com/image.png', track: 0 },
        { id: '2', type: 'video', source: 'http://example.com/video.mp4', track: 1 },
      ],
    };

    const oneElementResult = await estimator.estimate(oneElementRequest);
    const twoElementResult = await estimator.estimate(twoElementRequest);

    expect(twoElementResult.estimatedMs).toBeGreaterThan(oneElementResult.estimatedMs);
  });
});