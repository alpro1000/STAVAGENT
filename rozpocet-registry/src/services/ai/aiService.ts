/**
 * AI Service - Frontend client for AI-powered BOQ operations
 * Calls Vercel serverless functions which proxy to concrete-agent
 */

import type { ParsedItem } from '../../types/item';

// API base URL - empty for same-origin (Vercel)
const API_BASE = import.meta.env.VITE_API_BASE || '';

export interface ClassifyResult {
  id: string;
  skupina: string;
  confidence: number;
  reasoning: string;
}

export interface SearchResult {
  id: string;
  score: number;
  reasoning: string;
}

export interface GroupResult {
  groupName: string;
  groupDescription: string;
  itemIds: string[];
  totalCena: number;
  itemCount: number;
}

export interface AIResponse<T> {
  success: boolean;
  results?: T[];
  groups?: GroupResult[];
  source: string;
  warning?: string;
  error?: string;
}

/**
 * AI-powered classification of BOQ items
 */
export async function classifyItems(
  items: ParsedItem[],
  mode: 'single' | 'batch' = 'batch'
): Promise<AIResponse<ClassifyResult>> {
  try {
    const response = await fetch(`${API_BASE}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(item => ({
          id: item.id,
          kod: item.kod,
          popis: item.popis,
          popisFull: item.popisFull,
          mj: item.mj,
          mnozstvi: item.mnozstvi,
          cenaJednotkova: item.cenaJednotkova
        })),
        mode
      })
    });

    if (!response.ok) {
      throw new Error(`Classification failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI Classification error:', error);
    return {
      success: false,
      source: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * AI-powered semantic search
 */
export async function searchItems(
  query: string,
  items: ParsedItem[],
  limit: number = 20
): Promise<AIResponse<SearchResult>> {
  try {
    const response = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        items: items.map(item => ({
          id: item.id,
          kod: item.kod,
          popis: item.popis,
          popisFull: item.popisFull,
          mj: item.mj,
          skupina: item.skupina,
          cenaCelkem: item.cenaCelkem
        })),
        limit
      })
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI Search error:', error);
    return {
      success: false,
      results: [],
      source: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * AI-powered grouping of similar items
 */
export async function groupItems(
  items: ParsedItem[],
  groupBy: 'similarity' | 'function' | 'material' | 'location' = 'similarity'
): Promise<AIResponse<GroupResult>> {
  try {
    const response = await fetch(`${API_BASE}/api/group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(item => ({
          id: item.id,
          kod: item.kod,
          popis: item.popis,
          popisFull: item.popisFull,
          mj: item.mj,
          mnozstvi: item.mnozstvi,
          cenaJednotkova: item.cenaJednotkova,
          cenaCelkem: item.cenaCelkem,
          skupina: item.skupina
        })),
        groupBy
      })
    });

    if (!response.ok) {
      throw new Error(`Grouping failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI Grouping error:', error);
    return {
      success: false,
      groups: [],
      source: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if AI service is available
 */
export async function checkAIHealth(): Promise<boolean> {
  try {
    // Simple ping to check if API is responding
    const response = await fetch(`${API_BASE}/api/classify`, {
      method: 'OPTIONS'
    });
    return response.ok || response.status === 405; // 405 means endpoint exists
  } catch {
    return false;
  }
}
