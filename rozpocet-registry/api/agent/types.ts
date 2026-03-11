/**
 * AI Agent Types - Shared interfaces for AI classification agent
 */

export interface ParsedItem {
  id: string;
  kod: string;
  popis: string;
  popisFull?: string;
  mj?: string;
  mnozstvi?: number;
  cenaJednotkova?: number;
  rowRole?: 'main' | 'section' | 'subordinate' | 'unknown';
  skupina?: string | null;
  source: {
    projectId: string;
    sheetId: string;
    rowStart: number;
    rowEnd: number;
  };
}

export interface RowPack {
  main_text: string;      // Main item description
  child_text: string;     // Subordinate items as context
  meta: {
    itemId: string;
    kod: string;
    projectId: string;
    sheetId: string;
    rowNumber: number;
    language: 'cs' | 'sk';
  };
  hash: string;           // For caching
}

export interface ClassificationResult {
  itemId: string;
  skupina: string;        // Work group or 'unknown'
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0-100
  reasoning: string;
  source: 'rule' | 'memory' | 'gemini' | 'cache';
  modelUsed?: string;     // For gemini source
  timestamp?: number;
}

export interface MemoryExample {
  id: string;
  rowpackHash: string;
  mainText: string;
  childText: string;
  skupina: string;
  confirmed: boolean;     // true = user correction, false = AI accepted
  projectId: string;
  createdAt: number;
  metadata?: {
    kod?: string;
    confidence?: number;
  };
}

export interface RuleMatch {
  skupina: string;
  confidence: number;
  reasoning: string;
  ruleName: string;
}

export interface GeminiRequest {
  rowpack: RowPack;
  retrievedExamples: MemoryExample[];
  allowedSkupiny: string[];
}

export interface GeminiResponse {
  skupina: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

// Allowed work groups (synced with constants.ts)
export const ALLOWED_SKUPINY = [
  'ZEMNÍ_PRACE',
  'BETON_MONOLIT',
  'BETON_PREFAB',
  'VYZTUŽ',
  'KOTVENÍ',
  'BEDNENI',
  'PILOTY',
  'IZOLACE',
  'KOMUNIKACE',
  'DOPRAVA',
  'LOŽISKA',
] as const;

export type AllowedSkupina = typeof ALLOWED_SKUPINY[number];
