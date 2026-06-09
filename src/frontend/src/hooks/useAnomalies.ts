import { useState, useCallback } from 'react';
import { listAnomalies, getAnomaly, rejectAnomaly, approveAnomaly, increaseBid, lowerBid } from '../services/anomalies.service';
import type { Anomaly, AnomalyDetailResponse } from '../services/anomalies.service';
import type { ApiError } from '../api/client';

export type AnomaliesStatus = 'idle' | 'loading' | 'success' | 'error' | 'action-loading';

export interface AnomaliesState {
  status: AnomaliesStatus;
  anomalies: Anomaly[];
  selectedAnomaly: AnomalyDetailResponse | null;
  total: number;
  error: string | null;
}

export const useAnomalies = () => {
  const [state, setState] = useState<AnomaliesState>({
    status: 'idle',
    anomalies: [],
    selectedAnomaly: null,
    total: 0,
    error: null,
  });

  const fetchAnomalies = useCallback(async (filters?: {
    reportId?: string;
    campaignId?: string;
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }) => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    try {
      const response = await listAnomalies(filters);
      setState({
        status: 'success',
        anomalies: response.data.anomalies,
        selectedAnomaly: null,
        total: response.data.total,
        error: null,
      });
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: apiError.message || 'Failed to load anomalies',
      }));
    }
  }, []);

  const selectAnomaly = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const response = await getAnomaly(id);
      setState((prev) => ({
        ...prev,
        status: 'success',
        selectedAnomaly: response.data,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: apiError.message || 'Failed to load anomaly details',
      }));
    }
  }, []);

  const reject = useCallback(async (id: string, reason?: string) => {
    setState((prev) => ({ ...prev, status: 'action-loading' }));
    try {
      await rejectAnomaly(id, reason);
      // Refresh selected anomaly
      const response = await getAnomaly(id);
      setState((prev) => ({
        ...prev,
        status: 'success',
        selectedAnomaly: response.data,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: apiError.message || 'Failed to reject anomaly',
      }));
    }
  }, []);

  const approve = useCallback(async (id: string, reason?: string, action?: string) => {
    setState((prev) => ({ ...prev, status: 'action-loading' }));
    try {
      await approveAnomaly(id, reason, action);
      const response = await getAnomaly(id);
      setState((prev) => ({
        ...prev,
        status: 'success',
        selectedAnomaly: response.data,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: apiError.message || 'Failed to approve anomaly',
      }));
    }
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedAnomaly: null,
      status: prev.anomalies.length > 0 ? 'success' : 'idle',
    }));
  }, []);

  const increaseBidAction = useCallback(async (id: string, percent?: number) => {
    setState((prev) => ({ ...prev, status: 'action-loading' }));
    try {
      await increaseBid(id, percent);
      const response = await getAnomaly(id);
      setState((prev) => ({
        ...prev,
        status: 'success',
        selectedAnomaly: response.data,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: apiError.message || 'Failed to increase bid',
      }));
    }
  }, []);

  const lowerBidAction = useCallback(async (id: string, percent?: number) => {
    setState((prev) => ({ ...prev, status: 'action-loading' }));
    try {
      await lowerBid(id, percent);
      const response = await getAnomaly(id);
      setState((prev) => ({
        ...prev,
        status: 'success',
        selectedAnomaly: response.data,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: apiError.message || 'Failed to lower bid',
      }));
    }
  }, []);

  return {
    ...state,
    fetchAnomalies,
    selectAnomaly,
    reject,
    approve,
    increaseBid: increaseBidAction,
    lowerBid: lowerBidAction,
    clearSelection,
  };
};
