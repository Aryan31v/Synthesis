
import React, { useState } from 'react';
import { Task } from '../types';
import { 
  ChevronRight, ChevronDown, CheckCircle, Circle, Plus, Trash2, 
  Sparkles, Clock, GripVertical, Pencil, X, Play, Brain, Hammer, Book, Zap, Folder, FolderOpen, Trophy, Calendar, BookOpen
} from 'lucide-react';

interface TaskItemProps {
  task: Task;
  pathId: string;
  depth?: number;
  isFocused?: boolean;
  onToggle: (pathId: string, taskId: string) => void;
  onAddSubtask: (pathId: string, parentTaskId: string) => void;
  onAddFolder: (pathId: string, parentTaskId: string) => void;
  onDelete: (pathId: string, taskId: string) => void;
  onExplain: (pathId: string, taskId: string, taskTitle: string) => void;
  onUpdate: (pathId: string, taskId: string, updates: Partial<Task>) => void;
  onMove: (sourcePathId: string, sourceTaskId: string, targetPathId: string, targetTaskId: string | null) => void;
  onFocus: (pathId: string, taskId: string) => void;
  onAddToReview?: (pathId: string, taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  pathId,
  depth = 0,
  isFocused = false,
  onToggle,
  onAddSubtask,
  onAddFolder,
  onDelete,
  onExplain,
  onUpdate,
  onMove,
  onFocus,
  onAddToReview
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Edit State
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNote, setEditNote] = useState(task.note || '');
  const [editTime, setEditTime] = useState(task.estimatedTime || '');
  const [editPriority, setEditPriority] = useState<Task['priority']>(task.priority);
  const [editIntent, setEditIntent] = useState<Task['intent']>(task.intent || 'Action');
  
  // Date conversion helper
  const toDateInputString = (timestamp?: number | null) => {
      if (!timestamp) return '';
      const d = new Date(timestamp);
      return d.toISOString().split('T')[0];
  };
  const [editDate, setEditDate] = useState(toDateInputString(task.scheduledDate));

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isFolder = task.isFolder;

  const handleSaveEdit = () => {
    onUpdate(pathId, task.id, {
      title: editTitle,
      note: editNote,
      estimatedTime: editTime,
      priority: editPriority,
      intent: editIntent,
      scheduledDate: editDate ? new Date(editDate).getTime() : null
    });
    setIsEditModalOpen(false);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Critical': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'High': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const getIntentIcon = (intent: string) => {
    switch (intent) {
        case 'Build': return <Hammer size={10} />;
        case 'Study': return <Book size={10} />;
        case 'Think': return <Brain size={10} />;
        default: return <Zap size={10} />;
    }
  };

  const getIntentColor = (intent: string) => {
    switch (intent) {
        case 'Build': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
        case 'Study': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
        case 'Think': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
        default: return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/json', JSON.stringify({ pathId, taskId: task.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.taskId === task.id) return; // Drop on self
      
      onMove(data.pathId, data.taskId, pathId, task.id);
      setIsExpanded(true); // Expand to show dropped item
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  return (
    <div 
      className={`flex flex-col select-none transition-all duration-300 ${depth > 0 ? 'ml-6 border-l border-white/5 pl-2' : 'mb-2'}`}
    >
      <div 
        className={`group flex items-center justify-between p-3 rounded-xl transition-all border
          ${task.completed ? 'opacity-60 bg-transparent border-transparent' : 'bg-white/5 border-transparent'}
          ${isFocused ? 'ring-1 ring-indigo-500 bg-indigo-500/10' : ''}
          ${isFolder ? 'bg-indigo-500/5 border-indigo-500/10' : ''}
          ${isDragOver ? 'bg-indigo-500/20 border-indigo-500/50' : 'hover:bg-white/10'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center flex-1 gap-3">
          {/* Drag Handle */}
          <div 
            draggable 
            onDragStart={handleDragStart}
            className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 p-1"
          >
            <GripVertical size={14} />
          </div>

          {/* Expand Toggle */}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className={`p-1 rounded-md hover:bg-white/10 text-white/50 transition-transform ${hasSubtasks || isFolder ? 'visible' : 'invisible'}`}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Checkbox or Folder Icon */}
          <button onClick={() => !isFolder && onToggle(pathId, task.id)} className={`transition-colors ${isFolder ? 'cursor-default' : 'hover:text-indigo-300'} text-indigo-400`}>
            {isFolder ? (
               isExpanded ? <FolderOpen size={20} className="fill-indigo-500/20" /> : <Folder size={20} className="fill-indigo-500/20" />
            ) : (
               task.completed ? <CheckCircle className="fill-indigo-500/20" size={20} /> : <Circle size={20} />
            )}
          </button>

          <div className="flex flex-col flex-1">
            <span className={`text-sm font-medium ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
              {task.title}
            </span>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {!isFolder && (
                  <>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${getIntentColor(task.intent)}`}>
                        {getIntentIcon(task.intent)} {task.intent}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      {/* XP Display */}
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-300 flex items-center gap-1">
                        <Trophy size={10} /> +{task.xpValue} XP
                      </span>
                  </>
              )}
              
              {/* Estimated Time */}
              {task.estimatedTime && (
                <span className="text-[10px] flex items-center gap-1 text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                   <Clock size={10} /> {task.estimatedTime}
                </span>
              )}

              {/* Scheduled Date */}
              {task.scheduledDate && (
                <span className="text-[10px] flex items-center gap-1 text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                   <Calendar size={10} /> {new Date(task.scheduledDate).toLocaleDateString()}
                </span>
              )}

              {/* Session Dots */}
              {(task.sessionsCompleted > 0 || task.estimatedSessions > 0) && !isFolder && (
                  <div className="flex items-center gap-0.5 ml-2" title={`${task.sessionsCompleted} sessions completed`}>
                      {Array.from({ length: Math.max(task.sessionsCompleted, task.estimatedSessions) }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-1.5 h-1.5 rounded-full ${i < task.sessionsCompleted ? 'bg-indigo-400' : 'bg-slate-700'}`}
                          />
                      ))}
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions - Visible on Hover - Added stopPropagation to all buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!task.completed && !isFolder && (
            <button 
                onClick={(e) => { e.stopPropagation(); onFocus(pathId, task.id); }} 
                title="Focus Now" 
                className={`p-1.5 rounded-lg transition-colors ${isFocused ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
                <Play size={14} fill={isFocused ? "currentColor" : "none"} />
            </button>
          )}
          {!isFolder && (
             <button 
                onClick={(e) => { e.stopPropagation(); onExplain(pathId, task.id, task.title); }} 
                title="Explain & Breakdown" 
                className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg"
             >
               <Sparkles size={14} />
             </button>
          )}
          {!isFolder && onAddToReview && (
              <button 
                  onClick={(e) => { e.stopPropagation(); onAddToReview(pathId, task.id); }} 
                  title="Add to Active Recall" 
                  className="p-1.5 text-orange-400 hover:bg-orange-500/20 rounded-lg"
              >
                <BookOpen size={14} />
              </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); }} 
            title="Edit" 
            className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg"
          >
            <Pencil size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onAddSubtask(pathId, task.id); }} 
            title="Add Subtask" 
            className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg"
          >
            <Plus size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onAddFolder(pathId, task.id); }} 
            title="Add Sub-Folder" 
            className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded-lg"
          >
            <Folder size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(pathId, task.id); }} 
            title="Delete" 
            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Note Preview if exists */}
      {task.note && (
        <div className="ml-16 mb-2 text-xs text-slate-400 italic flex gap-2">
            <span className="w-0.5 bg-slate-700 rounded-full h-auto"></span>
            {task.note}
        </div>
      )}

      {/* Recursive Render */}
      {isExpanded && hasSubtasks && (
        <div className="mt-1">
          {task.subtasks.map(sub => (
            <TaskItem
              key={sub.id}
              task={sub}
              pathId={pathId}
              depth={depth + 1}
              isFocused={isFocused && sub.id === task.id}
              onToggle={onToggle}
              onAddSubtask={onAddSubtask}
              onAddFolder={onAddFolder}
              onDelete={onDelete}
              onExplain={onExplain}
              onUpdate={onUpdate}
              onMove={onMove}
              onFocus={onFocus}
              onAddToReview={onAddToReview}
            />
          ))}
        </div>
      )}

      {/* Edit Modal Overlay */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[#1e293b] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Edit {isFolder ? 'Folder' : 'Commitment'}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Title</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {!isFolder && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Intent</label>
                        <select 
                            value={editIntent}
                            onChange={(e) => setEditIntent(e.target.value as any)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="Action">Action</option>
                            <option value="Study">Study</option>
                            <option value="Build">Build</option>
                            <option value="Think">Think</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Priority</label>
                        <select 
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as any)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>
                  </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Time Estimate</label>
                <input 
                    type="text" 
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    placeholder="e.g. 30m"
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              {!isFolder && (
                <div>
                   <label className="block text-xs text-slate-400 mb-1">Scheduled Date</label>
                   <input 
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                   />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Note</label>
                <textarea 
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
