import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadCSV } from '../services/upload.service';
import type { UploadState } from '../types';
import type { ApiError } from '../api/client';

export const useUpload = () => {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    data: null,
    error: null,
  });

  const [currentStage, setCurrentStage] = useState(1);
  const navigate = useNavigate();
  const stageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
      }
    };
  }, []);

  const simulatePipelineStages = useCallback(() => {
    let currentProgress = 0;
    let stage = 1;

    const stageThresholds = [
      { at: 20, stage: 1 },
      { at: 40, stage: 2 },
      { at: 60, stage: 3 },
      { at: 80, stage: 4 },
      { at: 95, stage: 5 },
    ];

    stageIntervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 4 + 1;

      if (currentProgress >= 100) {
        currentProgress = 100;
        if (stageIntervalRef.current) {
          clearInterval(stageIntervalRef.current);
        }
      }

      const newStage = stageThresholds.reduce(
        (acc, s) => (currentProgress >= s.at ? s.stage : acc),
        1
      );

      if (newStage !== stage) {
        stage = newStage;
        setCurrentStage(stage);
      }

      setState((prev) => ({
        ...prev,
        progress: Math.min(Math.round(currentProgress), 100),
      }));
    }, 150);
  }, []);

  const upload = useCallback(async (file: File) => {
    setState({
      status: 'uploading',
      progress: 0,
      data: null,
      error: null,
    });

    setCurrentStage(1);
    simulatePipelineStages();

    try {
      const response = await uploadCSV(file, (progress) => {
        setState((prev) => ({ ...prev, progress: Math.min(progress, 95) }));
      });

      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
      }

      setState((prev) => ({ ...prev, progress: 100 }));

      const isCached = 'cached' in response && response.cached === true;

      setState({
        status: 'success',
        progress: 100,
        data: response.data,
        error: null,
      });

      const reportId = response.data?.report?.id;

      if (isCached) {
        setState((prev) => ({ ...prev, status: 'waiting' }));
        setTimeout(() => {
          navigate('/insights', { state: { reportId } });
        }, 1500);
      } else {
        navigate('/insights', { state: { reportId } });
      }

      return response;
    } catch (error) {
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
      }

      const apiError = error as ApiError;
      setState({
        status: 'error',
        progress: 0,
        data: null,
        error: apiError.message || 'Upload failed',
      });
      throw error;
    }
  }, [navigate, simulatePipelineStages]);

  const reset = useCallback(() => {
    if (stageIntervalRef.current) {
      clearInterval(stageIntervalRef.current);
    }
    setCurrentStage(1);
    setState({
      status: 'idle',
      progress: 0,
      data: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    currentStage,
    upload,
    reset,
  };
};