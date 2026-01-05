import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  type: 'input' | 'confirm';
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onClose: () => void;
  onConfirm: (value?: string) => void;
}

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  type,
  title,
  message,
  initialValue = '',
  placeholder = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onClose,
  onConfirm
}) => {
  const [inputValue, setInputValue] = React.useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(initialValue);
      // Focus input on open
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (type === 'input' && !inputValue.trim()) return;
    onConfirm(inputValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-white/5">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {message && <p className="text-slate-300 mb-4">{message}</p>}
          
          {type === 'input' && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              placeholder={placeholder}
              className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 pt-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors shadow-lg ${
              isDestructive 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
