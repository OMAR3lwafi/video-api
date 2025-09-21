
import { exec } from 'child_process';
import { logger } from '@/config/monitoring';

export const checkFfmpeg = (): Promise<{ status: string; version?: string; error?: string }> => {
  return new Promise((resolve) => {
    exec('ffmpeg -version', (error, stdout, stderr) => {
      if (error) {
        logger.error('FFmpeg health check failed:', error);
        resolve({ status: 'unhealthy', error: error.message });
        return;
      }
      const versionMatch = stdout.match(/ffmpeg version (\S+)/);
      resolve({
        status: 'healthy',
        version: versionMatch ? versionMatch[1] : 'unknown',
      });
    });
  });
};
