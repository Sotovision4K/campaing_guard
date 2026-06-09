import { useState, useCallback } from 'react';
import { Dropzone } from './Dropzone';
import { UploadProgress } from './UploadProgress';
import { UploadResult } from './UploadResult';
import { useUpload } from '../../hooks/useUpload';
import { PipelineProgress } from '../../components';
import styles from '../../styles/dropzone.module.css';

export const DropzonePage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { status, progress, data, error, currentStage, upload, reset } = useUpload();

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
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Upload Campaign Data</h1>
          <p className={styles.subtitle}>
            Drop your CSV file to analyze campaign performance and detect anomalies
          </p>
        </div>

        {status === 'idle' && (
          <Dropzone onFileSelect={handleFileSelect} />
        )}

        {status === 'uploading' && selectedFile && (
          <div className={styles.processing}>
            <UploadProgress
              progress={progress}
              fileName={selectedFile.name}
              fileSize={selectedFile.size}
            />
            <PipelineProgress currentStage={currentStage} />
          </div>
        )}

        {status === 'success' && data && (
          <UploadResult data={data} onReset={handleReset} />
        )}

        {status === 'waiting' && (
          <div className={styles.waiting} role="status">
            <p className={styles.waitingMessage}>
              This file has already been processed. Retrieving stored analysis...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.error} role="alert">
            <div className={styles.errorTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Upload Failed
            </div>
            <p className={styles.errorMessage}>{error}</p>
            <button className={styles.retry} onClick={handleReset}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DropzonePage;