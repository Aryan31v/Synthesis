
import { GoogleGenAI, Type } from "@google/genai";
import { KnowledgeNode, Task, MindState } from "../types";

const API_KEY = process.env.API_KEY;

/**
 * Performs metacognitive analysis of the user's mind state based on Second Brain nodes and Tasks.
 * Uses gemini-3-pro-preview for advanced reasoning on cognitive patterns.
 */
export const analyzeMindState = async (nodes: KnowledgeNode[], tasks: Task[]): Promise<MindState> => {
  if (!API_KEY) {
      // Offline / Manual Fallback
      return {
          clusters: [],
          personality: "Manual Operator",
          profileDescription: "You are operating in Manual Mode (Offline). AI analysis is disabled, but your graph and tasks are fully functional.",
          blindSpots: ["AI Analysis Unavailable"],
          nextBestAction: "Continue building your knowledge graph manually.",
          interestMatrix: {},
          lastAnalysisDate: Date.now()
      };
  }

  // Always create a new instance to ensure fresh API key usage
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  try {
    if (nodes.length === 0) {
      throw new Error("Cannot analyze an empty graph. Add some knowledge nodes first.");
    }

    // Limit context size to prevent token overflow, focus on titles and tags
    const context = {
      nodes: nodes.map(n => ({ id: n.id, title: n.title, tags: n.tags })),
      tasks: tasks.map(t => ({ title: t.title, intent: t.intent, completed: t.completed }))
    };

    const prompt = `
      As a Metacognitive Observer, analyze this user's Second Brain data to map their digital personality and intellectual landscape.
      
      1. Cluster knowledge nodes into 2-4 logical 'Interest Clusters' based on their titles and tags.
      2. Identify the 'Personality Profile' (e.g., 'The Recursive Architect', 'The Practical Builder') by analyzing cognitive intents (Think, Build, Study, Action) and task completion.
      3. Identify 'Blind Spots': Important adjacent topics or skills missing from their current knowledge map.
      4. Construct an 'Interest List': A list of their top tags with a numeric intensity score (0.0 to 1.0).
      5. Formulate the 'Next Best Action' based on current gaps and ongoing projects.

      Return a JSON object matching the requested schema.
      Data: ${JSON.stringify(context)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clusters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  themeName: { type: Type.STRING },
                  nodeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["id", "themeName", "nodeIds"]
              }
            },
            personality: { type: Type.STRING },
            profileDescription: { type: Type.STRING },
            blindSpots: { type: Type.ARRAY, items: { type: Type.STRING } },
            nextBestAction: { type: Type.STRING },
            // Changed from dynamic Object to Array of Objects to satisfy API requirements
            interestList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tag: { type: Type.STRING },
                  score: { type: Type.NUMBER }
                },
                required: ["tag", "score"]
              }
            }
          },
          required: ["clusters", "personality", "profileDescription", "blindSpots", "nextBestAction", "interestList"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const result = JSON.parse(text);

    // Transform Array back to Map for internal app usage
    const interestMatrix: { [key: string]: number } = {};
    if (result.interestList && Array.isArray(result.interestList)) {
      result.interestList.forEach((item: { tag: string; score: number }) => {
        interestMatrix[item.tag] = item.score;
      });
    }

    return {
      clusters: result.clusters,
      personality: result.personality,
      profileDescription: result.profileDescription,
      blindSpots: result.blindSpots,
      nextBestAction: result.nextBestAction,
      interestMatrix: interestMatrix,
      lastAnalysisDate: Date.now()
    };
  } catch (error) {
    console.error("MindState Analysis Error:", error);
    throw error;
  }
};
