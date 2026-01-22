/**
 * AI Search API - Vercel Serverless Function
 * Provides semantic search using concrete-agent Multi-Role API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONCRETE_AGENT_URL = process.env.CONCRETE_AGENT_URL || 'https://concrete-agent.onrender.com';

interface SearchRequest {
  query: string;
  items: Array<{
    id: string;
    kod: string;
    popis: string;
    popisFull?: string;
    mj?: string;
    skupina?: string;
    cenaCelkem?: number;
  }>;
  limit?: number;
}

interface SearchResult {
  id: string;
  score: number;
  reasoning: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, items, limit = 20 } = req.body as SearchRequest;

    if (!query || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Query and items array are required' });
    }

    // Build context for semantic search
    const itemsList = items.slice(0, 100).map((item, i) =>
      `${i + 1}. [${item.kod}] ${item.popisFull || item.popis} | ${item.mj || '?'} | ${item.skupina || 'nezařazeno'}`
    ).join('\n');

    const prompt = `Najdi položky stavebního rozpočtu, které nejlépe odpovídají dotazu uživatele.

Dotaz uživatele: "${query}"

Dostupné položky (prvních 100):
${itemsList}

Vrať seznam indexů položek seřazených podle relevance. Pro každou relevantní položku uveď:
- index (1-based)
- score (0-100, jak moc odpovídá dotazu)
- reasoning (proč je relevantní)

Zahrň i položky, které:
- Obsahují podobné pojmy (synonyma)
- Jsou z podobné oblasti stavebnictví
- Mají podobnou funkci

Odpověz ve formátu JSON:
{
  "results": [
    {"index": 5, "score": 95, "reasoning": "Přesná shoda s dotazem"},
    {"index": 12, "score": 80, "reasoning": "Podobná položka - stejná kategorie"}
  ]
}

Vrať max ${limit} nejrelevantnějších položek.`;

    // Call concrete-agent Multi-Role API
    const response = await fetch(`${CONCRETE_AGENT_URL}/api/v1/multi-role/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'cost_estimator',
        question: prompt,
        context: {
          task: 'semantic_search',
          query,
          items_count: items.length
        }
      }),
    });

    if (!response.ok) {
      // Return empty results if AI fails (frontend will use Fuse.js fallback)
      return res.status(200).json({
        success: true,
        results: [],
        source: 'ai_unavailable',
        warning: 'AI search unavailable, use client-side search'
      });
    }

    const aiResponse = await response.json();

    // Parse AI response
    let results: SearchResult[] = [];

    try {
      const responseText = aiResponse.answer || aiResponse.response || '';
      const jsonMatch = responseText.match(/\{[\s\S]*"results"[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        results = parsed.results
          .filter((r: any) => r.index >= 1 && r.index <= items.length)
          .map((r: any) => ({
            id: items[r.index - 1].id,
            score: r.score || 50,
            reasoning: r.reasoning || ''
          }))
          .slice(0, limit);
      }
    } catch (parseError) {
      console.error('Failed to parse AI search response:', parseError);
    }

    return res.status(200).json({
      success: true,
      results,
      source: 'ai_multi_role',
      query,
      totalItems: items.length
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
