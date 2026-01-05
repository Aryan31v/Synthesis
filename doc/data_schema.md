
# Data Schema Reference

## Database: `SynthesisDB` (IndexedDB)

The application uses three primary object stores defined via `Dexie.js`.

### 1. Store: `profile`
*Stores user gamification stats and metacognitive analysis.*
- **Primary Key:** `key` (Singleton, always 'main')
- **Structure:** `UserProfile`

| Field | Type | Description |
|-------|------|-------------|
| `xp` | number | Total Experience Points earned. |
| `level` | number | Derived from XP (XP / 1000). |
| `streak` | number | Consecutive days active. |
| `mindState` | object | (Optional) Results from AI Observer analysis. |

#### Sub-object: `MindState`
| Field | Type | Description |
|-------|------|-------------|
| `personality` | string | AI-generated archetype (e.g., "The Builder"). |
| `clusters` | array | Groupings of related node IDs. |
| `blindSpots` | array[string] | Topics missing from the graph. |
| `nextBestAction` | string | AI-suggested focus area. |
| `interestMatrix` | object | Map of `tag` -> `score` (0.0 - 1.0). |

---

### 2. Store: `paths`
*Stores recursive Learning Paths (Curriculums) and the Inbox.*
- **Primary Key:** `id` (UUID)
- **Structure:** `LearningPath`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier (e.g., 'inbox-path'). |
| `title` | string | Name of the path/folder. |
| `tasks` | array | Recursive array of `Task` objects. |
| `createdAt` | timestamp | Creation date. |

#### Sub-object: `Task` (Recursive)
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique Task ID. |
| `title` | string | Task description. |
| `completed` | boolean | Completion status. |
| `subtasks` | array | Recursive list of child tasks. |
| `isFolder` | boolean | If true, acts as a container (0 XP). |
| `priority` | enum | 'Low', 'Medium', 'High', 'Critical'. |
| `intent` | enum | 'Action', 'Study', 'Build', 'Think'. |
| `note` | string | Optional detailed notes or AI explanation. |
| `estimatedTime` | string | User-defined duration (e.g., "30m"). |
| `scheduledDate` | timestamp | For Calendar View (Start of day). |
| `xpValue` | number | Gamification reward value. |
| `sessionsCompleted` | number | Count of Pomodoro sessions done. |
| `reviewDate` | timestamp | Next SRS review date (Active Recall). |
| `interval` | number | Days until next review (SM-2 algo). |
| `easeFactor` | number | Difficulty multiplier (SM-2 algo). |

---

### 3. Store: `nodes`
*Stores the Knowledge Graph data.*
- **Primary Key:** `id` (UUID)
- **Indices:** `tags`
- **Structure:** `KnowledgeNode`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique Node ID. |
| `type` | string | 'note' or 'path' (virtual node). |
| `title` | string | Node label. |
| `content` | markdown | Full text content/notes. |
| `summary` | string | Short AI-generated summary. |
| `tags` | array[string] | Semantic tags for clustering and linking. |
| `x, y` | number | Physics simulation coordinates. |
| `vx, vy` | number | Physics velocity vectors. |
| `connections` | number | Cached degree of connectivity. |
| `lastAccessed` | timestamp | Used for visual "staleness" dimming. |

---

## Relationship Model

1. **Implicit Graph Links:**
   - Nodes are connected dynamically at runtime based on **Tag Overlap** and **Semantic Similarity** (keyword matching).
   - There is no explicit "Edges" table to maintain flexibility.

2. **Task-Node Links:**
   - Tasks can be converted to Nodes via the "Explain" feature (creating a Note).
   - Nodes can be converted to Learning Paths via the "Convert to Commitment" feature.
   - Tasks in the Inbox can be processed into Learning Paths via drag-and-drop or modal actions.
