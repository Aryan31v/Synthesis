import React, { useState, useRef } from 'react';
import { X, Check, FileText, CheckSquare, Upload, Loader, Paperclip } from 'lucide-react';
import { extractTextFromFile } from '../services/fileProcessingService';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (type: 'note' | 'task', content: string, extra?: any) => Promise<void>;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
  const [activeType, setActiveType] = useState<'note' | 'task'>('task');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState(''); // For notes title
  const [priority, setPriority] = useState('Medium');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!content.trim() && activeType === 'note') return;
    if (!content.trim() && activeType === 'task') return;

    try {
        await onCapture(activeType, content, { title, priority });
        handleClose();
    } catch (e) {
        console.error(e);
    }
  };

  const handleClose = () => {
      setContent('');
      setTitle('');
      setPriority('Medium');
      setActiveType('task');
      onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      try {
          const text = await extractTextFromFile(file);
          if (activeType === 'note') {
              setTitle(prev => prev || file.name);
              setContent(prev => prev + (prev ? '\n\n' : '') + text);
          } else {
              // For tasks, we might just put a summary or the filename
              setContent(prev => prev || `Review ${file.name}`);
              // Ideally tasks shouldn't have massive bodies, but let's stick to title for now
          }
      } catch (error) {
          alert("Error processing file.");
      } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#1e293b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Tabs */}
        <div className="flex border-b border-white/5">
            <button 
                onClick={() => setActiveType('task')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeType === 'task' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
                <CheckSquare size={16}/> New Todo
            </button>
            <button 
                onClick={() => setActiveType('note')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeType === 'note' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
                <FileText size={16}/> Quick Note
            </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
            {activeType === 'task' ? (
                <div className="space-y-4">
                    <div>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="What needs to be done?"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            className="w-full bg-transparent text-2xl font-bold text-white placeholder-slate-600 border-none focus:ring-0 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <select 
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="Low">Low Priority</option>
                            <option value="Medium">Medium Priority</option>
                            <option value="High">High Priority</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 h-full flex flex-col">
                    <input 
                        type="text" 
                        placeholder="Note Title (Optional)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-transparent text-lg font-bold text-white placeholder-slate-600 border-b border-white/10 pb-2 focus:ring-0 focus:border-indigo-500 outline-none transition-colors"
                    />
                    <textarea 
                        autoFocus
                        placeholder="Write your thoughts..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full flex-1 min-h-[200px] bg-transparent text-slate-300 placeholder-slate-600 border-none focus:ring-0 outline-none resize-none font-mono text-sm leading-relaxed"
                    />
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900/50 p-4 border-t border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Attach File (extract text)"
                >
                    {isProcessing ? <Loader size={20} className="animate-spin text-indigo-400"/> : <Paperclip size={20}/>}
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                {isProcessing && <span className="text-xs text-indigo-400 animate-pulse">Processing file...</span>}
            </div>

            <div className="flex items-center gap-3">
                <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button 
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                >
                    <Check size={16}/> Save to {activeType === 'task' ? 'Inbox' : 'Graph'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};