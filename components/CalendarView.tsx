import React from 'react';
import { Task } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Circle } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onTaskClick }) => {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getTasksForDay = (day: number) => {
    return tasks.filter(t => {
      if (!t.scheduledDate) return false;
      const d = new Date(t.scheduledDate);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <CalIcon className="text-indigo-400" />
          {monthNames[month]} {year}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-full text-slate-300"><ChevronLeft size={20}/></button>
          <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-full text-slate-300"><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2 text-center text-slate-500 font-bold text-sm uppercase tracking-wider">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>

      <div className="grid grid-cols-7 gap-2 auto-rows-[100px]">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-transparent" />
        ))}
        
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayTasks = getTasksForDay(day);
          
          return (
            <div 
              key={day} 
              className={`
                bg-white/[0.03] border border-white/5 rounded-xl p-2 relative group hover:bg-white/[0.07] transition-all
                ${isToday(day) ? 'ring-1 ring-indigo-500 bg-indigo-500/10' : ''}
              `}
            >
              <div className={`text-sm font-bold mb-1 ${isToday(day) ? 'text-indigo-400' : 'text-slate-400'}`}>{day}</div>
              
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[60px] custom-scrollbar">
                {dayTasks.map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => onTaskClick(task)}
                    className={`
                      text-[10px] px-1.5 py-1 rounded truncate cursor-pointer transition-colors
                      ${task.completed ? 'bg-emerald-500/20 text-emerald-300 line-through opacity-50' : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'}
                    `}
                    title={task.title}
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
