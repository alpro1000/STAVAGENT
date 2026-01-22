/**
 * AI Grouping API - Vercel Serverless Function
 * Groups similar BOQ items using concrete-agent Multi-Role API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONCRETE_AGENT_URL = process.env.CONCRETE_AGENT_URL || 'https://concrete-agent.onrender.com';

interface GroupRequest {
  items: Array<{
    id: string;
    kod: string;
    popis: string;
    popisFull?: string;
    mj?: string;
    mnozstvi?: number;
    cenaJednotkova?: number;
    cenaCelkem?: number;
    skupina?: string;
  }>;
  groupBy?: 'similarity' | 'function' | 'material' | 'location';
}

interface GroupResult {
  groupName: string;
  groupDescription: string;
  itemIds: string[];
  totalCena: number;
  itemCount: number;
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
    const { items, groupBy = 'similarity' } = req.body as GroupRequest;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Build context for grouping
    const itemsList = items.map((item, i) =>
      `${i + 1}. [${item.kod}] ${item.popisFull || item.popis} | ${item.mj} | ${item.cenaCelkem?.toLocaleString() || 0} Kč`
    ).join('\n');

    const groupingCriteria = {
      similarity: 'podobnosti popisu a typu práce',
      function: 'funkce v rámci stavby (nosná konstrukce, izolace, povrchy, apod.)',
      material: 'použitého materiálu (beton, ocel, dřevo, apod.)',
      location: 'umístění na stavbě (základy, spodní stavba, nosná konstrukce, mostovka, apod.)'
    };

    const prompt = `Seskup následující položky stavebního rozpočtu podle ${groupingCriteria[groupBy]}.

Položky k seskupení:
${itemsList}

Vytvoř logické skupiny položek. Pro každou skupinu uveď:
- název skupiny (krátký, výstižný)
- popis skupiny (co mají položky společného)
- indexy položek v této skupině (1-based)

Odpověz ve formátu JSON:
{
  "groups": [
    {
      "name": "Betonáž nosné konstrukce",
      "description": "Položky související s betonáží hlavní nosné konstrukce mostu",
      "itemIndices": [1, 3, 7, 12]
    },
    {
      "name": "Výztuž a armování",
      "description": "Betonářská výztuž a armovací práce",
      "itemIndices": [2, 8, 15]
    }
  ]
}

Všechny položky musí být přiřazeny do nějaké skupiny. Pokud položka nepatří nikam, vytvoř skupinu "Ostatní".`;

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
          task: 'boq_grouping',
          groupBy,
          items_count: items.length
        }
      }),
    });

    if (!response.ok) {
      // Fallback: group by existing skupina
      const fallbackGroups = groupBySkupina(items);
      return res.status(200).json({
        success: true,
        groups: fallbackGroups,
        source: 'fallback_skupina',
        warning: 'AI unavailable, grouped by existing classification'
      });
    }

    const aiResponse = await response.json();

    // Parse AI response
    let groups: GroupResult[] = [];

    try {
      const responseText = aiResponse.answer || aiResponse.response || '';
      const jsonMatch = responseText.match(/\{[\s\S]*"groups"[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        groups = parsed.groups.map((g: any) => {
          const groupItems = g.itemIndices
            .filter((idx: number) => idx >= 1 && idx <= items.length)
            .map((idx: number) => items[idx - 1]);

          return {
            groupName: g.name,
            groupDescription: g.description,
            itemIds: groupItems.map((item: any) => item.id),
            totalCena: groupItems.reduce((sum: number, item: any) => sum + (item.cenaCelkem || 0), 0),
            itemCount: groupItems.length
          };
        });
      }
    } catch (parseError) {
      console.error('Failed to parse AI grouping response:', parseError);
      groups = groupBySkupina(items);
    }

    // Verify all items are assigned
    const assignedIds = new Set(groups.flatMap(g => g.itemIds));
    const unassigned = items.filter(item => !assignedIds.has(item.id));

    if (unassigned.length > 0) {
      groups.push({
        groupName: 'Ostatní',
        groupDescription: 'Nezařazené položky',
        itemIds: unassigned.map(item => item.id),
        totalCena: unassigned.reduce((sum, item) => sum + (item.cenaCelkem || 0), 0),
        itemCount: unassigned.length
      });
    }

    return res.status(200).json({
      success: true,
      groups,
      source: 'ai_multi_role',
      groupBy,
      totalItems: items.length,
      totalGroups: groups.length
    });

  } catch (error) {
    console.error('Grouping error:', error);
    return res.status(500).json({
      error: 'Grouping failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Fallback: group by existing skupina field
function groupBySkupina(items: GroupRequest['items']): GroupResult[] {
  const skupinaMap = new Map<string, GroupRequest['items']>();

  for (const item of items) {
    const skupina = item.skupina || 'Nezařazeno';
    if (!skupinaMap.has(skupina)) {
      skupinaMap.set(skupina, []);
    }
    skupinaMap.get(skupina)!.push(item);
  }

  return Array.from(skupinaMap.entries()).map(([skupina, groupItems]) => ({
    groupName: skupina,
    groupDescription: `Položky ve skupině "${skupina}"`,
    itemIds: groupItems.map(item => item.id),
    totalCena: groupItems.reduce((sum, item) => sum + (item.cenaCelkem || 0), 0),
    itemCount: groupItems.length
  }));
}
