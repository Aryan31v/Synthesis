
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, MindState, KnowledgeNode, LearningPath } from "../types";

const API_KEY = process.env.API_KEY;

const getSystemInstruction = (mindState?: MindState, nodes: KnowledgeNode[] = [], paths: LearningPath[] = []) => {
  const nodeContext = nodes.map(n => `- Node: "${n.title}" (Tags: ${n.tags.join(', ')})`).join('\n');
  const pathContext = paths.map(p => {
    const total = p.tasks.length;
    const completed = p.tasks.filter(t => t.completed).length;
    return `- Curriculum: "${p.title}" (${completed}/${total} completed)`;
  }).join('\n');

  let contextSnippet = `
USER DATA CONTEXT:
1. **Current Date:** ${new Date().toLocaleDateString()}
2. **Current Knowledge Graph (Brain Map):**
${nodeContext || "No nodes yet."}

3. **Current Curriculum (Commitments):**
${pathContext || "No active paths."}
`;

  if (mindState) {
    contextSnippet += `
4. **Metacognitive Profile:**
- Personality: ${mindState.personality}
- Description: ${mindState.profileDescription}
`;
  }

  return `
You are Synthesis AI, an expert architect of learning curriculums and educational guide.
${contextSnippet}

GOALS:
1. If the user asks to "Explain", "Define", or "Teach" a specific topic:
   - Provide a comprehensive Markdown explanation.
   - **CRITICAL**: At the end of the response, append a JSON block to save this explanation as a note.
   - JSON Format: \`\`\`json\n{ "type": "new_note", "title": "Topic Title", "summary": "One sentence summary", "tags": ["tag1", "tag2"], "content": "The full markdown explanation you just generated." }\n\`\`\`

2. If the user asks to "Explain and Breakdown" a task (or asks "What is this task?" regarding a to-do item):
   - First, clearly explain **what** the task is and **why** it is important.
   - Second, list the concrete steps to achieve it.
   - **CRITICAL**: Append a JSON block with type "task_breakdown".
   - JSON Format: 
     \`\`\`json
     { 
       "type": "task_breakdown", 
       "steps": [
         { "title": "Step 1 Action", "intent": "Action", "estimatedTime": "15m", "xpValue": 10 },
         { "title": "Step 2 Study", "intent": "Study", "estimatedTime": "30m", "xpValue": 20 }
       ] 
     }
     \`\`\`

3. If the user asks for a Plan, Curriculum, or says "I want to learn [Topic]":
   - Briefly discuss the approach in text.
   - **CRITICAL**: Append a JSON block with type "learning_path" containing a hierarchical list of tasks.
   - JSON Format:
     \`\`\`json
     {
       "type": "learning_path",
       "title": "Mastering [Topic]",
       "description": "A structured path to learn [Topic]",
       "tasks": [
         {
           "title": "Phase 1: Foundations",
           "priority": "High",
           "intent": "Study", // Options: Action, Study, Build, Think
           "estimatedTime": "2h",
           "xpValue": 50,
           "subtasks": [
              { "title": "Read basic concepts", "priority": "Medium", "intent": "Study", "estimatedTime": "30m", "xpValue": 10 },
              { "title": "Practice exercise", "intent": "Action", "estimatedTime": "45m", "xpValue": 20 }
           ]
         },
         {
            "title": "Phase 2: Application",
            "priority": "High",
            "intent": "Build",
            "estimatedTime": "4h",
            "xpValue": 100,
            "subtasks": []
         }
       ]
     }
     \`\`\`

4. If the user asks to add a specific task, to-do, or reminder (e.g., "Add 'Buy Milk' to my list" or "Remind me to study"):
   - Confirm the action in text.
   - Append a JSON block with type "add_task".
   - JSON Format:
     \`\`\`json
     {
       "type": "add_task",
       "title": "Task Title",
       "priority": "Medium", // Options: Low, Medium, High, Critical
       "intent": "Action" // Options: Action, Study, Build, Think
     }
     \`\`\`

5. General Rules:
   - Think Step-by-Step.
   - Use Markdown.
`;
};

export const streamChatResponse = async (
  history: ChatMessage[],
  newMessage: string,
  onChunk: (text: string) => void,
  mindState?: MindState,
  nodes?: KnowledgeNode[],
  paths?: LearningPath[]
): Promise<string> => {
  if (!API_KEY) {
    const msg = "AI Unavailable (Offline Mode). Please configure a Gemini API Key to use the Architect.";
    onChunk(msg);
    return msg;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: { systemInstruction: getSystemInstruction(mindState, nodes, paths) },
      history: history.map(h => ({ role: h.role, parts: [{ text: h.content }] }))
    });

    const result = await chat.sendMessageStream({ message: newMessage });
    let fullText = '';
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(fullText);
      }
    }
    return fullText;
  } catch (error) {
    console.error("Gemini API Error:", error);
    const err = "Error connecting to AI. Check your internet or API Key.";
    onChunk(err);
    return err;
  }
};

export const extractJSONFromMarkdown = (text: string): any | null => {
  // Try to find the LAST json block in the text, as that's where we append instructions
  const matches = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)];
  if (matches.length > 0) {
    try {
      // Get the last match
      const lastMatch = matches[matches.length - 1];
      return JSON.parse(lastMatch[1]);
    } catch (e) { console.error("JSON Parse Error", e); }
  }
  return null;
};

export const analyzeContent = async (text: string): Promise<{ title: string; summary: string; tags: string[]; suggestions: string[] }> => {
  if (!API_KEY) {
      // Offline Fallback
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      const title = lines[0]?.substring(0, 50) || "Untitled Note";
      const summary = text.substring(0, 150) + "...";
      return { title, summary, tags: ["manual"], suggestions: [] };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const prompt = `Analyze: "${text.substring(0, 5000)}". Return JSON: { "title": "string", "summary": "string", "tags": ["string"], "suggestions": ["string"] }`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    return { title: "Note", summary: "", tags: [], suggestions: [] };
  }
};

export interface NodeExpansion {
  subTopics: string[];
  books: string[];
  videos: string[];
}

export const expandNodeConcepts = async (topic: string, currentTags: string[]): Promise<NodeExpansion> => {
  if (!API_KEY) return { subTopics: [], books: [], videos: [] };

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const prompt = `
      Topic: "${topic}"
      Context Tags: [${currentTags.join(', ')}]
      Return JSON: { "subTopics": ["4 related concepts"], "books": ["2 books"], "videos": ["2 search terms"] }
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{ "subTopics": [], "books": [], "videos": [] }');
  } catch (error) {
    return { subTopics: [], books: [], videos: [] };
  }
};

/**
 * Generates a full recursive curriculum from a single topic title.
 */
export const generateLearningPathFromTopic = async (topic: string, context?: string): Promise<any> => {
    if (!API_KEY) {
        // Offline Fallback
        return {
             type: "learning_path",
             title: topic,
             description: "Manual Mode Path (AI Unavailable)",
             tasks: [
                 {
                     title: "Step 1: Research",
                     priority: "High",
                     intent: "Study",
                     estimatedTime: "30m",
                     xpValue: 10,
                     subtasks: []
                 },
                 {
                     title: "Step 2: Practice",
                     priority: "Medium",
                     intent: "Action",
                     estimatedTime: "30m",
                     xpValue: 10,
                     subtasks: []
                 }
             ]
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const prompt = `
            Create a detailed, recursive learning path for: "${topic}".
            ${context ? `Context: ${context}` : ''}
            
            Structure it as a JSON object matching this schema:
            {
                "type": "learning_path",
                "title": "${topic}",
                "description": "A structured mastery path.",
                "tasks": [
                    {
                        "title": "Major Milestone 1",
                        "priority": "High",
                        "intent": "Study",
                        "estimatedTime": "1h",
                        "xpValue": 50,
                        "subtasks": [
                            { "title": "Sub-concept", "priority": "Medium", "intent": "Action", "estimatedTime": "30m", "xpValue": 20, "subtasks": [] }
                        ]
                    }
                ]
            }
            Ensure at least 3 main tasks, each with 2-3 subtasks.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Path Gen Error", error);
        return null;
    }
}
