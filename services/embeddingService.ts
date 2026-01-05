
import { GoogleGenAI } from "@google/genai";
import { KnowledgeNode } from "../types";

const EMBEDDING_MODEL = "text-embedding-004";
const API_KEY = process.env.API_KEY;

/**
 * Generates a vector embedding for a given text string.
 */
export const generateEmbedding = async (text: string): Promise<number[] | undefined> => {
  if (!API_KEY) return undefined;

  try {
    if (!text || !text.trim()) return undefined;
    
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: {
        parts: [{ text: text.substring(0, 9000) }] // Ensure we don't hit token limits
      }
    });

    return response.embeddings?.[0]?.values;
  } catch (error) {
    console.error("Embedding Generation Error:", error);
    return undefined;
  }
};

/**
 * Calculates Cosine Similarity between two vectors.
 * Returns a value between -1 and 1 (1 being identical).
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Finds nodes semantically related to a query vector.
 */
export const findSemanticMatches = (
  targetVector: number[], 
  nodes: KnowledgeNode[], 
  threshold: number = 0.75
): { node: KnowledgeNode; score: number }[] => {
  
  return nodes
    .filter(n => n.embedding)
    .map(n => ({
      node: n,
      score: cosineSimilarity(targetVector, n.embedding!)
    }))
    .filter(match => match.score >= threshold)
    .sort((a, b) => b.score - a.score);
};
