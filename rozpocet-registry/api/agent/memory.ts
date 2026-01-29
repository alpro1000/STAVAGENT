/**
 * Memory Store - Learning from user corrections
 * Phase 1: In-memory storage (stateless, no persistence)
 * Phase 2: Will be replaced with Supabase/Vercel Postgres
 *
 * NOTE: This is a temporary in-memory implementation.
 * Production version should use persistent storage.
 */

import type { MemoryExample, RowPack } from './types';

// Temporary in-memory store (resets on function cold start)
const memoryStore: Map<string, MemoryExample[]> = new Map();

/**
 * Store a new memory example (user correction or confirmed AI result)
 */
export function storeMemoryExample(example: MemoryExample): void {
  const projectId = example.projectId;

  if (!memoryStore.has(projectId)) {
    memoryStore.set(projectId, []);
  }

  const projectMemories = memoryStore.get(projectId)!;

  // Check for duplicates (same hash + skupina)
  const isDuplicate = projectMemories.some(
    m => m.rowpackHash === example.rowpackHash && m.skupina === example.skupina
  );

  if (!isDuplicate) {
    projectMemories.push(example);
    console.log(`[Memory] Stored example for project ${projectId}: ${example.skupina} (confirmed: ${example.confirmed})`);
  }
}

/**
 * Retrieve similar examples from memory
 * Uses simple text similarity (Phase 1)
 * TODO: Replace with vector search (embeddings + FAISS/pgvector)
 */
export function retrieveSimilarExamples(
  rowpack: RowPack,
  topK: number = 3
): MemoryExample[] {
  const projectId = rowpack.meta.projectId;
  const projectMemories = memoryStore.get(projectId) || [];

  if (projectMemories.length === 0) {
    return [];
  }

  // Calculate similarity scores
  const scored = projectMemories.map(example => ({
    example,
    score: calculateTextSimilarity(
      rowpack.main_text + ' ' + rowpack.child_text,
      example.mainText + ' ' + example.childText
    ),
  }));

  // Sort by score (descending) and take top K
  const topExamples = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(item => item.score > 0.3) // Minimum similarity threshold
    .map(item => item.example);

  console.log(`[Memory] Retrieved ${topExamples.length} similar examples (threshold: 0.3)`);
  return topExamples;
}

/**
 * Check cache for exact match (by hash)
 */
export function checkCache(rowpackHash: string, projectId: string): MemoryExample | null {
  const projectMemories = memoryStore.get(projectId) || [];
  const cached = projectMemories.find(m => m.rowpackHash === rowpackHash);

  if (cached) {
    console.log(`[Memory] Cache HIT for hash ${rowpackHash.substring(0, 8)}...`);
    return cached;
  }

  return null;
}

/**
 * Calculate text similarity (simple word overlap)
 * TODO: Replace with embeddings + cosine similarity
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Jaccard similarity
  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const set1Array = Array.from(set1);
  const set2Array = Array.from(set2);

  const intersection = new Set(set1Array.filter(w => set2.has(w)));
  const union = new Set([...set1Array, ...set2Array]);

  return intersection.size / union.size;
}

/**
 * Tokenize text (simple word splitting + normalization)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 2); // Remove short words
}

/**
 * Get memory statistics
 */
export function getMemoryStats(): {
  totalExamples: number;
  confirmedExamples: number;
  projectCounts: Record<string, number>;
} {
  let totalExamples = 0;
  let confirmedExamples = 0;
  const projectCounts: Record<string, number> = {};

  const entries = Array.from(memoryStore.entries());
  for (const [projectId, examples] of entries) {
    totalExamples += examples.length;
    confirmedExamples += examples.filter(e => e.confirmed).length;
    projectCounts[projectId] = examples.length;
  }

  return { totalExamples, confirmedExamples, projectCounts };
}

/**
 * Clear memory for a project (for testing)
 */
export function clearProjectMemory(projectId: string): void {
  memoryStore.delete(projectId);
  console.log(`[Memory] Cleared memory for project ${projectId}`);
}

/**
 * Export memory (for persistence or migration)
 */
export function exportMemory(): MemoryExample[] {
  const allExamples: MemoryExample[] = [];
  const allValues = Array.from(memoryStore.values());
  for (const examples of allValues) {
    allExamples.push(...examples);
  }
  return allExamples;
}

/**
 * Import memory (for persistence or migration)
 */
export function importMemory(examples: MemoryExample[]): void {
  for (const example of examples) {
    storeMemoryExample(example);
  }
  console.log(`[Memory] Imported ${examples.length} examples`);
}
