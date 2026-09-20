import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = true
}) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="w-[90vw] sm:max-w-[400px] p-0 rounded-2xl overflow-hidden gap-0 border-slate-200 shadow-xl bg-white z-[100]">
        <DialogHeader className={`px-4 pt-4 pb-2 border-b border-slate-100 ${isDestructive ? 'bg-rose-50/50' : 'bg-white'}`}>
          <DialogTitle className={`text-sm font-black tracking-tight ${isDestructive ? 'text-rose-600' : 'text-slate-900'}`}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 py-4 bg-white text-sm text-slate-600">
          {description.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i !== description.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        <div className="px-4 pb-4 pt-2 bg-white flex flex-col gap-2">
          <button 
            onClick={onConfirm} 
            className={`w-full px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-white rounded-lg transition-all shadow-sm ${
              isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {confirmText}
          </button>
          <button 
            onClick={onCancel} 
            className="w-full px-4 py-2 text-[11px] uppercase tracking-wider font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            {cancelText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
