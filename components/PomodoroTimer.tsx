import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Timer, Target } from 'lucide-react';
import { Task } from '../types';

const WORK_TIME = 25 * 60; // 25 minutes

interface PomodoroTimerProps {
  activeTask?: Task | null;
  onSessionComplete: () => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ activeTask, onSessionComplete }) => {
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      onSessionComplete();
      // Reset after completion
      setTimeLeft(WORK_TIME);
      // Play sound or notification here
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onSessionComplete]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(WORK_TIME);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center space-x-4 backdrop-blur-sm border px-4 py-2 rounded-full transition-all duration-300 ${isActive ? 'bg-indigo-900/40 border-indigo-500/50 shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/10'}`}>
      
      {activeTask && (
        <div className="hidden md:flex items-center text-xs font-medium text-indigo-300 border-r border-white/10 pr-4 mr-2 animate-in fade-in">
          <Target className="w-3 h-3 mr-2 text-indigo-400" />
          <span className="max-w-[150px] truncate">{activeTask.title}</span>
        </div>
      )}

      <div className={`flex items-center font-mono text-xl font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
        <Timer className={`w-5 h-5 mr-2 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`} />
        {formatTime(timeLeft)}
      </div>
      
      <div className="flex space-x-1">
        <button
          onClick={toggleTimer}
          className={`p-1.5 rounded-full transition-colors ${isActive ? 'text-white bg-indigo-600 hover:bg-indigo-500' : 'text-white hover:bg-white/10'}`}
        >
          {isActive ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={resetTimer}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
};