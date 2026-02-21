import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-gray-300 font-body mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={
            danger
              ? 'px-4 py-2 text-sm font-medium text-white bg-rally-magenta/80 hover:bg-rally-magenta rounded transition-colors'
              : 'px-4 py-2 text-sm font-medium text-white bg-rally-blue/80 hover:bg-rally-blue rounded transition-colors'
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
