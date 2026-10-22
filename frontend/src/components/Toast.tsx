import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from '../icons';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto p-4 bg-white rounded-xl shadow-xl border border-slate-200/90 flex items-start space-x-3 animate-in slide-in-from-bottom-3 duration-200"
        >
          <div className="shrink-0 mt-0.5">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-slate-900">{t.title}</h4>
            {t.description && (
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{t.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
