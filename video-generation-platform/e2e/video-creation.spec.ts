/**
 * End-to-End Tests for Video Creation Workflow
 * Tests the complete user journey from video creation to result retrieval
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Test data generators
const createTestVideoData = () => ({
  output_format: 'mp4',
  width: 1920,
  height: 1080,
  elements: [
    {
      id: faker.string.uuid(),
      type: 'video',
      source: 'https://test-bucket.s3.amazonaws.com/sample-video.mp4',
      track: 1,
      x: '0%',
      y: '0%',
      width: '100%',
      height: '100%',
      fit_mode: 'contain',
      start_time: '0',
      duration: '30',
    },
    {
      id: faker.string.uuid(),
      type: 'image',
      source: 'https://test-bucket.s3.amazonaws.com/sample-image.jpg',
      track: 2,
      x: '10%',
      y: '10%',
      width: '80%',
      height: '80%',
      fit_mode: 'contain',
      duration: '5',
    },
  ],
});

// Page Object Models
class VideoCreationPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/create');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForPageLoad() {
    await this.page.waitForSelector('[data-testid="video-creation-form"]');
    await expect(this.page.locator('h1')).toContainText('Create Video');
  }

  async selectOutputFormat(format: string) {
    await this.page.locator('[data-testid="output-format-select"]').click();
    await this.page.locator(`[data-testid="format-option-${format}"]`).click();
  }

  async setDimensions(width: number, height: number) {
    await this.page.fill('[data-testid="width-input"]', width.toString());
    await this.page.fill('[data-testid="height-input"]', height.toString());
  }

  async addVideoElement(element: any) {
    await this.page.click('[data-testid="add-element-button"]');
    await this.page.locator('[data-testid="element-type-video"]').click();

    await this.page.fill('[data-testid="video-source-input"]', element.source);
    await this.page.fill('[data-testid="video-x-input"]', element.x);
    await this.page.fill('[data-testid="video-y-input"]', element.y);
    await this.page.fill('[data-testid="video-width-input"]', element.width);
    await this.page.fill('[data-testid="video-height-input"]', element.height);
    await this.page.fill('[data-testid="video-duration-input"]', element.duration);

    await this.page.click('[data-testid="add-video-element-confirm"]');
  }

  async addImageElement(element: any) {
    await this.page.click('[data-testid="add-element-button"]');
    await this.page.locator('[data-testid="element-type-image"]').click();

    await this.page.fill('[data-testid="image-source-input"]', element.source);
    await this.page.fill('[data-testid="image-x-input"]', element.x);
    await this.page.fill('[data-testid="image-y-input"]', element.y);
    await this.page.fill('[data-testid="image-width-input"]', element.width);
    await this.page.fill('[data-testid="image-height-input"]', element.height);
    await this.page.fill('[data-testid="image-duration-input"]', element.duration);

    await this.page.click('[data-testid="add-image-element-confirm"]');
  }

  async removeElement(index: number) {
    await this.page.click(`[data-testid="remove-element-${index}"]`);
  }

  async previewVideo() {
    await this.page.click('[data-testid="preview-button"]');
    await this.page.waitForSelector('[data-testid="video-preview"]');
  }

  async submitVideoCreation() {
    await this.page.click('[data-testid="create-video-button"]');
  }

  async waitForSubmissionResponse() {
    // Wait for either immediate completion or async processing response
    await this.page.waitForResponse(response =>
      response.url().includes('/api/v1/videocreate') &&
      (response.status() === 200 || response.status() === 202)
    );
  }

  async getCreationResult() {
    const resultContainer = this.page.locator('[data-testid="creation-result"]');
    await resultContainer.waitFor();

    const status = await resultContainer.getAttribute('data-status');
    const jobId = await resultContainer.getAttribute('data-job-id');

    return { status, jobId };
  }

  async getErrorMessage() {
    const errorElement = this.page.locator('[data-testid="error-message"]');
    if (await errorElement.isVisible()) {
      return await errorElement.textContent();
    }
    return null;
  }
}

class VideoStatusPage {
  constructor(private page: Page) {}

  async navigateToJob(jobId: string) {
    await this.page.goto(`/jobs/${jobId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForStatusUpdate() {
    await this.page.waitForSelector('[data-testid="job-status"]');
  }

  async getJobStatus() {
    const statusElement = this.page.locator('[data-testid="job-status"]');
    return await statusElement.textContent();
  }

  async getProgress() {
    const progressElement = this.page.locator('[data-testid="job-progress"]');
    if (await progressElement.isVisible()) {
      return await progressElement.getAttribute('data-progress');
    }
    return null;
  }

  async getCurrentStep() {
    const stepElement = this.page.locator('[data-testid="current-step"]');
    if (await stepElement.isVisible()) {
      return await stepElement.textContent();
    }
    return null;
  }

  async getResultUrl() {
    const resultElement = this.page.locator('[data-testid="result-url"]');
    if (await resultElement.isVisible()) {
      return await resultElement.getAttribute('href');
    }
    return null;
  }

  async downloadVideo() {
    const downloadButton = this.page.locator('[data-testid="download-button"]');
    await downloadButton.click();

    const downloadPromise = this.page.waitForEvent('download');
    const download = await downloadPromise;

    return download;
  }

  async deleteJob() {
    await this.page.click('[data-testid="delete-job-button"]');
    await this.page.click('[data-testid="confirm-delete"]');

    await this.page.waitForResponse(response =>
      response.url().includes('/api/v1/videojob/') &&
      response.status() === 200
    );
  }
}

class DashboardPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async getJobsList() {
    await this.page.waitForSelector('[data-testid="jobs-list"]');
    const jobElements = this.page.locator('[data-testid="job-item"]');
    return await jobElements.count();
  }

  async getJobByIndex(index: number) {
    const jobElement = this.page.locator('[data-testid="job-item"]').nth(index);
    const id = await jobElement.getAttribute('data-job-id');
    const status = await jobElement.locator('[data-testid="job-status"]').textContent();
    return { id, status };
  }

  async filterByStatus(status: string) {
    await this.page.locator('[data-testid="status-filter"]').click();
    await this.page.locator(`[data-testid="filter-${status}"]`).click();
    await this.page.waitForTimeout(1000); // Wait for filter to apply
  }

  async searchJobs(query: string) {
    await this.page.fill('[data-testid="job-search"]', query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000); // Wait for search to apply
  }
}

// Test Suite
test.describe('Video Creation Workflow', () => {
  let videoCreationPage: VideoCreationPage;
  let videoStatusPage: VideoStatusPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    videoCreationPage = new VideoCreationPage(page);
    videoStatusPage = new VideoStatusPage(page);
    dashboardPage = new DashboardPage(page);

    // Setup API mocking for consistent test behavior
    await page.route('/api/v1/videocreate', async route => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');

      // Simulate immediate processing for simple jobs
      if (body.elements?.length <= 2 && body.width <= 1920) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            processing_time: '15000',
            result_url: 'https://test-bucket.s3.amazonaws.com/output-video.mp4',
            job_id: `job-${Date.now()}`,
            file_size: '12.5MB',
            message: 'Video processing completed successfully',
          }),
        });
      } else {
        // Simulate async processing for complex jobs
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'processing',
            job_id: `job-${Date.now()}`,
            message: 'Video processing started',
            estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            status_check_endpoint: `/api/v1/videoresult/job-${Date.now()}`,
          }),
        });
      }
    });
  });

  test('should complete simple video creation workflow', async ({ page }) => {
    // Navigate to video creation page
    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    // Verify page elements are visible
    await expect(page.locator('[data-testid="video-creation-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-video-button"]')).toBeDisabled();

    // Configure video settings
    await videoCreationPage.selectOutputFormat('mp4');
    await videoCreationPage.setDimensions(1920, 1080);

    // Add video elements
    const testData = createTestVideoData();
    await videoCreationPage.addVideoElement(testData.elements[0]);
    await videoCreationPage.addImageElement(testData.elements[1]);

    // Verify elements were added
    await expect(page.locator('[data-testid="element-list"]')).toContainText('2 elements');

    // Preview video
    await videoCreationPage.previewVideo();
    await expect(page.locator('[data-testid="video-preview"]')).toBeVisible();

    // Create video
    await expect(page.locator('[data-testid="create-video-button"]')).toBeEnabled();
    await videoCreationPage.submitVideoCreation();
    await videoCreationPage.waitForSubmissionResponse();

    // Verify completion
    const result = await videoCreationPage.getCreationResult();
    expect(result.status).toBe('completed');
    expect(result.jobId).toBeTruthy();

    // Verify success message and result URL
    await expect(page.locator('[data-testid="success-message"]')).toContainText('completed successfully');
    await expect(page.locator('[data-testid="result-url"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-button"]')).toBeVisible();
  });

  test('should handle async video processing workflow', async ({ page }) => {
    // Mock complex job that requires async processing
    await page.route('/api/v1/videocreate', async route => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'processing',
          job_id: 'job-async-123',
          message: 'Video processing started',
          estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          status_check_endpoint: '/api/v1/videoresult/job-async-123',
        }),
      });
    });

    // Mock job status endpoint
    await page.route('/api/v1/videoresult/job-async-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'processing',
          job_id: 'job-async-123',
          progress: 45,
          current_step: 'encoding',
          message: 'Job is processing',
          estimated_completion: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
        }),
      });
    });

    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    // Create complex video with many elements
    await videoCreationPage.selectOutputFormat('mp4');
    await videoCreationPage.setDimensions(3840, 2160); // 4K resolution

    const testData = createTestVideoData();
    for (let i = 0; i < 5; i++) {
      await videoCreationPage.addVideoElement({
        ...testData.elements[0],
        track: i + 1,
      });
    }

    await videoCreationPage.submitVideoCreation();
    await videoCreationPage.waitForSubmissionResponse();

    // Verify async processing started
    const result = await videoCreationPage.getCreationResult();
    expect(result.status).toBe('processing');
    expect(result.jobId).toBe('job-async-123');

    // Navigate to job status page
    await videoStatusPage.navigateToJob(result.jobId!);
    await videoStatusPage.waitForStatusUpdate();

    // Verify job status information
    const status = await videoStatusPage.getJobStatus();
    const progress = await videoStatusPage.getProgress();
    const currentStep = await videoStatusPage.getCurrentStep();

    expect(status).toBe('processing');
    expect(progress).toBe('45');
    expect(currentStep).toBe('encoding');

    // Verify status page elements
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="estimated-completion"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-job-button"]')).toBeVisible();
  });

  test('should handle video creation errors gracefully', async ({ page }) => {
    // Mock validation error
    await page.route('/api/v1/videocreate', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid video element: Source URL is not accessible',
          details: ['Element 1: Invalid source URL', 'Element 2: Duration exceeds limit'],
        }),
      });
    });

    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    // Create invalid video configuration
    await videoCreationPage.selectOutputFormat('mp4');
    await videoCreationPage.setDimensions(1920, 1080);
    await videoCreationPage.addVideoElement({
      source: 'invalid-url',
      track: 1,
      x: '0%',
      y: '0%',
      width: '100%',
      height: '100%',
      duration: '300', // Too long
    });

    await videoCreationPage.submitVideoCreation();
    await page.waitForResponse(response =>
      response.url().includes('/api/v1/videocreate') &&
      response.status() === 400
    );

    // Verify error handling
    const errorMessage = await videoCreationPage.getErrorMessage();
    expect(errorMessage).toContain('Invalid video element');

    await expect(page.locator('[data-testid="error-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-details"]')).toContainText('Invalid source URL');
  });

  test('should validate form inputs correctly', async ({ page }) => {
    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    // Test dimension validation
    await videoCreationPage.setDimensions(0, 0);
    await expect(page.locator('[data-testid="width-error"]')).toContainText('Width must be greater than 0');
    await expect(page.locator('[data-testid="height-error"]')).toContainText('Height must be greater than 0');

    await videoCreationPage.setDimensions(10000, 10000);
    await expect(page.locator('[data-testid="width-error"]')).toContainText('Width cannot exceed 4096');
    await expect(page.locator('[data-testid="height-error"]')).toContainText('Height cannot exceed 4096');

    // Test valid dimensions
    await videoCreationPage.setDimensions(1920, 1080);
    await expect(page.locator('[data-testid="width-error"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="height-error"]')).not.toBeVisible();

    // Test element limit
    const testElement = createTestVideoData().elements[0];
    for (let i = 0; i < 12; i++) {
      try {
        await videoCreationPage.addVideoElement({
          ...testElement,
          track: i + 1,
        });
      } catch (e) {
        // Expected to fail after 10 elements
        break;
      }
    }

    await expect(page.locator('[data-testid="element-limit-warning"]')).toContainText('Maximum 10 elements allowed');
  });

  test('should manage video elements correctly', async ({ page }) => {
    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    await videoCreationPage.selectOutputFormat('mp4');
    await videoCreationPage.setDimensions(1920, 1080);

    const testData = createTestVideoData();

    // Add elements
    await videoCreationPage.addVideoElement(testData.elements[0]);
    await videoCreationPage.addImageElement(testData.elements[1]);

    // Verify elements are listed
    await expect(page.locator('[data-testid="element-list"]')).toContainText('2 elements');
    await expect(page.locator('[data-testid="element-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="element-1"]')).toBeVisible();

    // Test element reordering
    await page.dragAndDrop('[data-testid="element-0"]', '[data-testid="element-1"]');
    await expect(page.locator('[data-testid="element-list"] > :first-child')).toContainText('image');

    // Remove element
    await videoCreationPage.removeElement(1);
    await expect(page.locator('[data-testid="element-list"]')).toContainText('1 element');
    await expect(page.locator('[data-testid="element-1"]')).not.toBeVisible();
  });

  test('should integrate with dashboard correctly', async ({ page }) => {
    // Create a video first
    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    await videoCreationPage.selectOutputFormat('mp4');
    await videoCreationPage.setDimensions(1920, 1080);

    const testData = createTestVideoData();
    await videoCreationPage.addVideoElement(testData.elements[0]);
    await videoCreationPage.submitVideoCreation();
    await videoCreationPage.waitForSubmissionResponse();

    const result = await videoCreationPage.getCreationResult();

    // Navigate to dashboard
    await dashboardPage.navigate();

    // Verify job appears in dashboard
    const jobCount = await dashboardPage.getJobsList();
    expect(jobCount).toBeGreaterThan(0);

    const firstJob = await dashboardPage.getJobByIndex(0);
    expect(firstJob.id).toBeTruthy();
    expect(['completed', 'processing', 'pending']).toContain(firstJob.status!);

    // Test filtering
    await dashboardPage.filterByStatus('completed');
    const completedJobs = await dashboardPage.getJobsList();

    if (result.status === 'completed') {
      expect(completedJobs).toBeGreaterThan(0);
    }

    // Test search
    if (result.jobId) {
      await dashboardPage.searchJobs(result.jobId.slice(-4)); // Search by last 4 characters
      const searchResults = await dashboardPage.getJobsList();
      expect(searchResults).toBeGreaterThanOrEqual(1);
    }
  });

  test('should handle real-time status updates', async ({ page }) => {
    // Mock WebSocket connection for real-time updates
    await page.addInitScript(() => {
      // Override WebSocket to simulate real-time updates
      const originalWebSocket = window.WebSocket;
      window.WebSocket = class extends originalWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super('ws://localhost:3001/mock-websocket'); // Mock endpoint

          setTimeout(() => {
            this.dispatchEvent(new Event('open'));

            // Simulate progress updates
            setTimeout(() => {
              this.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'job_progress',
                  jobId: 'job-realtime-123',
                  progress: 25,
                  currentStep: 'validation'
                })
              }));
            }, 1000);

            setTimeout(() => {
              this.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'job_progress',
                  jobId: 'job-realtime-123',
                  progress: 75,
                  currentStep: 'encoding'
                })
              }));
            }, 2000);

            setTimeout(() => {
              this.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'job_completed',
                  jobId: 'job-realtime-123',
                  resultUrl: 'https://test-bucket.s3.amazonaws.com/completed-video.mp4'
                })
              }));
            }, 3000);
          }, 100);
        }
      };
    });

    // Mock async job creation
    await page.route('/api/v1/videocreate', async route => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'processing',
          job_id: 'job-realtime-123',
          message: 'Video processing started',
          estimated_completion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          status_check_endpoint: '/api/v1/videoresult/job-realtime-123',
        }),
      });
    });

    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    await videoCreationPage.selectOutputFormat('mp4');
    await videoCreationPage.setDimensions(1920, 1080);

    const testData = createTestVideoData();
    await videoCreationPage.addVideoElement(testData.elements[0]);
    await videoCreationPage.submitVideoCreation();
    await videoCreationPage.waitForSubmissionResponse();

    const result = await videoCreationPage.getCreationResult();

    // Navigate to status page to see real-time updates
    await videoStatusPage.navigateToJob(result.jobId!);
    await videoStatusPage.waitForStatusUpdate();

    // Wait for first progress update
    await page.waitForTimeout(1500);
    const progress1 = await videoStatusPage.getProgress();
    expect(parseInt(progress1!)).toBeGreaterThanOrEqual(25);

    // Wait for second progress update
    await page.waitForTimeout(1000);
    const progress2 = await videoStatusPage.getProgress();
    expect(parseInt(progress2!)).toBeGreaterThanOrEqual(75);

    // Wait for completion
    await page.waitForTimeout(1500);
    const finalStatus = await videoStatusPage.getJobStatus();
    const resultUrl = await videoStatusPage.getResultUrl();

    expect(finalStatus).toBe('completed');
    expect(resultUrl).toBeTruthy();
  });

  test('should support video download functionality', async ({ page }) => {
    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    await videoCreationPage.selectOutputFormat('mp4');
    await videoCreationPage.setDimensions(1920, 1080);

    const testData = createTestVideoData();
    await videoCreationPage.addVideoElement(testData.elements[0]);
    await videoCreationPage.submitVideoCreation();
    await videoCreationPage.waitForSubmissionResponse();

    const result = await videoCreationPage.getCreationResult();

    if (result.status === 'completed') {
      // Test download directly from creation result
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-button"]');
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/\.mp4$/);
    } else {
      // Navigate to status page for async job
      await videoStatusPage.navigateToJob(result.jobId!);

      // Mock job completion
      await page.route(`/api/v1/videoresult/${result.jobId}`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            job_id: result.jobId,
            result_url: 'https://test-bucket.s3.amazonaws.com/output-video.mp4',
            file_size: '15.3MB',
            processing_time: '45000',
            message: 'Job completed successfully',
          }),
        });
      });

      await page.reload();
      await videoStatusPage.waitForStatusUpdate();

      const download = await videoStatusPage.downloadVideo();
      expect(download.suggestedFilename()).toMatch(/\.mp4$/);
    }
  });

  test('should handle job deletion correctly', async ({ page }) => {
    await videoCreationPage.navigate();
    await videoCreationPage.waitForPageLoad();

    await videoCreationPage.selectOutputFormat('mp4');
    await videoCreationPage.setDimensions(1920, 1080);

    const testData = createTestVideoData();
    await videoCreationPage.addVideoElement(testData.elements[0]);
    await videoCreationPage.submitVideoCreation();
    await videoCreationPage.waitForSubmissionResponse();

    const result = await videoCreationPage.getCreationResult();

    // Navigate to job status page
    await videoStatusPage.navigateToJob(result.jobId!);
    await videoStatusPage.waitForStatusUpdate();

    // Mock successful deletion
    await page.route(`/api/v1/videojob/${result.jobId}`, async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Job deleted successfully',
          }),
        });
      }
    });

    // Delete the job
    await videoStatusPage.deleteJob();

    // Verify redirect to dashboard or home page
    await page.waitForURL(url =>
      url.pathname === '/dashboard' || url.pathname === '/'
    );

    // Verify success notification
    await expect(page.locator('[data-testid="notification"]')).toContainText('Job deleted successfully');
  });
});

// Performance and Load Tests
test.describe('Video Creation Performance', () => {
  test('should load video creation page within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // 3 second budget

    // Check for performance metrics
    const performanceEntries = await page.evaluate(() => {
      return JSON.stringify(performance.getEntriesByType('navigation'));
    });

    const entries = JSON.parse(performanceEntries);
    const navigationEntry = entries[0];

    expect(navigationEntry.domContentLoadedEventEnd - navigationEntry.fetchStart).toBeLessThan(2000);
    expect(navigationEntry.loadEventEnd - navigationEntry.fetchStart).toBeLessThan(3000);
  });

  test('should handle rapid form interactions efficiently', async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    const videoCreationPage = new VideoCreationPage(page);

    // Rapidly change form values
    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      await videoCreationPage.selectOutputFormat(['mp4', 'mov', 'avi'][i % 3]);
      await videoCreationPage.setDimensions(1280 + i * 64, 720 + i * 36);
    }

    const interactionTime = Date.now() - startTime;
    expect(interactionTime).toBeLessThan(2000); // Should handle rapid interactions smoothly
  });
});
