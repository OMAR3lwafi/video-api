import { useState, useEffect, useCallback, useRef } from 'react';
import { Job } from '@/types/job';
import { useJobStore } from '@/stores/jobStore';

export const useActiveJobs = () => {
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActiveJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jobs/active');
      
      if (!response.ok) {
        throw new Error('Failed to fetch active jobs');
      }

      const data = await response.json();
      setActiveJobs(data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch active jobs');
      
      // Mock data for development
      if (process.env.NODE_ENV === 'development') {
        setActiveJobs(generateMockActiveJobs());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const subscribeToUpdates = useCallback(() => {
    // WebSocket connection for real-time updates
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/jobs`;
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected for job updates');
          // Clear any reconnection timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
              case 'job:update':
                handleJobUpdate(message.job);
                break;
              case 'job:new':
                handleNewJob(message.job);
                break;
              case 'job:complete':
                handleJobComplete(message.jobId);
                break;
              case 'job:error':
                handleJobError(message.jobId, message.error);
                break;
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error');
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          wsRef.current = null;
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!wsRef.current) {
              connectWebSocket();
            }
          }, 5000);
        };
      } catch (err) {
        console.error('Failed to establish WebSocket connection:', err);
        
        // Fallback to polling in development
        if (process.env.NODE_ENV === 'development') {
          const pollInterval = setInterval(() => {
            fetchActiveJobs();
          }, 3000);
          
          return () => clearInterval(pollInterval);
        }
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [fetchActiveJobs]);

  const handleJobUpdate = useCallback((job: Job) => {
    setActiveJobs(prev => {
      const index = prev.findIndex(j => j.id === job.id);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = job;
        return updated;
      }
      return prev;
    });
  }, []);

  const handleNewJob = useCallback((job: Job) => {
    if (job.status === 'processing' || job.status === 'queued') {
      setActiveJobs(prev => [...prev, job]);
    }
  }, []);

  const handleJobComplete = useCallback((jobId: string) => {
    setActiveJobs(prev => prev.filter(j => j.id !== jobId));
  }, []);

  const handleJobError = useCallback((jobId: string, error: string) => {
    setActiveJobs(prev => {
      const index = prev.findIndex(j => j.id === jobId);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'failed', error };
        // Remove from active jobs after a delay
        setTimeout(() => {
          setActiveJobs(current => current.filter(j => j.id !== jobId));
        }, 5000);
        return updated;
      }
      return prev;
    });
  }, []);

  return {
    activeJobs,
    loading,
    error,
    fetchActiveJobs,
    subscribeToUpdates
  };
};

// Mock data generator for development
function generateMockActiveJobs(): Job[] {
  return [
    {
      id: 'active-1',
      name: 'Marketing Video Render',
      status: 'processing',
      type: 'single',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 65,
      currentStep: 'Encoding video layers...',
      estimatedCompletion: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      elements: [
        {
          id: 'elem-1',
          type: 'video',
          source: 'https://example.com/video1.mp4',
          x: '0',
          y: '0',
          width: '100%',
          height: '100%'
        }
      ]
    },
    {
      id: 'active-2',
      name: 'Social Media Compilation',
      status: 'processing',
      type: 'batch',
      batchId: 'batch-001',
      batchPosition: 3,
      batchTotal: 10,
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 35,
      currentStep: 'Processing audio tracks...',
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      elements: [
        {
          id: 'elem-2',
          type: 'image',
          source: 'https://example.com/image1.jpg',
          x: '10%',
          y: '10%',
          width: '80%',
          height: '80%'
        }
      ]
    },
    {
      id: 'queued-1',
      name: 'Product Demo Video',
      status: 'queued',
      type: 'template',
      templateId: 'product-showcase',
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      queuePosition: 1,
      estimatedCompletion: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      elements: []
    },
    {
      id: 'queued-2',
      name: 'Tutorial Video Export',
      status: 'queued',
      type: 'single',
      createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      queuePosition: 2,
      estimatedCompletion: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      elements: []
    }
  ];
}