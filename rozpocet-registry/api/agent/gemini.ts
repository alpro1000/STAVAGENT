/**
 * Gemini Connector - Direct integration with Google Gemini API
 * Structured prompts for BOQ classification
 */

import type { GeminiRequest, GeminiResponse, MemoryExample } from './types.js';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
// gemini-2.5-flash-lite (Feb 2026, fast, cheap). gemini-2.0-flash retired.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Classify using Gemini with structured prompt
 */
export async function classifyWithGemini(
  request: GeminiRequest
): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const { rowpack, retrievedExamples, allowedSkupiny } = request;

  // Build prompt
  const prompt = buildPrompt(rowpack, retrievedExamples, allowedSkupiny);

  console.log(`[Gemini] Calling ${GEMINI_MODEL} for classification...`);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for deterministic results
          maxOutputTokens: 200,
          topP: 0.95,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse response
    const result = parseGeminiResponse(data);
    console.log(`[Gemini] Classification result: ${result.skupina} (${result.confidence})`);

    return result;
  } catch (error) {
    console.error('[Gemini] Classification failed:', error);
    throw error;
  }
}

/**
 * Build structured prompt for Gemini
 */
function buildPrompt(
  rowpack: any,
  examples: MemoryExample[],
  allowedSkupiny: string[]
): string {
  const systemPrompt = `Ты присваиваешь Skupina (работová skupina) ТОЛЬКО для ГЛАВНОЙ строки сметы.
Подчинённые строки (PP/PSC/VV/A195/B5) — это ТОЛЬКО контекст для понимания главной позиции.

ПРАВИЛА:
- Классифицируй ТОЛЬКО главную позицию
- Используй подчинённые строки как контекст
- Если не уверен → верни "unknown" и confidence=low
- НЕ придумывай новые категории
- Используй ТОЛЬКО категории из Allowed list или "unknown"

Доступные категории (Allowed Skupina):
${allowedSkupiny.join(', ')}`;

  // Add similar examples (few-shot learning)
  let examplesText = '';
  if (examples.length > 0) {
    examplesText = '\n\nПримеры подтверждённых классификаций (похожие позиции):\n';
    examples.forEach((ex, i) => {
      examplesText += `${i + 1}. MAIN: ${ex.mainText.substring(0, 100)}...\n`;
      if (ex.childText) {
        examplesText += `   CHILD: ${ex.childText.substring(0, 100)}...\n`;
      }
      examplesText += `   → Skupina: ${ex.skupina}\n\n`;
    });
  }

  const taskPrompt = `${systemPrompt}${examplesText}

ЗАДАЧА: Классифицируй эту позицию:

MAIN (главная позиция):
${rowpack.main_text}

CHILD CONTEXT (подчинённые строки для контекста):
${rowpack.child_text || '(нет подчинённых строк)'}

Верни результат СТРОГО в формате JSON (без лишнего текста):
{
  "skupina": "название категории или unknown",
  "confidence": "high|medium|low",
  "reason": "краткое объяснение (1 предложение)"
}`;

  return taskPrompt;
}

/**
 * Parse Gemini response and extract structured result
 */
function parseGeminiResponse(data: any): GeminiResponse {
  try {
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn('[Gemini] No JSON found in response');
      return {
        skupina: 'unknown',
        confidence: 'low',
        reason: 'Failed to parse Gemini response',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.skupina || !parsed.confidence) {
      console.warn('[Gemini] Invalid response structure');
      return {
        skupina: 'unknown',
        confidence: 'low',
        reason: 'Invalid response structure',
      };
    }

    // Normalize confidence
    const confidence = normalizeConfidence(parsed.confidence);

    return {
      skupina: parsed.skupina,
      confidence,
      reason: parsed.reason || 'No reasoning provided',
    };
  } catch (error) {
    console.error('[Gemini] Failed to parse response:', error);
    return {
      skupina: 'unknown',
      confidence: 'low',
      reason: 'Parse error',
    };
  }
}

/**
 * Normalize confidence to 'high' | 'medium' | 'low'
 */
function normalizeConfidence(conf: any): 'high' | 'medium' | 'low' {
  if (typeof conf === 'string') {
    const lower = conf.toLowerCase();
    if (lower.includes('high') || lower.includes('vysoká')) return 'high';
    if (lower.includes('medium') || lower.includes('střední')) return 'medium';
    return 'low';
  }

  if (typeof conf === 'number') {
    if (conf >= 80) return 'high';
    if (conf >= 50) return 'medium';
    return 'low';
  }

  return 'low';
}

/**
 * Convert confidence level to score (0-100)
 */
export function confidenceToScore(confidence: 'high' | 'medium' | 'low'): number {
  switch (confidence) {
    case 'high': return 90;
    case 'medium': return 65;
    case 'low': return 35;
  }
}
