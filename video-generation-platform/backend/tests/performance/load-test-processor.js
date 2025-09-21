/**
 * Artillery Load Test Processor
 * Helper functions and utilities for load testing scenarios
 */

const { faker } = require('@faker-js/faker');

// Mock data for testing
const mockJobIds = [];
const mockUserIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

// Performance metrics collection
const performanceMetrics = {
  videoCreationTimes: [],
  jobStatusTimes: [],
  errorCounts: {
    validation: 0,
    processing: 0,
    timeout: 0,
    server: 0
  },
  concurrencyStats: {
    maxConcurrent: 0,
    currentConcurrent: 0
  }
};

/**
 * Generate a random video job configuration
 */
function generateVideoJob(requestParams, context, ee, next) {
  const formats = ['mp4', 'mov', 'avi'];
  const resolutions = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 }
  ];

  const selectedFormat = faker.helpers.arrayElement(formats);
  const selectedResolution = faker.helpers.arrayElement(resolutions);
  const elementCount = faker.number.int({ min: 1, max: 5 });

  const elements = [];
  for (let i = 0; i < elementCount; i++) {
    if (faker.datatype.boolean()) {
      // Video element
      elements.push({
        id: faker.string.uuid(),
        type: 'video',
        source: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: 'mp4' })}`,
        track: i + 1,
        x: `${faker.number.int({ min: 0, max: 20 })}%`,
        y: `${faker.number.int({ min: 0, max: 20 })}%`,
        width: `${faker.number.int({ min: 80, max: 100 })}%`,
        height: `${faker.number.int({ min: 80, max: 100 })}%`,
        fit_mode: faker.helpers.arrayElement(['auto', 'contain', 'cover', 'fill']),
        start_time: faker.number.int({ min: 0, max: 10 }).toString(),
        duration: faker.number.int({ min: 10, max: 60 }).toString()
      });
    } else {
      // Image element
      elements.push({
        id: faker.string.uuid(),
        type: 'image',
        source: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: 'jpg' })}`,
        track: i + 1,
        x: `${faker.number.int({ min: 0, max: 30 })}%`,
        y: `${faker.number.int({ min: 0, max: 30 })}%`,
        width: `${faker.number.int({ min: 50, max: 90 })}%`,
        height: `${faker.number.int({ min: 50, max: 90 })}%`,
        fit_mode: faker.helpers.arrayElement(['auto', 'contain', 'cover', 'fill']),
        duration: faker.number.int({ min: 1, max: 30 }).toString()
      });
    }
  }

  // Set variables for the request
  context.vars.videoFormat = selectedFormat;
  context.vars.videoWidth = selectedResolution.width;
  context.vars.videoHeight = selectedResolution.height;
  context.vars.videoElements = elements;

  return next();
}

/**
 * Generate a simple video job for quick processing
 */
function generateSimpleVideoJob(requestParams, context, ee, next) {
  const simpleElements = [
    {
      id: faker.string.uuid(),
      type: 'image',
      source: 'https://test-bucket.s3.amazonaws.com/simple-image.jpg',
      track: 1,
      x: '0%',
      y: '0%',
      width: '100%',
      height: '100%',
      fit_mode: 'contain',
      duration: '5'
    }
  ];

  context.vars.simpleElements = simpleElements;
  return next();
}

/**
 * Generate a complex video job for async processing
 */
function generateComplexVideoJob(requestParams, context, ee, next) {
  const complexElements = [];

  // Generate 5-10 elements for complex processing
  const elementCount = faker.number.int({ min: 5, max: 10 });

  for (let i = 0; i < elementCount; i++) {
    complexElements.push({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['video', 'image']),
      source: `https://test-bucket.s3.amazonaws.com/${faker.system.fileName({ extension: faker.helpers.arrayElement(['mp4', 'jpg', 'png']) })}`,
      track: i + 1,
      x: `${faker.number.int({ min: 0, max: 50 })}%`,
      y: `${faker.number.int({ min: 0, max: 50 })}%`,
      width: `${faker.number.int({ min: 30, max: 100 })}%`,
      height: `${faker.number.int({ min: 30, max: 100 })}%`,
      fit_mode: faker.helpers.arrayElement(['auto', 'contain', 'cover', 'fill']),
      start_time: faker.number.int({ min: 0, max: 30 }).toString(),
      duration: faker.number.int({ min: 5, max: 120 }).toString()
    });
  }

  context.vars.complexElements = complexElements;
  return next();
}

/**
 * Generate stress test job configuration
 */
function generateStressTestJob(requestParams, context, ee, next) {
  const formats = ['mp4', 'mov', 'avi'];
  const resolutions = [
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 }
  ];

  const selectedFormat = faker.helpers.arrayElement(formats);
  const selectedResolution = faker.helpers.arrayElement(resolutions);

  // Generate more elements for stress testing
  const elementCount = faker.number.int({ min: 3, max: 8 });
  const elements = [];

  for (let i = 0; i < elementCount; i++) {
    elements.push({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['video', 'image']),
      source: `https://test-bucket.s3.amazonaws.com/stress-test-${i}.${faker.helpers.arrayElement(['mp4', 'jpg'])}`,
      track: i + 1,
      x: `${faker.number.int({ min: 0, max: 40 })}%`,
      y: `${faker.number.int({ min: 0, max: 40 })}%`,
      width: `${faker.number.int({ min: 60, max: 100 })}%`,
      height: `${faker.number.int({ min: 60, max: 100 })}%`,
      fit_mode: 'contain',
      duration: faker.number.int({ min: 10, max: 180 }).toString()
    });
  }

  context.vars.videoFormat = selectedFormat;
  context.vars.videoWidth = selectedResolution.width;
  context.vars.videoHeight = selectedResolution.height;
  context.vars.stressTestElements = elements;

  return next();
}

/**
 * Generate large video job for memory testing
 */
function generateLargeVideoJob(requestParams, context, ee, next) {
  const largeElements = [];

  // Generate many elements to test memory usage
  const elementCount = faker.number.int({ min: 8, max: 15 });

  for (let i = 0; i < elementCount; i++) {
    largeElements.push({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(['video', 'image']),
      source: `https://test-bucket.s3.amazonaws.com/large-test-${i}.${faker.helpers.arrayElement(['mp4', 'mov', 'jpg', 'png'])}`,
      track: i + 1,
      x: `${faker.number.int({ min: 0, max: 20 })}%`,
      y: `${faker.number.int({ min: 0, max: 20 })}%`,
      width: `${faker.number.int({ min: 80, max: 100 })}%`,
      height: `${faker.number.int({ min: 80, max: 100 })}%`,
      fit_mode: faker.helpers.arrayElement(['auto', 'contain', 'cover', 'fill']),
      start_time: faker.number.int({ min: 0, max: 60 }).toString(),
      duration: faker.number.int({ min: 30, max: 300 }).toString()
    });
  }

  context.vars.largeElementsArray = largeElements;
  return next();
}

/**
 * Get a random job ID for testing
 */
function getRandomJobId(requestParams, context, ee, next) {
  // Use either a real job ID from previous requests or a mock one
  let jobId;

  if (mockJobIds.length > 0 && faker.datatype.boolean()) {
    jobId = faker.helpers.arrayElement(mockJobIds);
  } else {
    jobId = `job-${faker.string.uuid()}`;
  }

  context.vars.jobId = jobId;
  return next();
}

/**
 * Get a random user ID for testing
 */
function getRandomUserId(requestParams, context, ee, next) {
  const userId = faker.helpers.arrayElement(mockUserIds);
  context.vars.userId = userId;
  return next();
}

/**
 * Store job ID from response for later use
 */
function storeJobId(requestParams, response, context, ee, next) {
  if (response.body && typeof response.body === 'string') {
    try {
      const body = JSON.parse(response.body);
      if (body.job_id && mockJobIds.length < 1000) { // Limit stored IDs to prevent memory issues
        mockJobIds.push(body.job_id);
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
  }
  return next();
}

/**
 * Track performance metrics
 */
function trackPerformance(requestParams, response, context, ee, next) {
  const responseTime = response.timings ? response.timings.response : 0;
  const statusCode = response.statusCode;

  // Track response times by endpoint
  if (requestParams.url && requestParams.url.includes('/videocreate')) {
    performanceMetrics.videoCreationTimes.push(responseTime);
  } else if (requestParams.url && requestParams.url.includes('/videoresult')) {
    performanceMetrics.jobStatusTimes.push(responseTime);
  }

  // Track errors
  if (statusCode >= 400) {
    if (statusCode === 400) {
      performanceMetrics.errorCounts.validation++;
    } else if (statusCode === 408 || statusCode === 504) {
      performanceMetrics.errorCounts.timeout++;
    } else if (statusCode >= 500) {
      performanceMetrics.errorCounts.server++;
    } else {
      performanceMetrics.errorCounts.processing++;
    }
  }

  // Emit custom metrics to Artillery
  ee.emit('customStat', 'response_time_ms', responseTime);
  ee.emit('customStat', `status_code_${statusCode}`, 1);

  return next();
}

/**
 * Track concurrency
 */
function trackConcurrency(requestParams, context, ee, next) {
  performanceMetrics.concurrencyStats.currentConcurrent++;
  if (performanceMetrics.concurrencyStats.currentConcurrent > performanceMetrics.concurrencyStats.maxConcurrent) {
    performanceMetrics.concurrencyStats.maxConcurrent = performanceMetrics.concurrencyStats.currentConcurrent;
  }

  // Emit concurrency metric
  ee.emit('customStat', 'concurrent_users', performanceMetrics.concurrencyStats.currentConcurrent);

  return next();
}

/**
 * Cleanup concurrency tracking
 */
function cleanupConcurrency(requestParams, context, ee, next) {
  performanceMetrics.concurrencyStats.currentConcurrent = Math.max(0,
    performanceMetrics.concurrencyStats.currentConcurrent - 1);
  return next();
}

/**
 * Validate video creation response
 */
function validateVideoCreationResponse(requestParams, response, context, ee, next) {
  if (response.statusCode === 200 || response.statusCode === 202) {
    try {
      const body = JSON.parse(response.body);

      // Validate required fields based on status
      if (response.statusCode === 200) {
        // Immediate completion
        if (!body.result_url || !body.job_id || !body.processing_time) {
          ee.emit('customStat', 'validation_error_completed_response', 1);
          console.warn('Invalid completed response format:', body);
        }
      } else {
        // Async processing
        if (!body.job_id || !body.estimated_completion || !body.status_check_endpoint) {
          ee.emit('customStat', 'validation_error_async_response', 1);
          console.warn('Invalid async response format:', body);
        }
      }
    } catch (e) {
      ee.emit('customStat', 'validation_error_json_parse', 1);
      console.warn('Failed to parse response JSON:', e.message);
    }
  }

  return next();
}

/**
 * Simulate realistic user behavior patterns
 */
function simulateUserBehavior(requestParams, context, ee, next) {
  // Add realistic delays between requests
  const thinkTime = faker.number.int({ min: 1000, max: 5000 }); // 1-5 seconds

  setTimeout(() => {
    // Randomly decide on user actions
    const action = faker.helpers.arrayElement([
      'create_video',
      'check_status',
      'list_jobs',
      'idle'
    ]);

    context.vars.userAction = action;

    // Set session-like behavior
    if (!context.vars.sessionId) {
      context.vars.sessionId = faker.string.uuid();
      context.vars.sessionStartTime = Date.now();
    }

    // Simulate session timeout (10 minutes)
    if (Date.now() - context.vars.sessionStartTime > 600000) {
      context.vars.sessionId = faker.string.uuid();
      context.vars.sessionStartTime = Date.now();
    }

    return next();
  }, Math.min(thinkTime, 100)); // Cap delay at 100ms for load testing
}

/**
 * Generate error scenarios for testing error handling
 */
function generateErrorScenario(requestParams, context, ee, next) {
  const errorScenarios = [
    {
      name: 'invalid_format',
      data: {
        output_format: 'invalid_format',
        width: 1920,
        height: 1080,
        elements: [
          {
            id: faker.string.uuid(),
            type: 'image',
            source: 'https://test-bucket.s3.amazonaws.com/test.jpg',
            track: 1
          }
        ]
      }
    },
    {
      name: 'invalid_dimensions',
      data: {
        output_format: 'mp4',
        width: -1,
        height: 0,
        elements: [
          {
            id: faker.string.uuid(),
            type: 'image',
            source: 'https://test-bucket.s3.amazonaws.com/test.jpg',
            track: 1
          }
        ]
      }
    },
    {
      name: 'empty_elements',
      data: {
        output_format: 'mp4',
        width: 1920,
        height: 1080,
        elements: []
      }
    },
    {
      name: 'too_many_elements',
      data: {
        output_format: 'mp4',
        width: 1920,
        height: 1080,
        elements: Array.from({ length: 15 }, (_, i) => ({
          id: faker.string.uuid(),
          type: 'image',
          source: 'https://test-bucket.s3.amazonaws.com/test.jpg',
          track: i + 1
        }))
      }
    }
  ];

  const scenario = faker.helpers.arrayElement(errorScenarios);
  context.vars.errorScenario = scenario.name;
  context.vars.errorData = scenario.data;

  return next();
}

/**
 * Report final results and metrics
 */
function reportResults(requestParams, context, ee, next) {
  // Calculate performance statistics
  const videoCreationStats = calculateStats(performanceMetrics.videoCreationTimes);
  const jobStatusStats = calculateStats(performanceMetrics.jobStatusTimes);

  console.log('\n=== LOAD TEST RESULTS ===');
  console.log('Video Creation Performance:');
  console.log(`  Average: ${videoCreationStats.avg}ms`);
  console.log(`  Median: ${videoCreationStats.median}ms`);
  console.log(`  95th Percentile: ${videoCreationStats.p95}ms`);
  console.log(`  99th Percentile: ${videoCreationStats.p99}ms`);

  console.log('\nJob Status Query Performance:');
  console.log(`  Average: ${jobStatusStats.avg}ms`);
  console.log(`  Median: ${jobStatusStats.median}ms`);
  console.log(`  95th Percentile: ${jobStatusStats.p95}ms`);

  console.log('\nError Counts:');
  console.log(`  Validation Errors: ${performanceMetrics.errorCounts.validation}`);
  console.log(`  Processing Errors: ${performanceMetrics.errorCounts.processing}`);
  console.log(`  Timeout Errors: ${performanceMetrics.errorCounts.timeout}`);
  console.log(`  Server Errors: ${performanceMetrics.errorCounts.server}`);

  console.log('\nConcurrency Stats:');
  console.log(`  Max Concurrent Users: ${performanceMetrics.concurrencyStats.maxConcurrent}`);

  console.log(`\nTotal Job IDs Collected: ${mockJobIds.length}`);
  console.log('========================\n');

  return next();
}

/**
 * Calculate statistical metrics from array of numbers
 */
function calculateStats(numbers) {
  if (numbers.length === 0) {
    return { avg: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }

  const sorted = numbers.slice().sort((a, b) => a - b);
  const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return {
    avg: Math.round(avg),
    median: Math.round(median),
    p95: Math.round(p95),
    p99: Math.round(p99),
    min: Math.round(min),
    max: Math.round(max)
  };
}

// Export all functions for Artillery
module.exports = {
  generateVideoJob,
  generateSimpleVideoJob,
  generateComplexVideoJob,
  generateStressTestJob,
  generateLargeVideoJob,
  getRandomJobId,
  getRandomUserId,
  storeJobId,
  trackPerformance,
  trackConcurrency,
  cleanupConcurrency,
  validateVideoCreationResponse,
  simulateUserBehavior,
  generateErrorScenario,
  reportResults
};
