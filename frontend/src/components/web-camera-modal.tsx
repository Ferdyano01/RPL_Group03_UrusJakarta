import type { PickedImageFile } from '@/services/api';

export interface WebCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (file: PickedImageFile) => void;
}

export function WebCameraModal(_props: WebCameraModalProps) {
  return null;
}
