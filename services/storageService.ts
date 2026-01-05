import { LearningPath, UserProfile, KnowledgeNode } from '../types';

const STORAGE_KEYS = {
  PATHS: 'synthesis_paths',
  PROFILE: 'synthesis_profile',
  NODES: 'synthesis_nodes',
  THEME: 'synthesis_theme',
};

// Initial Data
const INITIAL_PROFILE: UserProfile = {
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: Date.now(),
};

const INITIAL_PATHS: LearningPath[] = [
  {
    id: 'intro-path',
    title: 'Onboarding Protocols',
    description: 'Establish your baseline cognitive workflow.',
    createdAt: Date.now(),
    tasks: [
      {
        id: 't-1',
        title: 'Calibrate the Dashboard',
        completed: false,
        priority: 'High',
        intent: 'Action',
        sessionsCompleted: 0,
        estimatedSessions: 1,
        totalFocusMinutes: 0,
        xpValue: 50,
        subtasks: [],
        reviewDate: null,
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
      },
      {
        id: 't-2',
        title: 'Architect a Curriculum',
        completed: false,
        priority: 'Critical',
        intent: 'Build',
        sessionsCompleted: 0,
        estimatedSessions: 2,
        totalFocusMinutes: 0,
        xpValue: 100,
        subtasks: [
          {
            id: 't-2-1',
            title: 'Consult the AI Architect',
            completed: false,
            priority: 'Medium',
            intent: 'Think',
            sessionsCompleted: 0,
            estimatedSessions: 1,
            totalFocusMinutes: 0,
            xpValue: 20,
            subtasks: [],
            reviewDate: null,
            interval: 0,
            easeFactor: 2.5,
            repetitions: 0,
          }
        ],
        reviewDate: null,
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
      }
    ]
  }
];

export const loadProfile = (): UserProfile => {
  const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
  return stored ? JSON.parse(stored) : INITIAL_PROFILE;
};

export const saveProfile = (profile: UserProfile): void => {
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
};

export const loadPaths = (): LearningPath[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.PATHS);
  return stored ? JSON.parse(stored) : INITIAL_PATHS;
};

export const savePaths = (paths: LearningPath[]): void => {
  localStorage.setItem(STORAGE_KEYS.PATHS, JSON.stringify(paths));
};

export const loadNodes = (): KnowledgeNode[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.NODES);
  return stored ? JSON.parse(stored) : [];
};

export const saveNodes = (nodes: KnowledgeNode[]): void => {
  localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(nodes));
};