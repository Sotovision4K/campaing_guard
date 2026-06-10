import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { fromApiError, NetworkError, type ApiErrorPayload } from './errors.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export type { ApiErrorPayload } from './errors.js';
export { fromApiError, NetworkError } from './errors.js';
export {
  ApiError,
  LLMError,
  DBError,
  ValidationError,
  NotFoundError,
  FileProcessingError,
  ConfigurationError,
  UnknownApiError,
  isApiError,
  isLLMError,
  isDBError,
  isNetworkError,
} from './errors.js';

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

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error: ApiErrorPayload }>) => {
    if (error.response?.data?.error) {
      return Promise.reject(fromApiError(error.response.data.error));
    }
    return Promise.reject(
      new NetworkError(error.message || 'Network error occurred')
    );
  }
);

export default apiClient;