/**
 * Gemini Connector — Vertex AI primary, direct API fallback
 * Structured prompts for BOQ classification
 *
 * On Cloud Run: uses Vertex AI ADC (no API key, GCP credits)
 * On Vercel: uses Vertex AI endpoint + GOOGLE_API_KEY (still routes through GCP)
 */

import type { GeminiRequest, GeminiResponse, MemoryExample } from './types.js';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const VERTEX_PROJECT = process.env.VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || 'europe-west3';
const USE_VERTEX = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';

/**
 * Build Gemini API URL + headers.
 * Vertex AI with ADC (Cloud Run) → Vertex AI with API key (Vercel) → direct API (last resort)
 */
async function getGeminiEndpoint(): Promise<{ url: string; headers: Record<string, string> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // 1. Try Vertex AI with ADC token (Cloud Run)
  if (USE_VERTEX && VERTEX_PROJECT) {
    try {
      const metaRes = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(2000) }
      );
      if (metaRes.ok) {
        const tokenData = await metaRes.json();
        if (tokenData.access_token) {
          const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
          headers['Authorization'] = `Bearer ${tokenData.access_token}`;
          console.log(`[Gemini] Using Vertex AI (ADC): ${VERTEX_LOCATION}/${GEMINI_MODEL}`);
          return { url, headers };
        }
      }
    } catch { /* not on Cloud Run */ }
  }

  // 2. Direct API with API key (Vercel / local dev)
  if (!GEMINI_API_KEY) throw new Error('No Vertex AI ADC and no GOOGLE_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  console.log(`[Gemini] Using direct API: ${GEMINI_MODEL}`);
  return { url, headers };
}

/**
 * Classify using Gemini with structured prompt
 */
export async function classifyWithGemini(
  request: GeminiRequest
): Promise<GeminiResponse> {
  const { rowpack, retrievedExamples, allowedSkupiny } = request;
  const prompt = buildPrompt(rowpack, retrievedExamples, allowedSkupiny);

  console.log(`[Gemini] Calling ${GEMINI_MODEL} for classification...`);

  try {
    const { url, headers } = await getGeminiEndpoint();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
          topP: 0.95,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
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
