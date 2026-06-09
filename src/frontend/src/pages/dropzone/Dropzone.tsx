import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import styles from '../../styles/dropzone.module.css';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const Dropzone = ({ onFileSelect, disabled = false }: DropzoneProps) => {
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setRejectionError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        const error = rejection.errors[0];
        setRejectionError(error.message);
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled,
  });

  const dropzoneClassName = [
    styles.dropzone,
    isDragActive && styles.dropzoneActive,
    disabled && styles.dropzoneDisabled,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...getRootProps()}
      className={dropzoneClassName}
      role="button"
      aria-label="Upload CSV file"
      tabIndex={0}
    >
      <input {...getInputProps()} aria-label="File input" />
      <div className={styles.dropzoneContent}>
        <svg
          className={styles.dropzoneIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {isDragActive ? (
          <p className={styles.dropzoneText}>Drop the CSV file here...</p>
        ) : (
          <>
            <p className={styles.dropzoneText}>
              Drag & drop a CSV file here, or click to select
            </p>
            <p className={styles.dropzoneHint}>Maximum file size: 10MB</p>
          </>
        )}
        {rejectionError && (
          <p className={styles.dropzoneError} role="alert">
            {rejectionError}
          </p>
        )}
      </div>
    </div>
  );
};