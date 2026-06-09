import styles from '../../styles/dropzone.module.css';

interface UploadProgressProps {
  progress: number;
  fileName: string;
  fileSize?: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const UploadProgress = ({ progress, fileName, fileSize }: UploadProgressProps) => {
  return (
    <div className={styles.processingCard}>
      <div className={styles.processingHeader}>
        <svg
          className={styles.processingIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className={styles.processingFilename}>{fileName}</span>
        {fileSize && (
          <span className={styles.processingSize}>{formatFileSize(fileSize)}</span>
        )}
      </div>
      <div className={styles.progressBar}>
        <div
          className={styles.progressBarFill}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className={styles.progressBarText}>
        <span>Uploading...</span>
        <span>{progress}%</span>
      </div>
    </div>
  );
};