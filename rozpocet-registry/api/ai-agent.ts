/**
 * AI Agent API - Unified endpoint for all AI operations
 * Operations: classify-empty, classify-all, record-correction, formwork-assistant
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ParsedItem } from './agent/types.js';
import { buildRowPack, extractSubordinates } from './agent/rowpack.js';
import { classifyBatch, getClassificationStats } from './agent/orchestrator.js';
import { classifyBatchRulesOnly } from './agent/classify-rules-only.js';
import { storeMemoryExample } from './agent/memory.js';
import { v4 as uuidv4 } from 'uuid';

// Feature flag: Enable/disable AI (Gemini)
const AI_ENABLED = process.env.AI_ENABLED !== 'false'; // Default: true

// ─── Formwork assistant: model config ────────────────────────────────────────
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const CLAUDE_API_KEY  = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL    = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

// ─── Formwork assistant: domain types ────────────────────────────────────────
type ElementType   = 'zakl' | 'stena' | 'pilir' | 'strop' | 'mostovka';
type Season        = 'summer' | 'spring_autumn' | 'winter' | 'frost';
type ConcreteClass = 'C25_CEM1' | 'C30_CEM2' | 'C35_mostni' | 'C25_CEM3';
type Workforce     = 'small_2' | 'medium_4' | 'large_6plus';

interface FormworkAIRequest {
  element_type:   ElementType;
  celkem_m2:      number;
  sada_m2:        number;
  pocet_sad:      number;
  bednici_system: string;
  season:         Season;
  concrete_class: ConcreteClass;
  workforce:      Workforce;
  deep_analysis?: boolean;
}

// ─── Formwork assistant: knowledge tables ────────────────────────────────────
const BASE_CURE_DAYS: Record<ElementType, number> = { zakl: 2, stena: 5, pilir: 7, strop: 21, mostovka: 28 };
const TEMP_FACTOR:    Record<Season, number>       = { summer: 1.0, spring_autumn: 2.0, winter: 3.0, frost: 4.0 };
const TEMP_RANGE:     Record<Season, string>       = { summer: '20–25°C', spring_autumn: '10–15°C', winter: '5–10°C', frost: '<5°C' };
const CEMENT_FACTOR:  Record<ConcreteClass, number>= { C25_CEM1: 1.0, C30_CEM2: 1.2, C35_mostni: 1.0, C25_CEM3: 1.8 };
const CEMENT_LABEL:   Record<ConcreteClass, string>= { C25_CEM1: 'C25/30 CEM I 42.5R', C30_CEM2: 'C30/37 CEM II', C35_mostni: 'C35/45 mostní', C25_CEM3: 'C25/30 CEM III' };
const ASSEMBLY_DAYS:  Record<Workforce, number>   = { small_2: 3, medium_4: 2, large_6plus: 2 };
const WORKFORCE_LABEL:Record<Workforce, string>   = { small_2: '2 pracovníci (bez jeřábu)', medium_4: '4 pracovníci + jeřáb', large_6plus: '6+ pracovníci + jeřáb' };
const ELEMENT_LABEL:  Record<ElementType, string>  = { zakl: 'Základy, čela stěn', stena: 'Stěny, opěry, opěrné zdi', pilir: 'Pilíře, masivní opěry', strop: 'Stropní desky — spodní bednění', mostovka: 'Mostovka (bridge deck)' };

function fwCalc(r: FormworkAIRequest) {
  const pocet_taktu  = r.sada_m2 > 0 ? Math.ceil(r.celkem_m2 / r.sada_m2) : 1;
  const dni_na_takt  = ASSEMBLY_DAYS[r.workforce];
  const tf = TEMP_FACTOR[r.season], cf = CEMENT_FACTOR[r.concrete_class], base = BASE_CURE_DAYS[r.element_type];
  const dni_beton_takt = Math.ceil(base * tf * cf);
  const dni_demontaz   = (r.element_type === 'strop' || r.element_type === 'mostovka') ? 2 : 1;
  const takt_per_set   = r.pocet_sad > 0 ? pocet_taktu / r.pocet_sad : pocet_taktu;
  const celkova_doba_dni = Math.ceil(takt_per_set * dni_na_takt + takt_per_set * dni_beton_takt + dni_demontaz);
  const billing_months   = Math.max(1, celkova_doba_dni / 30);
  const sada_m2_doporucena = r.sada_m2 > r.celkem_m2 * 0.6 && r.celkem_m2 > 50 ? Math.round(r.celkem_m2 * 0.4 * 10) / 10 : r.sada_m2;
  return { pocet_taktu, sada_m2_doporucena, dni_na_takt, dni_beton_takt, dni_demontaz, celkova_doba_dni, billing_months, temp_factor: tf, cement_factor: cf };
}

function fwBuildPrompt(r: FormworkAIRequest, c: ReturnType<typeof fwCalc>): string {
  const warnings: string[] = [];
  if (r.season === 'frost')  warnings.push('MRÁZ (<5°C): povinné vytápění nebo zakrytí betonu');
  if (r.season === 'winter') warnings.push('ZIMA: riziko zmrznutí, zajistit minimální teplotu +5°C');
  if (r.element_type === 'strop' || r.element_type === 'mostovka') warnings.push('Nosné spodní bednění: po odstranění nutno ponechat podbednění (re-propping) dle statika');
  if (r.element_type === 'mostovka') warnings.push('Mostovka: odstraňovat bednění postupně od středu k oporám (dle TP 102)');
  if (c.cement_factor > 1.5) warnings.push('CEM III: pomalá hydratace, nepodceňujte dobu zrání zvláště v zimním období');
  if (c.sada_m2_doporucena !== r.sada_m2) warnings.push(`Sada ${r.sada_m2} m² > 60% celkové plochy — zvažte menší sadu (doporučeno: ${c.sada_m2_doporucena} m²)`);
  return `Jsi expert na monolitické betonové konstrukce v ČR (mosty, opěry, pilíře).

VYPOČTENÝ PLÁN TAKTOVÁNÍ:
- Typ konstrukce: ${ELEMENT_LABEL[r.element_type]} | Bednění: ${r.bednici_system}
- Celková plocha: ${r.celkem_m2} m² | Sada: ${r.sada_m2} m² | Sad: ${r.pocet_sad}
- Počet taktů: ${c.pocet_taktu} | Montáž/takt: ${c.dni_na_takt} dní (${WORKFORCE_LABEL[r.workforce]})
- Zrání betonu: ${c.dni_beton_takt} dní (${BASE_CURE_DAYS[r.element_type]}d × ${c.temp_factor} × ${c.cement_factor.toFixed(1)})
  Beton: ${CEMENT_LABEL[r.concrete_class]}, Teplota: ${TEMP_RANGE[r.season]}
- Celková doba: ${c.celkova_doba_dni} dní (min. ${Math.ceil(c.billing_months)} měs.)
${warnings.length > 0 ? '\nRIZIKA:\n' + warnings.map(w => '- ' + w).join('\n') : ''}

Vrať POUZE JSON: {"zduvodneni":"<2-3 věty česky>","upozorneni":["<upozornění 1>","<upozornění 2>"]}`;
}

async function fwCallGemini(prompt: string) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
  const r = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 500 } }) });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  const text: string = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON from Gemini');
  const p = JSON.parse(m[0]);
  return { zduvodneni: p.zduvodneni || '', upozorneni: Array.isArray(p.upozorneni) ? p.upozorneni : [] };
}

async function fwCallClaude(prompt: string) {
  if (!CLAUDE_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) });
  if (!r.ok) throw new Error(`Claude ${r.status}`);
  const d = await r.json();
  const text: string = d.content?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON from Claude');
  const p = JSON.parse(m[0]);
  return { zduvodneni: p.zduvodneni || '', upozorneni: Array.isArray(p.upozorneni) ? p.upozorneni : [] };
}

/**
 * Main handler - routes to sub-handlers based on operation parameter
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { operation } = req.body;

    switch (operation) {
      case 'classify-empty':
        return await handleClassifyEmpty(req, res);
      case 'classify-all':
        return await handleClassifyAll(req, res);
      case 'record-correction':
        return await handleRecordCorrection(req, res);
      case 'formwork-assistant':
        return await handleFormworkAssistant(req, res);
      default:
        return res.status(400).json({ error: 'Invalid operation. Use: classify-empty, classify-all, record-correction, or formwork-assistant' });
    }
  } catch (error) {
    console.error('[ai-agent] Fatal error:', error);
    return res.status(500).json({
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handler: Formwork AI Assistant
 * Merged from formwork-assistant.ts to stay within Vercel Hobby 12-function limit
 */
async function handleFormworkAssistant(req: VercelRequest, res: VercelResponse) {
  const body: FormworkAIRequest = req.body;
  if (!body.element_type || !body.celkem_m2 || !body.sada_m2) {
    return res.status(400).json({ error: 'Missing required fields: element_type, celkem_m2, sada_m2' });
  }

  const calc = fwCalc(body);
  let zduvodneni: string | null = null;
  let upozorneni: string[] = [];
  let model_used = 'none (deterministic only)';

  try {
    const prompt = fwBuildPrompt(body, calc);
    if (body.deep_analysis && CLAUDE_API_KEY) {
      const ai = await fwCallClaude(prompt);
      zduvodneni = ai.zduvodneni; upozorneni = ai.upozorneni; model_used = CLAUDE_MODEL;
    } else if (GEMINI_API_KEY) {
      const ai = await fwCallGemini(prompt);
      zduvodneni = ai.zduvodneni; upozorneni = ai.upozorneni; model_used = GEMINI_MODEL;
    }
  } catch (aiErr) {
    console.warn('[FormworkAssistant] AI failed, using deterministic fallback:', aiErr);
    zduvodneni = `Pro ${ELEMENT_LABEL[body.element_type]} o ploše ${body.celkem_m2} m² jsou potřeba ${calc.pocet_taktu} takty. Zrání ${calc.dni_beton_takt} dní (${BASE_CURE_DAYS[body.element_type]}d × ${calc.temp_factor} při ${TEMP_RANGE[body.season]}). Celková doba ${calc.celkova_doba_dni} dní.`;
    if (body.season === 'frost') upozorneni.push('Mráz <5°C: nutné vytápění nebo zakrytí!');
    if (body.element_type === 'strop' || body.element_type === 'mostovka') upozorneni.push('Spodní bednění: nutné re-propping dle statika.');
  }

  return res.status(200).json({ ...calc, zduvodneni, upozorneni, model_used });
}



/**
 * Handler: Klasifikovat prázdné
 * Classifies ONLY items with empty skupina (main items only)
 */
async function handleClassifyEmpty(req: VercelRequest, res: VercelResponse) {
  const { projectId, sheetId, items, aiEnabled } = req.body;

  if (!projectId || !sheetId || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'projectId, sheetId, and items are required' });
  }

  const useAI = aiEnabled !== undefined ? aiEnabled : AI_ENABLED;
  console.log(`[classify-empty] Processing ${items.length} items (AI: ${useAI ? 'ON' : 'OFF'})`);

  // Filter MAIN items with empty skupina
  const mainItems = items.filter((item: ParsedItem) => {
    const isMain = item.rowRole
      ? (item.rowRole === 'main' || item.rowRole === 'section')
      : isMainCodeHeuristic(item.kod);
    const isEmpty = !item.skupina || item.skupina.trim() === '';
    return isMain && isEmpty;
  });

  if (mainItems.length === 0) {
    return res.status(200).json({
      success: true,
      changed: 0,
      unchanged: items.length,
      unknown: 0,
      aiEnabled: useAI,
      stats: { total: 0, bySource: {}, byConfidence: {}, unknown: 0 },
      message: 'No empty main items found',
    });
  }

  // Classify items
  let results;
  if (useAI) {
    const rowpacks = mainItems.map((mainItem: ParsedItem) => {
      const subordinates = extractSubordinates(mainItem, items);
      return buildRowPack(mainItem, subordinates);
    });
    results = await classifyBatch(rowpacks, { maxConcurrent: 5 });
  } else {
    results = classifyBatchRulesOnly(items).filter(r =>
      mainItems.some((m: ParsedItem) => m.id === r.itemId)
    );
  }

  const stats = getClassificationStats(results);
  const itemUpdates = new Map();

  for (const result of results) {
    itemUpdates.set(result.itemId, {
      skupina: result.skupina,
      confidence: result.confidence,
      confidenceScore: result.confidenceScore,
      reasoning: result.reasoning,
      source: result.source,
      modelUsed: result.modelUsed,
    });
  }

  return res.status(200).json({
    success: true,
    changed: results.length,
    unchanged: items.length - mainItems.length,
    unknown: stats.unknown,
    aiEnabled: useAI,
    stats,
    results: Array.from(itemUpdates.entries()).map(([itemId, update]) => ({
      itemId,
      ...update,
    })),
  });
}

/**
 * Handler: Překlasifikovat vše
 * Re-classifies ALL main items (keeps existing if confidence low)
 */
async function handleClassifyAll(req: VercelRequest, res: VercelResponse) {
  const { projectId, sheetId, items, forceUpdate = false, aiEnabled } = req.body;

  if (!projectId || !sheetId || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'projectId, sheetId, and items are required' });
  }

  const useAI = aiEnabled !== undefined ? aiEnabled : AI_ENABLED;
  console.log(`[classify-all] Processing ${items.length} items (force: ${forceUpdate}, AI: ${useAI ? 'ON' : 'OFF'})`);

  // Filter MAIN items
  const mainItems = items.filter((item: ParsedItem) => {
    const isMain = item.rowRole
      ? (item.rowRole === 'main' || item.rowRole === 'section')
      : isMainCodeHeuristic(item.kod);
    return isMain;
  });

  if (mainItems.length === 0) {
    return res.status(200).json({
      success: true,
      changed: 0,
      unchanged: items.length,
      unknown: 0,
      keptExisting: 0,
      aiEnabled: useAI,
      stats: { total: 0, bySource: {}, byConfidence: {}, unknown: 0 },
      message: 'No main items found',
    });
  }

  // Classify items
  let results;
  if (useAI) {
    const rowpacks = mainItems.map((mainItem: ParsedItem) => {
      const subordinates = extractSubordinates(mainItem, items);
      return buildRowPack(mainItem, subordinates);
    });
    results = await classifyBatch(rowpacks, { maxConcurrent: 5 });
  } else {
    results = classifyBatchRulesOnly(items).filter(r =>
      mainItems.some((m: ParsedItem) => m.id === r.itemId)
    );
  }

  // Process results: keep existing if confidence low
  const itemUpdates = new Map();
  let changedCount = 0;
  let keptExistingCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const originalItem = mainItems[i];

    let shouldUpdate = forceUpdate;
    if (!forceUpdate) {
      if (result.confidence === 'high' || result.confidence === 'medium') {
        shouldUpdate = true;
      } else if (result.skupina === 'unknown' || result.confidence === 'low') {
        shouldUpdate = false;
      }
    }

    if (shouldUpdate) {
      itemUpdates.set(result.itemId, {
        skupina: result.skupina,
        confidence: result.confidence,
        confidenceScore: result.confidenceScore,
        reasoning: result.reasoning,
        source: result.source,
        modelUsed: result.modelUsed,
        action: 'updated',
      });
      changedCount++;
    } else {
      itemUpdates.set(result.itemId, {
        skupina: originalItem.skupina || 'unknown',
        confidence: 'medium',
        confidenceScore: 50,
        reasoning: `Kept existing (AI confidence too low: ${result.confidence})`,
        source: 'kept_existing',
        action: 'kept',
      });
      keptExistingCount++;
    }
  }

  const stats = getClassificationStats(results);

  return res.status(200).json({
    success: true,
    changed: changedCount,
    unchanged: items.length - mainItems.length,
    unknown: stats.unknown,
    keptExisting: keptExistingCount,
    aiEnabled: useAI,
    stats,
    results: Array.from(itemUpdates.entries()).map(([itemId, update]) => ({
      itemId,
      ...update,
    })),
  });
}

/**
 * Handler: Record Correction
 * Saves user correction to Memory Store for learning
 */
async function handleRecordCorrection(req: VercelRequest, res: VercelResponse) {
  const { projectId, sheetId, itemId, newSkupina, allItems } = req.body;

  if (!projectId || !itemId || !newSkupina || !allItems) {
    return res.status(400).json({
      error: 'projectId, itemId, newSkupina, and allItems are required',
    });
  }

  const mainItem = allItems.find((item: ParsedItem) => item.id === itemId);
  if (!mainItem) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const isMain = mainItem.rowRole
    ? (mainItem.rowRole === 'main' || mainItem.rowRole === 'section')
    : isMainCodeHeuristic(mainItem.kod);

  if (!isMain) {
    return res.status(400).json({
      error: 'Can only record corrections for main items',
    });
  }

  const subordinates = extractSubordinates(mainItem, allItems);
  const rowpack = buildRowPack(mainItem, subordinates);

  const memoryExample = {
    id: uuidv4(),
    rowpackHash: rowpack.hash,
    mainText: rowpack.main_text,
    childText: rowpack.child_text,
    skupina: newSkupina,
    confirmed: true,
    projectId: projectId,
    createdAt: Date.now(),
    metadata: {
      kod: mainItem.kod,
      confidence: 100,
    },
  };

  storeMemoryExample(memoryExample);

  return res.status(200).json({
    success: true,
    message: 'Correction recorded successfully',
    memoryId: memoryExample.id,
    skupina: newSkupina,
    learned: true,
  });
}

/**
 * Helper: Check if code represents main item
 */
function isMainCodeHeuristic(kod: string): boolean {
  if (!kod) return false;
  const mainPattern = /^\d{6,}$/;
  return mainPattern.test(kod.trim());
}
