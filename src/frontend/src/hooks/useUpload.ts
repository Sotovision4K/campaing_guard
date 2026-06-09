import { useState, useCallback } from 'react';
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
  const navigate = useNavigate();

  const upload = useCallback(async (file: File) => {
    setState({
      status: 'uploading',
      progress: 0,
      data: null,
      error: null,
    });

    try {
      const response = await uploadCSV(file, (progress) => {
        setState((prev) => ({ ...prev, progress }));
      });

      // If cached (file already processed), show a brief waiting/notification state
      const isCached = 'cached' in response && response.cached === true;

      setState({
        status: 'success',
        progress: 100,
        data: response.data,
        error: null,
      });

      // If cached, briefly show the waiting state, then redirect to anomalies
      if (isCached) {
        setState((prev) => ({ ...prev, status: 'waiting' }));
        setTimeout(() => {
          navigate('/anomalies');
        }, 1500);
      }

      return response;
    } catch (error) {
      const apiError = error as ApiError;
      setState({
        status: 'error',
        progress: 0,
        data: null,
        error: apiError.message || 'Upload failed',
      });
      throw error;
    }
  }, [navigate]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      data: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    upload,
    reset,
  };
};
