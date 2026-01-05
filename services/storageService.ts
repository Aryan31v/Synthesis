import Dexie, { Table } from 'dexie';
import { LearningPath, UserProfile, KnowledgeNode } from '../types';

// --- INITIAL DATA ---
export const INITIAL_PROFILE: UserProfile = {
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: Date.now(),
};

export const INITIAL_PATHS: LearningPath[] = [
  {
    id: 'inbox-path',
    title: 'Inbox',
    description: 'The landing zone for unprocessed commitments.',
    createdAt: Date.now(),
    tasks: [
      {
        id: 't-inbox-1',
        title: 'Review "Synthesis" documentation',
        completed: false,
        priority: 'Medium',
        intent: 'Study',
        sessionsCompleted: 0,
        estimatedSessions: 1,
        totalFocusMinutes: 0,
        xpValue: 10,
        subtasks: [],
        reviewDate: null,
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
      }
    ]
  },
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

// --- DATABASE DEFINITION ---
class SynthesisDB extends Dexie {
  profile!: Table<UserProfile & { key: string }>;
  paths!: Table<LearningPath>;
  nodes!: Table<KnowledgeNode>;

  constructor() {
    super('SynthesisDB');
    (this as any).version(1).stores({
      profile: 'key', // Singleton store, using 'key' as PK
      paths: 'id',
      nodes: 'id, tags'
    });
  }
}

const db = new SynthesisDB();

// --- DATA ACCESS METHODS ---

export const loadProfile = async (): Promise<UserProfile> => {
  try {
    const record = await db.profile.get('main');
    if (record) return record;
    return INITIAL_PROFILE;
  } catch (error) {
    console.error("Failed to load profile", error);
    return INITIAL_PROFILE;
  }
};

export const saveProfile = async (profile: UserProfile): Promise<void> => {
  await db.profile.put({ ...profile, key: 'main' });
};

export const loadPaths = async (): Promise<LearningPath[]> => {
  try {
    const paths = await db.paths.toArray();
    // Merge initial paths if they don't exist (basic check)
    if (paths.length === 0) return INITIAL_PATHS;
    
    // Ensure inbox exists for older users
    if (!paths.find(p => p.id === 'inbox-path')) {
       paths.unshift(INITIAL_PATHS.find(p => p.id === 'inbox-path')!);
    }
    
    return paths;
  } catch (error) {
    console.error("Failed to load paths", error);
    return INITIAL_PATHS;
  }
};

export const savePaths = async (paths: LearningPath[]): Promise<void> => {
  // Use transaction to ensure complete overwrite (handling deletions)
  await (db as any).transaction('rw', db.paths, async () => {
    await db.paths.clear();
    await db.paths.bulkAdd(paths);
  });
};

export const loadNodes = async (): Promise<KnowledgeNode[]> => {
  try {
    return await db.nodes.toArray();
  } catch (error) {
    console.error("Failed to load nodes", error);
    return [];
  }
};

export const saveNodes = async (nodes: KnowledgeNode[]): Promise<void> => {
  await (db as any).transaction('rw', db.nodes, async () => {
    await db.nodes.clear();
    await db.nodes.bulkAdd(nodes);
  });
};

// --- BACKUP & RESTORE ---

export const exportBackup = async (): Promise<string> => {
  const profile = await loadProfile();
  const paths = await db.paths.toArray();
  const nodes = await db.nodes.toArray();

  const backupData = {
    version: 1,
    timestamp: Date.now(),
    data: {
      profile,
      paths,
      nodes
    }
  };

  return JSON.stringify(backupData, null, 2);
};

export const importBackup = async (jsonString: string): Promise<boolean> => {
  try {
    const backup = JSON.parse(jsonString);
    if (!backup.data) throw new Error("Invalid backup format");

    await (db as any).transaction('rw', db.profile, db.paths, db.nodes, async () => {
      // Clear existing
      await db.profile.clear();
      await db.paths.clear();
      await db.nodes.clear();

      // Restore
      if (backup.data.profile) await db.profile.put({ ...backup.data.profile, key: 'main' });
      if (backup.data.paths) await db.paths.bulkAdd(backup.data.paths);
      if (backup.data.nodes) await db.nodes.bulkAdd(backup.data.nodes);
    });
    
    return true;
  } catch (error) {
    console.error("Restore failed:", error);
    return false;
  }
};