import { useState, useCallback } from 'react';
import { Dropzone } from './Dropzone';
import { UploadProgress } from './UploadProgress';
import { UploadResult } from './UploadResult';
import { useUpload } from '../../hooks/useUpload';
import './index.css';

export const DropzonePage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { status, progress, data, error, upload, reset } = useUpload();

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    try {
      await upload(file);
    } catch {
      // Error is already handled in the hook
    }
  }, [upload]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    reset();
  }, [reset]);

  return (
    <div className="dropzone-page">
      <div className="dropzone-page__container">
        <h1 className="dropzone-page__title">Upload Campaign Data</h1>
        <p className="dropzone-page__description">
          Upload your campaign analytics CSV file to process and validate the data.
        </p>

        {status === 'idle' && (
          <Dropzone onFileSelect={handleFileSelect} />
        )}

        <div aria-live="polite" aria-atomic="true">
          {status === 'uploading' && selectedFile && (
            <UploadProgress progress={progress} fileName={selectedFile.name} />
          )}

          {status === 'success' && data && (
            <UploadResult data={data} onReset={handleReset} />
          )}

          {status === 'waiting' && (
            <div className="dropzone-page__waiting" role="status">
              <p className="dropzone-page__waiting-message">
                This file has already been processed. Retrieving stored analysis...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="dropzone-page__error" role="alert">
              <p className="dropzone-page__error-message">{error}</p>
              <button className="dropzone-page__retry" onClick={handleReset}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DropzonePage;