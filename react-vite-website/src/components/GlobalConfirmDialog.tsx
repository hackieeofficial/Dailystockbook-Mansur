import React from 'react';
import { useConfirmStore } from '../store/useConfirmStore';
import { ConfirmDialog } from './ConfirmDialog';

export const GlobalConfirmDialog: React.FC = () => {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmStore();

  return (
    <ConfirmDialog
      open={isOpen}
      title={options.title}
      description={options.description}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      isDestructive={options.isDestructive}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
};
