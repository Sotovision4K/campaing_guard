import axios, { type AxiosInstance, type AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  requestId: string;
  data: T;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error: ApiError }>) => {
    if (error.response?.data?.error) {
      return Promise.reject(error.response.data.error);
    }
    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: error.message || 'Network error occurred',
    });
  }
);

export default apiClient;