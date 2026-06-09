import type { UploadResponse } from '../../types';
import { ResultsDashboard } from './ResultsDashboard';

interface UploadResultProps {
  data: UploadResponse;
  onReset: () => void;
}

export const UploadResult = ({ data, onReset }: UploadResultProps) => {
  return <ResultsDashboard data={data} onReset={onReset} />;
};