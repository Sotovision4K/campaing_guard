import { useState, useCallback } from 'react';
import {
  listAnomalies,
  getAnomaly,
  rejectAnomaly,
  approveAnomaly,
  increaseBid,
  lowerBid,
  bulkActionAnomalies,
} from '../services/anomalies.service';
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

const extractError = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message) || fallback;
  }
  return fallback;
};

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
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: extractError(error, 'Failed to load anomalies'),
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
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: extractError(error, 'Failed to load anomaly details'),
      }));
    }
  }, []);

  const refreshAnomaly = useCallback(async (id: string) => {
    try {
      const response = await getAnomaly(id);
      setState((prev) => ({
        ...prev,
        selectedAnomaly: response.data,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: extractError(error, 'Failed to refresh anomaly'),
      }));
    }
  }, []);

  const reject = useCallback(async (id: string, reason?: string) => {
    setState((prev) => ({ ...prev, status: 'action-loading', error: null }));
    try {
      await rejectAnomaly(id, reason);
      await refreshAnomaly(id);
      setState((prev) => ({ ...prev, status: 'success' }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: extractError(error, 'Failed to reject anomaly'),
      }));
    }
  }, [refreshAnomaly]);

  const approve = useCallback(async (id: string, reason?: string, action?: string) => {
    setState((prev) => ({ ...prev, status: 'action-loading', error: null }));
    try {
      await approveAnomaly(id, reason, action);
      await refreshAnomaly(id);
      setState((prev) => ({ ...prev, status: 'success' }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: extractError(error, 'Failed to approve anomaly'),
      }));
    }
  }, [refreshAnomaly]);

  const increaseBidAction = useCallback(async (id: string, percent?: number) => {
    setState((prev) => ({ ...prev, status: 'action-loading', error: null }));
    try {
      await increaseBid(id, percent);
      await refreshAnomaly(id);
      setState((prev) => ({ ...prev, status: 'success' }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: extractError(error, 'Failed to increase bid'),
      }));
    }
  }, [refreshAnomaly]);

  const lowerBidAction = useCallback(async (id: string, percent?: number) => {
    setState((prev) => ({ ...prev, status: 'action-loading', error: null }));
    try {
      await lowerBid(id, percent);
      await refreshAnomaly(id);
      setState((prev) => ({ ...prev, status: 'success' }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: extractError(error, 'Failed to lower bid'),
      }));
    }
  }, [refreshAnomaly]);

  const bulk = useCallback(async (ids: string[], action: 'approved' | 'rejected', reason?: string) => {
    setState((prev) => ({ ...prev, status: 'action-loading', error: null }));
    try {
      await bulkActionAnomalies(ids, action, reason);
      setState((prev) => {
        const idSet = new Set(ids);
        return {
          ...prev,
          status: 'success',
          anomalies: prev.anomalies.map((a) =>
            idSet.has(a.anomaly_id) ? { ...a, status: action } : a
          ),
        };
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: extractError(error, `Failed to bulk ${action} anomalies`),
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

  return {
    ...state,
    fetchAnomalies,
    selectAnomaly,
    reject,
    approve,
    increaseBid: increaseBidAction,
    lowerBid: lowerBidAction,
    bulk,
    clearSelection,
  };
};

export type { ApiError };
