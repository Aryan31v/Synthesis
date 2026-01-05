

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, BookOpen, Bot, BrainCircuit, 
  Flame, Trophy, Plus, ArrowRight, Zap, Folder, 
  ChevronDown, ChevronRight, Sparkles, Network, Pencil, 
  Trash2, RotateCcw, Moon, Star, Check, X as XIcon, Clock, Calendar as CalIcon, List, Eye, EyeOff,
  Download, Upload, Loader, Save, Inbox, FileText
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';

import { Task, LearningPath, UserProfile, ChatMessage, Tab, XP_PER_LEVEL, KnowledgeNode, MindState } from './types';
import * as Storage from './services/storageService';
import * as SRS from './services/srsService';
import { streamChatResponse, extractJSONFromMarkdown, analyzeContent, generateLearningPathFromTopic } from './services/geminiService';
import { analyzeMindState } from './services/observerService';
import { generateEmbedding } from './services/embeddingService';

import { TaskItem } from './components/TaskItem';
import { PomodoroTimer } from './components/PomodoroTimer';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { ActionModal } from './components/ActionModal';
import { CalendarView } from './components/CalendarView';
import { CaptureModal } from './components/CaptureModal';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  
  // Data State - Initialize with defaults but flag as loading
  const [profile, setProfile] = useState<UserProfile>(Storage.INITIAL_PROFILE);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'model', content: "Greetings, Architect. I am your cognitive partner. Let's map your intellectual world." }
  ]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [expandedPathIds, setExpandedPathIds] = useState<Set<string>>(new Set());
  const [activeModal, setActiveModal] = useState<any>({ isOpen: false, type: 'input', action: 'add_subtask', title: '', context: {} });
  const [isGeneratingPath, setIsGeneratingPath] = useState(false);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  
  // Explanation Context
  const [explainTarget, setExplainTarget] = useState<{pathId: string, taskId: string} | null>(null);

  // Review Mode State
  const [reviewMode, setReviewMode] = useState<'srs' | 'calendar'>('srs');
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIAL DATA LOAD (Async) ---
  useEffect(() => {
    const initData = async () => {
      try {
        const [loadedProfile, loadedPaths, loadedNodes] = await Promise.all([
          Storage.loadProfile(),
          Storage.loadPaths(),
          Storage.loadNodes()
        ]);
        
        setProfile(loadedProfile);
        setPaths(loadedPaths);
        setNodes(loadedNodes);
        
        // Auto expand inbox if tasks exist, or intro path
        if (loadedPaths.length > 0) {
            const inbox = loadedPaths.find(p => p.id === 'inbox-path');
            if (inbox && inbox.tasks.length > 0) {
                setExpandedPathIds(new Set(['inbox-path']));
            } else if (loadedPaths.length > 1) {
                setExpandedPathIds(new Set([loadedPaths[1].id]));
            }
        }
        
        setIsDataLoaded(true);
      } catch (e) {
        console.error("Failed to load data", e);
        setIsDataLoaded(true); // Allow app to load even on error (empty state)
      }
    };
    initData();
  }, []);

  // --- SAVE SIDE EFFECTS ---
  useEffect(() => { if (isDataLoaded) Storage.saveProfile(profile); }, [profile, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) Storage.savePaths(paths); }, [paths, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) Storage.saveNodes(nodes); }, [nodes, isDataLoaded]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  // --- BACKUP & RESTORE HANDLERS ---
  const handleExportBackup = async () => {
    try {
        const json = await Storage.exportBackup();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `synthesis_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("Backup failed. See console.");
        console.error(e);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!confirm("Warning: Restoring a backup will overwrite ALL current data. Continue?")) {
          e.target.value = ''; // Reset
          return;
      }

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const json = evt.target?.result as string;
              const success = await Storage.importBackup(json);
              if (success) {
                  alert("Restore successful! Reloading application...");
                  window.location.reload();
              } else {
                  alert("Restore failed. Invalid format.");
              }
          } catch (err) {
              alert("Error processing file.");
          }
      };
      reader.readAsText(file);
  };

  // --- LOGIC HANDLERS ---
  const handleCapture = async (type: 'note' | 'task', content: string, extra?: any) => {
    if (type === 'note') {
        const title = extra?.title || "Quick Note " + new Date().toLocaleTimeString();
        const analysis = { title: title, summary: content.substring(0, 100) + '...', tags: ['inbox'] };
        
        // Generate embedding in background
        const embedding = await generateEmbedding(content);

        const newNode: KnowledgeNode = {
          id: crypto.randomUUID(),
          type: 'note',
          title: analysis.title,
          summary: analysis.summary,
          tags: analysis.tags,
          content: content,
          embedding: embedding, // Store vector
          lastAccessed: Date.now(),
          connections: 0
        };
        setNodes(prev => [...prev, newNode]);
    } else {
        // Add to Inbox Path
        const newTask: Task = {
            id: crypto.randomUUID(),
            title: content,
            completed: false,
            subtasks: [],
            priority: extra?.priority || 'Medium',
            intent: 'Action',
            sessionsCompleted: 0,
            estimatedSessions: 1,
            totalFocusMinutes: 0,
            xpValue: 10,
            reviewDate: null,
            interval: 0,
            easeFactor: 2.5,
            repetitions: 0
        };
        
        // Ensure inbox path exists, if not create it (should exist from loadPaths though)
        setPaths(prev => {
            const hasInbox = prev.some(p => p.id === 'inbox-path');
            if (hasInbox) {
                return prev.map(p => p.id === 'inbox-path' ? { ...p, tasks: [newTask, ...p.tasks] } : p);
            } else {
                return [{ id: 'inbox-path', title: 'Inbox', createdAt: Date.now(), tasks: [newTask] }, ...prev];
            }
        });
    }
  };

  const handleMindAnalysis = async () => {
    try {
      if (nodes.length === 0) {
        alert("Observer Analysis failed: Your Brain Map is empty. Add some notes first.");
        return;
      }
      const state = await analyzeMindState(nodes, paths.flatMap(p => p.tasks));
      setProfile(p => ({ ...p, mindState: state }));
    } catch (e: any) {
      alert(`Observer Analysis failed: ${e.message}`);
    }
  };

  const handleAddKnowledge = async (text: string) => {
    try {
      const analysis = await analyzeContent(text);
      const embedding = await generateEmbedding(text);
      
      const newNode: KnowledgeNode = {
        id: crypto.randomUUID(),
        type: 'note',
        title: analysis.title,
        summary: analysis.summary,
        tags: analysis.tags,
        content: text,
        embedding: embedding,
        lastAccessed: Date.now(),
        connections: 0
      };
      setNodes(prev => [...prev, newNode]);
    } catch (e) {
      alert("Failed to analyze content. Please try again.");
    }
  };

  const handleAddNode = (node: KnowledgeNode) => {
    setNodes(prev => [...prev, node]);
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<KnowledgeNode>) => {
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
  };

  const updateTaskRecursively = (tasks: Task[], taskId: string, updater: (t: Task) => Task): Task[] => {
    return tasks.map(t => {
      if (t.id === taskId) return updater(t);
      if (t.subtasks.length > 0) return { ...t, subtasks: updateTaskRecursively(t.subtasks, taskId, updater) };
      return t;
    });
  };

  const setCompletionRecursively = (tasks: Task[], completed: boolean): Task[] => tasks.map(t => ({ ...t, completed, subtasks: setCompletionRecursively(t.subtasks, completed) }));
  const deleteTaskRecursively = (tasks: Task[], taskId: string): Task[] => tasks.filter(t => t.id !== taskId).map(t => ({ ...t, subtasks: deleteTaskRecursively(t.subtasks, taskId) }));
  const findTaskRecursively = (tasks: Task[], taskId: string): Task | null => {
    for (const t of tasks) { if (t.id === taskId) return t; if (t.subtasks.length > 0) { const found = findTaskRecursively(t.subtasks, taskId); if (found) return found; } }
    return null;
  };
  const getActiveTask = (): Task | null => { if (!focusedTaskId) return null; for (const p of paths) { const t = findTaskRecursively(p.tasks, focusedTaskId); if (t) return t; } return null; };

  const handleModalConfirm = async (inputValue?: string) => {
      const { action, context } = activeModal;
      
      const createNewTask = (title: string, isFolder: boolean = false): Task => ({
          id: crypto.randomUUID(),
          title: title,
          completed: false,
          subtasks: [],
          priority: 'Medium',
          intent: 'Action',
          isFolder: isFolder,
          sessionsCompleted: 0,
          estimatedSessions: 1,
          totalFocusMinutes: 0,
          xpValue: isFolder ? 0 : 10,
          reviewDate: null,
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0
      });

      if (action === 'add_subtask' && inputValue) {
          const newTask = createNewTask(inputValue);
          setPaths(prev => prev.map(path => path.id === context.pathId ? { ...path, tasks: updateTaskRecursively(path.tasks, context.parentTaskId, t => ({ ...t, subtasks: [...t.subtasks, newTask] })) } : path));
      }
      if (action === 'add_folder' && inputValue) {
          const newFolder = createNewTask(inputValue, true);
          setPaths(prev => prev.map(path => path.id === context.pathId ? { ...path, tasks: updateTaskRecursively(path.tasks, context.parentTaskId, t => ({ ...t, subtasks: [...t.subtasks, newFolder] })) } : path));
      }
      if (action === 'add_root_task' && inputValue) {
          const newTask = createNewTask(inputValue);
          setPaths(prev => prev.map(p => p.id === context.pathId ? { ...p, tasks: [...p.tasks, newTask] } : p));
      }
      if (action === 'create_path' && inputValue) {
          if (context.fromNodeId) {
             // AUTO-GENERATE FROM NODE
             setIsGeneratingPath(true);
             setActiveModal({ ...activeModal, isOpen: false }); 
             
             // Recursively enrich tasks with IDs
             const enrichTasks = (rawTasks: any[]): Task[] => rawTasks.map(t => ({
                ...t, 
                id: crypto.randomUUID(), 
                completed: false, 
                subtasks: t.subtasks ? enrichTasks(t.subtasks) : [], 
                reviewDate: null, interval: 0, easeFactor: 2.5, repetitions: 0, xpValue: t.xpValue || 20,
                priority: t.priority || 'Medium', intent: t.intent || 'Action', sessionsCompleted: 0, estimatedSessions: 1, totalFocusMinutes: 0
             }));

             const jsonPath = await generateLearningPathFromTopic(inputValue);
             if (jsonPath) {
                 const newPath: LearningPath = { 
                    id: crypto.randomUUID(), 
                    title: inputValue, 
                    description: jsonPath.description || "Generated from Graph",
                    createdAt: Date.now(), 
                    tasks: enrichTasks(jsonPath.tasks || []) 
                 };
                 setPaths(prev => [...prev, newPath]);
                 setExpandedPathIds(prev => new Set(prev).add(newPath.id));
                 setNodes(prev => prev.map(n => n.id === context.fromNodeId ? { ...n, type: 'path' } : n));
                 alert(`Commitment "${inputValue}" generated with complete subtasks.`);
                 setActiveTab('curriculum');
             } else {
                 alert("Failed to generate curriculum structure.");
             }
             setIsGeneratingPath(false);
             return; 
          } 

          // Standard manual creation
          const newPath: LearningPath = { id: crypto.randomUUID(), title: inputValue, createdAt: Date.now(), tasks: [] };
          setPaths(prev => [...prev, newPath]);
          setExpandedPathIds(prev => new Set(prev).add(newPath.id));
      }
      if (action === 'rename_path' && inputValue) {
          setPaths(prev => prev.map(p => p.id === context.pathId ? { ...p, title: inputValue } : p));
      }
      if (action === 'delete_task') setPaths(prev => prev.map(path => path.id === context.pathId ? { ...path, tasks: deleteTaskRecursively(path.tasks, context.taskId) } : path));
      if (action === 'delete_path') setPaths(prev => prev.filter(p => p.id !== context.pathId));
      setActiveModal({ isOpen: false, context: {} });
  };

  const handleCreateManualPath = (node: KnowledgeNode) => {
    setActiveModal({
      isOpen: true,
      type: 'input',
      action: 'create_path',
      title: 'Convert Node to Commitment',
      initialValue: node.title,
      context: { fromNodeId: node.id }
    });
  };

  const handleSendMessage = async (text: string = chatInput) => {
    if (!text.trim() || isChatStreaming) return;
    setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: text }]);
    setChatInput('');
    setIsChatStreaming(true);
    const modelMsgId = crypto.randomUUID();
    setChatHistory(prev => [...prev, { id: modelMsgId, role: 'model', content: '', isLoading: true }]);
    
    await streamChatResponse(
      chatHistory, 
      text, 
      chunk => {
        setChatHistory(prev => prev.map(msg => msg.id === modelMsgId ? { ...msg, content: chunk, isLoading: false } : msg));
      }, 
      profile.mindState,
      nodes, 
      paths 
    );

    setIsChatStreaming(false);

    setChatHistory(currentHistory => {
        const lastMsg = currentHistory.find(m => m.id === modelMsgId);
        if (lastMsg) {
            const json = extractJSONFromMarkdown(lastMsg.content);
            if (json) {
                // Handle "new_note" type (from explanation)
                if (json.type === "new_note") {
                     // Fire and forget embedding generation
                     generateEmbedding(json.content).then(embedding => {
                        const newNode: KnowledgeNode = {
                            id: crypto.randomUUID(),
                            type: 'note',
                            title: json.title,
                            summary: json.summary || "Auto-generated from chat",
                            tags: json.tags || [],
                            content: json.content,
                            embedding: embedding,
                            lastAccessed: Date.now(),
                            connections: 0
                        };
                        setNodes(prev => [...prev, newNode]);
                     });
                }
                // Handle "learning_path" type
                else if (json.type === "learning_path" || json.tasks) {
                    const enrichTasks = (rawTasks: any[]): Task[] => rawTasks.map(t => ({
                        ...t, id: crypto.randomUUID(), completed: false, subtasks: t.subtasks ? enrichTasks(t.subtasks) : [], 
                        reviewDate: null, interval: 0, easeFactor: 2.5, repetitions: 0, xpValue: t.xpValue || 20,
                        priority: t.priority || 'Medium', intent: t.intent || 'Action', sessionsCompleted: 0, estimatedSessions: 1, totalFocusMinutes: 0
                    }));
                    const newPath: LearningPath = { id: crypto.randomUUID(), title: json.title, description: json.description, createdAt: Date.now(), tasks: enrichTasks(json.tasks || []) };
                    setPaths(p => [...p, newPath]);
                    setExpandedPathIds(prev => new Set(prev).add(newPath.id));
                    setActiveTab('curriculum');
                }
                // Handle "task_breakdown" type (from task explanation)
                else if (json.type === "task_breakdown" && json.steps && explainTarget) {
                    const newSubtasks: Task[] = json.steps.map((step: any) => ({
                        id: crypto.randomUUID(),
                        title: step.title,
                        completed: false,
                        subtasks: [],
                        priority: 'Medium',
                        intent: step.intent || 'Action',
                        isFolder: false,
                        sessionsCompleted: 0,
                        estimatedSessions: 1,
                        totalFocusMinutes: 0,
                        xpValue: step.xpValue || 10,
                        estimatedTime: step.estimatedTime || '15m',
                        reviewDate: null,
                        interval: 0,
                        easeFactor: 2.5,
                        repetitions: 0
                    }));

                    // Append to the specific task
                    setPaths(prev => prev.map(path => {
                        if (path.id !== explainTarget.pathId) return path;
                        return {
                            ...path,
                            tasks: updateTaskRecursively(path.tasks, explainTarget.taskId, t => ({
                                ...t,
                                subtasks: [...t.subtasks, ...newSubtasks]
                            }))
                        };
                    }));
                    
                    setExplainTarget(null);
                }
                // Handle "add_task" type (simple todo)
                else if (json.type === "add_task") {
                    const newTask: Task = {
                        id: crypto.randomUUID(),
                        title: json.title,
                        completed: false,
                        subtasks: [],
                        priority: json.priority || 'Medium',
                        intent: json.intent || 'Action',
                        isFolder: false,
                        sessionsCompleted: 0,
                        estimatedSessions: 1,
                        totalFocusMinutes: 0,
                        xpValue: 10,
                        reviewDate: null,
                        interval: 0,
                        easeFactor: 2.5,
                        repetitions: 0
                    };
                    
                    setPaths(prev => {
                        const hasInbox = prev.some(p => p.id === 'inbox-path');
                        if (hasInbox) {
                            return prev.map(p => p.id === 'inbox-path' ? { ...p, tasks: [newTask, ...p.tasks] } : p);
                        } else {
                            return [{ id: 'inbox-path', title: 'Inbox', createdAt: Date.now(), tasks: [newTask] }, ...prev];
                        }
                    });
                    setExpandedPathIds(prev => new Set(prev).add('inbox-path'));
                }
            }
        }
        return currentHistory;
    });
  };

  const handleFocusTask = (pathId: string, taskId: string) => {
    setFocusedTaskId(taskId);
  };

  const handleSessionComplete = () => {
    if (!focusedTaskId) return;
    const SESSION_XP = 25;
    
    setPaths(prev => prev.map(p => ({
      ...p,
      tasks: updateTaskRecursively(p.tasks, focusedTaskId, t => ({
        ...t,
        sessionsCompleted: t.sessionsCompleted + 1,
        totalFocusMinutes: t.totalFocusMinutes + 25
      }))
    })));

    setProfile(p => {
      const newXp = p.xp + SESSION_XP;
      return {
        ...p,
        xp: newXp,
        level: Math.floor(newXp / XP_PER_LEVEL) + 1
      };
    });
  };

  const handleToggleTask = (pathId: string, taskId: string) => {
    setPaths(prev => prev.map(p => p.id === pathId ? { ...p, tasks: updateTaskRecursively(p.tasks, taskId, t => {
        const isCompleting = !t.completed;
        if (isCompleting) setProfile(p => ({ ...p, xp: p.xp + t.xpValue, level: Math.floor((p.xp + t.xpValue) / XP_PER_LEVEL) + 1 }));
        return { ...t, completed: isCompleting, subtasks: setCompletionRecursively(t.subtasks, isCompleting), reviewDate: isCompleting ? SRS.getNextReviewDate(1) : null };
    }) } : p));
  };
  
  const handleAddToReview = (pathId: string, taskId: string) => {
      setPaths(prev => prev.map(p => p.id === pathId ? { ...p, tasks: updateTaskRecursively(p.tasks, taskId, t => ({
          ...t,
          reviewDate: Date.now(), // Due immediately
          interval: 1,
          repetitions: 0,
          isKnowledgeCandidate: true
      }))} : p));
      alert("Added to Active Recall queue.");
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
  };

  const togglePathExpansion = (pathId: string) => {
      setExpandedPathIds(prev => {
          const next = new Set(prev);
          if (next.has(pathId)) next.delete(pathId);
          else next.add(pathId);
          return next;
      });
  };

  // --- REVIEW TAB LOGIC ---
  const flattenTasks = (tasks: Task[]): Task[] => {
    return tasks.reduce((acc, t) => {
        acc.push(t);
        if (t.subtasks) acc.push(...flattenTasks(t.subtasks));
        return acc;
    }, [] as Task[]);
  };
  
  const allTasks = paths.flatMap(p => flattenTasks(p.tasks));
  const dueTasksSRS = allTasks.filter(t => t.reviewDate !== null && t.reviewDate <= Date.now() && !t.isFolder);
  
  // Stats Calculation
  const inboxTasksCount = paths.find(p => p.id === 'inbox-path')?.tasks.filter(t => !t.completed).length || 0;
  const inboxNotesCount = nodes.filter(n => n.tags.includes('inbox')).length;

  // SRS Logic
  const handleSRSGrade = (taskId: string, quality: number) => {
      let foundPathId = '';
      for(const p of paths) {
          if (findTaskRecursively(p.tasks, taskId)) {
              foundPathId = p.id;
              break;
          }
      }
      
      if (!foundPathId) return;

      setPaths(prev => prev.map(p => {
          if (p.id !== foundPathId) return p;
          return {
              ...p,
              tasks: updateTaskRecursively(p.tasks, taskId, t => {
                  const { interval, repetitions, easeFactor } = SRS.calculateSRS(quality, t.interval, t.easeFactor, t.repetitions);
                  return {
                      ...t,
                      interval,
                      repetitions,
                      easeFactor,
                      reviewDate: SRS.getNextReviewDate(interval)
                  };
              })
          };
      }));
      setIsFlashcardFlipped(false);
  };

  useEffect(() => {
     if (dueTasksSRS.length === 0) setIsFlashcardFlipped(false);
  }, [dueTasksSRS.length]);

  if (!isDataLoaded) {
      return (
          <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              <p className="animate-pulse text-indigo-300">Loading Synthesis...</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex font-sans selection:bg-indigo-500/30">
      <ActionModal {...activeModal} onConfirm={handleModalConfirm} onClose={() => setActiveModal({ ...activeModal, isOpen: false })} />
      <CaptureModal isOpen={isCaptureOpen} onClose={() => setIsCaptureOpen(false)} onCapture={handleCapture} />
      
      {isGeneratingPath && (
          <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
              <p className="text-white font-bold animate-pulse">Generating recursive commitment strategy...</p>
          </div>
      )}
      
      <aside className="w-20 lg:w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#0f172a] fixed h-full z-20 transition-all duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20"><Bot className="text-white" size={20} /></div>
          <span className="font-bold text-xl hidden lg:block tracking-tight">Synthesis</span>
        </div>
        
        <div className="px-6 py-4 hidden lg:block">
            <button 
                onClick={() => setIsCaptureOpen(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all mb-4"
            >
                <Plus size={20} /> Quick Capture
            </button>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Level {profile.level}</span>
                    <span className="text-xs text-indigo-400 font-mono">{profile.xp % XP_PER_LEVEL} / {XP_PER_LEVEL} XP</span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${(profile.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100}%` }}
                    />
                </div>
            </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2">
          {[ 
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' }, 
            { id: 'curriculum', icon: BookOpen, label: 'Curriculum' }, 
            { id: 'graph', icon: Network, label: 'Brain Map' }, 
            { id: 'chat', icon: BrainCircuit, label: 'Architect' }, 
            { id: 'review', icon: RotateCcw, label: 'Review' } 
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
              <item.icon size={20} /> <span className="hidden lg:block font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      
      {/* Mobile Floating Action Button */}
      <button 
        onClick={() => setIsCaptureOpen(true)}
        className="fixed bottom-20 right-4 lg:hidden z-50 w-14 h-14 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white border-2 border-white/10"
      >
          <Plus size={28} />
      </button>

      <main className={`flex-1 ml-20 lg:ml-64 relative flex flex-col transition-all duration-300 ${activeTab === 'graph' ? 'h-screen overflow-hidden' : 'min-h-screen p-4 lg:p-8'}`}>
        {activeTab !== 'graph' && (
          <header className="flex justify-between items-center mb-8 sticky top-0 z-10 py-4 bg-[#0f172a]/80 backdrop-blur-md -mx-4 px-4 lg:-mx-8 lg:px-8 border-b border-white/5">
            <h2 className="text-xl font-semibold capitalize text-white">{activeTab.replace('-', ' ')}</h2>
            <PomodoroTimer activeTask={getActiveTask()} onSessionComplete={handleSessionComplete} />
          </header>
        )}

        <div className={activeTab === 'graph' ? 'w-full h-full' : 'max-w-7xl mx-auto w-full'}>
          {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-purple-800 text-white shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><BrainCircuit size={120} /></div>
                      <h1 className="text-4xl font-black mb-3">Cognitive Status: {profile.mindState?.personality || "Awaiting Analysis"}</h1>
                      <p className="opacity-70 text-lg max-w-2xl leading-relaxed">{profile.mindState?.profileDescription || "Use the Brain Map tab to trigger the Metacognitive Observer."}</p>
                      <button onClick={() => setActiveTab('graph')} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-bold transition-all backdrop-blur-sm"><Sparkles size={18}/> Analyze MindState</button>
                  </div>
                  
                  {/* Inbox Zero Status */}
                  {(inboxTasksCount > 0 || inboxNotesCount > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div 
                                onClick={() => { setActiveTab('curriculum'); setExpandedPathIds(new Set(['inbox-path'])); }}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-[2rem] p-6 cursor-pointer transition-all flex items-center gap-6"
                           >
                               <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                   <Inbox size={32} />
                               </div>
                               <div>
                                   <div className="text-3xl font-black text-white">{inboxTasksCount}</div>
                                   <div className="text-sm text-slate-400 font-medium">Unprocessed Inbox Tasks</div>
                               </div>
                           </div>
                           <div 
                                onClick={() => setActiveTab('graph')}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-[2rem] p-6 cursor-pointer transition-all flex items-center gap-6"
                           >
                               <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                                   <FileText size={32} />
                               </div>
                               <div>
                                   <div className="text-3xl font-black text-white">{inboxNotesCount}</div>
                                   <div className="text-sm text-slate-400 font-medium">Captured Notes (#inbox)</div>
                               </div>
                           </div>
                      </div>
                  )}
                  
                  {/* Data Management Section */}
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Save size={20} className="text-emerald-400"/> Data Management</h3>
                      <div className="flex gap-4">
                          <button 
                             onClick={handleExportBackup}
                             className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20"
                          >
                              <Download size={18}/> Download Backup (JSON)
                          </button>
                          <div className="relative">
                              <button 
                                 onClick={() => fileInputRef.current?.click()}
                                 className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-all text-sm text-slate-300 hover:text-white"
                              >
                                  <Upload size={18}/> Restore Backup
                              </button>
                              <input 
                                ref={fileInputRef}
                                type="file" 
                                accept=".json" 
                                onChange={handleImportBackup} 
                                className="hidden" 
                              />
                          </div>
                      </div>
                      <p className="mt-4 text-xs text-slate-500">
                          Your data is stored locally in your browser's IndexedDB. Download a backup regularly to prevent data loss.
                      </p>
                  </div>

                  {profile.mindState && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-xl flex flex-col">
                              <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Sparkles size={22} className="text-indigo-400"/> Observer Next Priority</h3>
                              <p className="text-slate-300 text-lg leading-relaxed bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl">{profile.mindState.nextBestAction}</p>
                          </div>
                          <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-xl">
                              <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Zap size={22} className="text-red-400"/> Intellectual Gaps</h3>
                              <div className="flex flex-wrap gap-2">{profile.mindState.blindSpots.map(s => <span key={s} className="px-4 py-2 bg-red-500/10 text-red-300 border border-red-500/20 rounded-2xl text-xs font-bold">#{s}</span>)}</div>
                              <p className="text-slate-500 text-xs mt-6 italic">These topics are currently under-represented in your graph.</p>
                          </div>
                      </div>
                  )}
              </div>
          )}
          
          {activeTab === 'curriculum' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="flex justify-end mb-4">
                      <button onClick={() => setActiveModal({ isOpen: true, type: 'input', action: 'create_path', title: 'New Learning Path' })} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-full font-bold text-sm flex items-center gap-2"><Plus size={18}/> New Folder</button>
                  </div>
                  {paths.map(path => {
                      const isExpanded = expandedPathIds.has(path.id);
                      return (
                      <div key={path.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 transition-all hover:bg-white/[0.07]">
                          <div 
                            className="flex justify-between items-center cursor-pointer select-none"
                            onClick={() => togglePathExpansion(path.id)}
                          >
                              <div className="flex items-center gap-4">
                                  <div className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400'}`}>
                                      {isExpanded ? <Folder size={24}/> : <ChevronRight size={24}/>}
                                  </div>
                                  <div>
                                      <h3 className="text-2xl font-black text-white">{path.title}</h3>
                                      <div className="text-xs text-slate-500 font-medium">{path.tasks.length} Root Items</div>
                                  </div>
                              </div>
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => setActiveModal({ isOpen: true, type: 'input', action: 'rename_path', title: 'Rename Folder', context: { pathId: path.id }, initialValue: path.title })} className="p-2 text-slate-500 hover:text-white"><Pencil size={18}/></button>
                                  <button onClick={() => setActiveModal({ isOpen: true, type: 'confirm', action: 'delete_path', title: 'Delete Folder?', context: { pathId: path.id }, isDestructive: true })} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={18}/></button>
                              </div>
                          </div>
                          
                          {isExpanded && (
                              <div className="space-y-2 mt-8 animate-in slide-in-from-top-4 fade-in duration-300">
                                {path.tasks.map(t => (
                                  <TaskItem 
                                    key={t.id} task={t} pathId={path.id} onToggle={handleToggleTask} isFocused={focusedTaskId === t.id}
                                    onAddSubtask={(p, t) => setActiveModal({ isOpen: true, type: 'input', action: 'add_subtask', title: 'Add Sub-Commitment', context: { pathId: p, parentTaskId: t }})}
                                    onAddFolder={(p, t) => setActiveModal({ isOpen: true, type: 'input', action: 'add_folder', title: 'New Sub-Folder', context: { pathId: p, parentTaskId: t }})}
                                    onDelete={(p, t) => setActiveModal({ isOpen: true, type: 'confirm', action: 'delete_task', title: 'Delete Commitment?', context: { pathId: p, taskId: t }, isDestructive: true })}
                                    onExplain={(pId, tId, title) => { 
                                        setActiveTab('chat'); 
                                        setExplainTarget({ pathId: pId, taskId: tId });
                                        handleSendMessage(`Explain the task "${title}" clearly and break it down into actionable steps.`); 
                                    }}
                                    onUpdate={(p, t, up) => setPaths(prev => prev.map(path => path.id === p ? { ...path, tasks: updateTaskRecursively(path.tasks, t, task => ({ ...task, ...up })) } : path))}
                                    onMove={() => {}} onFocus={handleFocusTask}
                                    onAddToReview={handleAddToReview}
                                  />
                                ))}
                                <button onClick={() => setActiveModal({ isOpen: true, type: 'input', action: 'add_root_task', title: 'New Commitment', context: { pathId: path.id }})} className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl text-slate-500 hover:text-slate-300 hover:border-white/10 transition-all font-medium flex items-center justify-center gap-2"><Plus size={16}/> Add Commitment</button>
                              </div>
                          )}
                      </div>
                  )})}
              </div>
          )}

          {activeTab === 'review' && (
              <div className="flex flex-col animate-in fade-in duration-500 min-h-[60vh]">
                  <div className="flex justify-center mb-8 bg-white/5 p-1 rounded-2xl self-center">
                      <button onClick={() => setReviewMode('srs')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${reviewMode === 'srs' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Recall (SRS)</button>
                      <button onClick={() => setReviewMode('calendar')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${reviewMode === 'calendar' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Calendar</button>
                  </div>

                  {reviewMode === 'srs' && (
                      <div className="flex flex-col items-center justify-center flex-1">
                        {dueTasksSRS.length > 0 ? (
                            <div className="w-full max-w-xl">
                               <div className="flex justify-between items-end mb-6">
                                  <h2 className="text-3xl font-bold text-white">Active Recall</h2>
                                  <div className="text-indigo-400 font-mono text-sm">{dueTasksSRS.length} items due</div>
                               </div>
                               
                               <div className="bg-white/5 border border-white/10 rounded-[2rem] p-10 min-h-[400px] flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden group perspective-1000">
                                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                                   
                                   {/* Card Content - Flip Logic */}
                                   <div className="flex-1 flex flex-col items-center justify-center w-full">
                                      <div className="mb-4">
                                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Question</span>
                                          <h3 className="text-3xl font-bold text-white mt-2 leading-tight">{dueTasksSRS[0].title}</h3>
                                      </div>

                                      {isFlashcardFlipped ? (
                                          <div className="animate-in fade-in zoom-in-95 duration-300 w-full">
                                               <div className="w-full h-px bg-white/10 my-6"></div>
                                               <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block mb-2">Answer / Note</span>
                                               <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-slate-300 text-lg leading-relaxed text-left max-h-64 overflow-y-auto custom-scrollbar">
                                                  <ReactMarkdown>{dueTasksSRS[0].note || "*No detailed note available. Rely on title.*"}</ReactMarkdown>
                                               </div>
                                          </div>
                                      ) : (
                                          <button 
                                            onClick={() => setIsFlashcardFlipped(true)}
                                            className="mt-8 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 group"
                                          >
                                              <Eye size={20} /> Reveal Answer
                                          </button>
                                      )}
                                   </div>

                                   {/* Grading Buttons - Only visible after flip */}
                                   {isFlashcardFlipped && (
                                       <div className="w-full pt-6 mt-6 border-t border-white/5 flex gap-3 animate-in slide-in-from-bottom-4">
                                           <button onClick={() => handleSRSGrade(dueTasksSRS[0].id, 1)} className="flex-1 py-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 font-bold transition-all flex flex-col items-center gap-1 group/btn">
                                              <RotateCcw size={18} className="group-hover/btn:rotate-180 transition-transform duration-500"/>
                                              <span className="text-xs uppercase tracking-widest opacity-70">Forgot</span>
                                           </button>
                                           <button onClick={() => handleSRSGrade(dueTasksSRS[0].id, 3)} className="flex-1 py-4 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 font-bold transition-all flex flex-col items-center gap-1 group/btn">
                                              <Clock size={18} className="group-hover/btn:scale-110 transition-transform"/>
                                              <span className="text-xs uppercase tracking-widest opacity-70">Hard</span>
                                           </button>
                                           <button onClick={() => handleSRSGrade(dueTasksSRS[0].id, 4)} className="flex-1 py-4 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20 font-bold transition-all flex flex-col items-center gap-1 group/btn">
                                              <Check size={18} className="group-hover/btn:scale-110 transition-transform"/>
                                              <span className="text-xs uppercase tracking-widest opacity-70">Good</span>
                                           </button>
                                           <button onClick={() => handleSRSGrade(dueTasksSRS[0].id, 5)} className="flex-1 py-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 font-bold transition-all flex flex-col items-center gap-1 group/btn">
                                              <Star size={18} className="group-hover/btn:rotate-12 transition-transform"/>
                                              <span className="text-xs uppercase tracking-widest opacity-70">Easy</span>
                                           </button>
                                       </div>
                                   )}
                               </div>
                            </div>
                        ) : (
                            <div className="text-center p-12 bg-white/5 rounded-[2rem] border border-white/5">
                                <Trophy size={64} className="text-yellow-400 mx-auto mb-6 animate-bounce" />
                                <h2 className="text-3xl font-bold text-white mb-2">Recall Complete!</h2>
                                <p className="text-slate-400 mb-6">No scheduled reviews for now.</p>
                            </div>
                        )}
                      </div>
                  )}

                  {reviewMode === 'calendar' && (
                      <CalendarView 
                          tasks={allTasks} 
                          onTaskClick={(t) => {
                             // Find the path for this task to navigate or focus
                             const p = paths.find(path => findTaskRecursively(path.tasks, t.id));
                             if (p) {
                                 setActiveTab('curriculum');
                                 setExpandedPathIds(prev => new Set(prev).add(p.id));
                                 // Ideally scroll to task
                             }
                          }}
                      />
                  )}
              </div>
          )}
          
          {activeTab === 'graph' && (
            <KnowledgeGraph 
              nodes={nodes} 
              mindState={profile.mindState} 
              onNodeSelect={() => {}} 
              onAddFile={handleAddKnowledge} 
              onAddNode={handleAddNode}
              onDeleteNode={handleDeleteNode} 
              onCreateManualPath={handleCreateManualPath} 
              onAnalyzeMind={handleMindAnalysis}
              onUpdateNode={handleUpdateNode}
              paths={paths} // Pass paths for context in Chatbot
            />
          )}
          
          {activeTab === 'chat' && (
              <div className="h-[calc(100vh-140px)] flex flex-col bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden animate-in fade-in">
                  <div className="flex-1 overflow-y-auto p-8 space-y-6">
                      {chatHistory.map(m => {
                          const displayContent = m.content.replace(/```json[\s\S]*?```/g, '').trim();
                          if (!displayContent && !m.isLoading) return null;

                          return (
                              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`p-6 rounded-3xl max-w-[85%] text-lg leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-xl rounded-tr-none' : 'bg-slate-800 text-slate-200 border border-white/10 shadow-xl rounded-tl-none'}`}>
                                      <ReactMarkdown>{displayContent || m.content}</ReactMarkdown>
                                  </div>
                              </div>
                          );
                      })}
                      {isChatStreaming && <div className="p-6 bg-slate-800 rounded-3xl w-16 flex gap-1 justify-center animate-pulse"><div className="w-2 h-2 bg-indigo-400 rounded-full"/><div className="w-2 h-2 bg-indigo-400 rounded-full delay-75"/><div className="w-2 h-2 bg-indigo-400 rounded-full delay-150"/></div>}
                      <div ref={chatEndRef} />
                  </div>
                  <div className="p-6 bg-slate-900/50 border-t border-white/10 flex gap-4">
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className="flex-1 bg-slate-800 border-none rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none" placeholder="Ask your AI Architect..." />
                      <button onClick={() => handleSendMessage()} className="bg-indigo-600 hover:bg-indigo-500 p-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/20"><ArrowRight size={24} className="text-white" /></button>
                  </div>
              </div>
          )}
        </div>
      </main>
    </div>
  );
};
export default App;