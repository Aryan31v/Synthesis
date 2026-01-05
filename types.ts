

export type CognitiveIntent = 'Action' | 'Study' | 'Build' | 'Think';

export interface InterestCluster {
  id: string;
  themeName: string;
  nodeIds: string[];
}

export interface InterestMatrix {
  [tag: string]: number; // Weight/Intensity of interest (0.0 to 1.0)
}

export interface MindState {
  clusters: InterestCluster[];
  personality: string;
  profileDescription: string;
  blindSpots: string[];
  nextBestAction: string;
  interestMatrix: InterestMatrix;
  lastAnalysisDate: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  subtasks: Task[];
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  isFolder?: boolean; // New: Supports nested folders
  
  // Cognitive & Focus Metadata
  intent: CognitiveIntent; 
  sessionsCompleted: number; // Actual Pomodoros done
  estimatedSessions: number; // Predicted effort
  totalFocusMinutes: number;
  
  // Knowledge Linking
  linkedNodeIds?: string[];
  isKnowledgeCandidate?: boolean; // Flag to promote to SRS

  note?: string;
  estimatedTime?: string;
  scheduledDate?: number | null; // Timestamp for Calendar View
  xpValue: number;
  
  // SRS Fields
  reviewDate: number | null; // Timestamp
  interval: number; // Days
  easeFactor: number; // Multiplier (starts at 2.5)
  repetitions: number;
}

export interface LearningPath {
  id: string;
  title: string;
  description?: string;
  tasks: Task[];
  createdAt: number;
}

export interface UserProfile {
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: number; // Timestamp for streak calc
  mindState?: MindState;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  isLoading?: boolean;
}

export interface KnowledgeNode {
  id: string;
  type: 'note' | 'path';
  title: string;
  summary?: string;
  tags: string[];
  content?: string;
  embedding?: number[]; // Vector embedding for semantic search
  lastAccessed?: number; // For Staleness
  connections?: number; // For Density
  
  // Graph Physics state
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export type Tab = 'dashboard' | 'curriculum' | 'chat' | 'review' | 'graph';

export const XP_PER_LEVEL = 1000;