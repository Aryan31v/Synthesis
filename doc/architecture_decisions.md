# Architecture Decision Record (ADR)

## 1. Storage Strategy: Local-First with IndexedDB
**Decision:** Use `Dexie.js` (IndexedDB wrapper) instead of `localStorage` or a remote SQL database.
**Context:** Synthesis handles complex graph data and potentially large text files. `localStorage` is synchronous (blocks UI) and limited to 5MB.
**Consequences:**
- **Pros:** Asynchronous (non-blocking), large storage capacity (GBs), native Javascript object storage, works offline.
- **Cons:** Slightly more complex to debug than localStorage; requires a specific backup strategy (implemented via JSON export).

## 2. Application Type: Progressive Web App (PWA)
**Decision:** Build as a PWA using `manifest.json` and `sw.js`.
**Context:** Users need to access their "Second Brain" on mobile devices, often in environments with poor connectivity.
**Consequences:**
- **Pros:** Installable on Home Screen, no App Store friction, offline asset caching.
- **Cons:** Limited access to native device hardware compared to React Native (though sufficient for text/file inputs).

## 3. Graph Visualization: HTML5 Canvas
**Decision:** Use a custom HTML5 Canvas implementation (via `requestAnimationFrame`) rather than DOM/SVG-based libraries or heavy libraries like D3.js or Cytoscape.
**Context:** The Knowledge Graph needs to support dynamic physics simulations (attraction/repulsion) for potential 1000+ nodes without lag.
**Consequences:**
- **Pros:** High performance (60fps) on mobile; low memory overhead compared to DOM elements.
- **Cons:** No built-in accessibility for individual nodes (screen readers see one canvas); interaction events (clicks/hover) require manual coordinate calculation.

## 4. AI Integration: Google Gemini API (Multimodal)
**Decision:** Use `@google/genai` directly in the frontend.
**Context:** The app requires a large context window to analyze the entire user graph and curriculum state simultaneously to provide "Holistic" advice.
**Consequences:**
- **Pros:** Massive context window (1M+ tokens) allows feeding the whole DB state into the prompt; fast inference for chat.
- **Cons:** Requires the user to have an API key; Network dependency for "Architect" features (though the rest of the app is offline).

## 5. Spaced Repetition Algorithm: SuperMemo-2 (SM-2)
**Decision:** Implement a modified SM-2 algorithm.
**Context:** Users need an optimal schedule for reviewing notes to ensure retention.
**Consequences:**
- **Pros:** Industry standard for flashcards; simple to implement mathematically.
- **Cons:** Static intervals; doesn't adapt as dynamically as FSRS (Free Spaced Repetition Scheduler), but sufficient for MVP.

## 6. UI Framework: React + Tailwind CSS
**Decision:** Use React for state management and Tailwind for styling.
**Context:** Rapid iteration is required for the MVP.
**Consequences:**
- **Pros:** Component reusability (Modals, TaskItems); "Glassmorphism" aesthetic is easy to implement with Tailwind utility classes.
- **Cons:** Large bundle size if not tree-shaken correctly (mitigated by build tools).