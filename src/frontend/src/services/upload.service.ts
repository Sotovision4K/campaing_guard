import apiClient, { type ApiResponse } from '../api/client';
import type { UploadResponse } from '../types';

export interface UploadAPIResponse extends ApiResponse<UploadResponse> {
  cached?: boolean;
}

export const uploadCSV = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadAPIResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<UploadAPIResponse>(
    '/anomaly/upload-csv',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    }
  );

  return response.data;
};