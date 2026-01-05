
# Synthesis: MVP Status & Roadmap

## 1. Project Vision
**Synthesis** is not just a to-do list; it is a **Cognitive Operating System**. It combines recursive task management, a visual knowledge graph, and AI-driven metacognition to help users master complex topics. It is designed as a **Progressive Web App (PWA)** following a **Local-First** architecture.

---

## 2. Current Status (What Works)

### Core Systems
- **Recursive Curriculum Engine:** Users can create infinite levels of tasks/subtasks/folders.
- **Knowledge Graph (Brain Map):** A physics-based visualization of notes and concepts using HTML5 Canvas. Nodes cluster dynamically based on AI analysis.
- **AI Architect (Gemini):**
  - Context-aware chat that understands the user's current graph and tasks.
  - Auto-generation of structured Learning Paths from a single topic.
  - "Explain & Breakdown" feature for specific tasks.
- **Spaced Repetition System (SRS):** An Active Recall interface using the SuperMemo-2 algorithm to schedule reviews for knowledge retention.

### Storage & Persistence
- **IndexedDB (Dexie.js):** Replaced `localStorage` to support large datasets (10k+ nodes) and binary files.
- **Backup & Restore:** Full JSON export/import functionality to ensure data sovereignty.
- **Offline Capability:** Service Worker caches assets; Database works entirely offline.

### UI/UX
- **Dashboard:** Gamified stats (XP, Streaks) and Metacognitive insights (Blind spots, Next actions).
- **Pomodoro Timer:** Integrated focus timer linked to specific tasks for XP gain.
- **Responsive Design:** Mobile-first layout with a standalone app feel (PWA).

---

## 3. The MVP Roadmap

### Phase 1: Stabilization & Data Safety (Completed)
- [x] Migrate to IndexedDB for performance.
- [x] Implement robust JSON Backup/Restore.
- [x] PWA Manifest and Service Worker implementation.

### Phase 2: Enhanced Ingestion (The "Idea Inbox") (Completed)
- [x] **Quick Capture Mode:** A simplified interface to dump thoughts (Notes) or tasks (Inbox) rapidly.
- [x] **File Intelligence:** Ingestion engine extracts text from PDFs, ZIP archives, and Markdown files for AI analysis.
- [ ] **Web Clipper:** A browser extension or share target to send URLs directly to Synthesis.

### Phase 3: Cognitive Deepening (In Progress)
- [x] **Graph Tracing:** Physics-aware pathfinding algorithms to highlight connections between distant nodes.
- [ ] **Vector Search:** Implement local vector storage (e.g., TensorFlow.js) to allow semantic searching of notes (finding concepts by meaning, not just keywords).

### Phase 4: Sync & Collaboration (Future)
- [ ] **Optional Cloud Sync:** Integration with a backend (Supabase/Firebase) for multi-device sync, while keeping the Local-First philosophy as the default.

---

## 4. Known Issues / Constraints
- **Graph Performance:** On extremely large graphs (>2000 nodes), the force-directed simulation might throttle on mobile devices.
- **AI Dependency:** Usage requires an active internet connection and a valid Gemini API Key. The app works offline, but "Architect" features do not.
