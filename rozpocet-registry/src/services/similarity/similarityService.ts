/**
 * Similarity Service
 * Поиск похожих позиций для автоматического назначения групп
 */

import Fuse from 'fuse.js';
import type { ParsedItem } from '../../types/item';

export interface SimilarItem {
  item: ParsedItem;
  score: number; // 0-1, чем меньше - тем лучше совпадение
  matchedFields: string[];
}

export interface SimilarityOptions {
  threshold?: number; // 0-1, порог совпадения (default: 0.4)
  maxResults?: number; // Максимум результатов (default: 10)
  includeUnclassified?: boolean; // Включать неклассифицированные (default: false)
}

/**
 * Находит похожие позиции по описанию
 */
export function findSimilarItems(
  targetItem: ParsedItem,
  allItems: ParsedItem[],
  options: SimilarityOptions = {}
): SimilarItem[] {
  const {
    threshold = 0.4,
    maxResults = 10,
    includeUnclassified = false,
  } = options;

  // Исключаем саму позицию из поиска
  const searchItems = allItems.filter((item) => item.id !== targetItem.id);

  // Фильтруем неклассифицированные если нужно
  const filteredItems = includeUnclassified
    ? searchItems
    : searchItems.filter((item) => item.skupina !== null);

  if (filteredItems.length === 0) {
    return [];
  }

  // Настройки Fuse.js для fuzzy search
  const fuse = new Fuse(filteredItems, {
    keys: [
      { name: 'popis', weight: 0.5 },
      { name: 'popisFull', weight: 0.3 },
      { name: 'kod', weight: 0.2 },
    ],
    threshold,
    includeScore: true,
    useExtendedSearch: false,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });

  // Ищем по описанию целевой позиции
  const results = fuse.search(targetItem.popisFull || targetItem.popis);

  // Преобразуем результаты
  return results
    .slice(0, maxResults)
    .map((result) => ({
      item: result.item,
      score: result.score || 0,
      matchedFields: result.matches?.map((m) => m.key).filter((key): key is string => key !== undefined) || [],
    }));
}

/**
 * Предлагает группу на основе похожих позиций
 * Возвращает наиболее частую группу среди похожих позиций
 */
export function suggestSkupinaFromSimilar(
  targetItem: ParsedItem,
  allItems: ParsedItem[],
  options: SimilarityOptions = {}
): {
  suggestedSkupina: string | null;
  confidence: number; // 0-100
  similarCount: number;
  topSimilar: SimilarItem[];
} {
  const similarItems = findSimilarItems(targetItem, allItems, {
    ...options,
    includeUnclassified: false, // Только классифицированные
  });

  if (similarItems.length === 0) {
    return {
      suggestedSkupina: null,
      confidence: 0,
      similarCount: 0,
      topSimilar: [],
    };
  }

  // Подсчитываем частоту групп
  const skupinaCounts = new Map<string, number>();
  for (const similar of similarItems) {
    const skupina = similar.item.skupina;
    if (skupina) {
      skupinaCounts.set(skupina, (skupinaCounts.get(skupina) || 0) + 1);
    }
  }

  // Находим наиболее частую группу
  let maxCount = 0;
  let suggestedSkupina: string | null = null;

  for (const [skupina, count] of skupinaCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      suggestedSkupina = skupina;
    }
  }

  // Вычисляем уверенность: (частота лучшей группы / всего похожих) * средний score
  const confidence = suggestedSkupina
    ? Math.round(
        ((maxCount / similarItems.length) *
          (1 - similarItems[0].score) * // Инвертируем score (меньше = лучше)
          100)
      )
    : 0;

  return {
    suggestedSkupina,
    confidence,
    similarCount: similarItems.length,
    topSimilar: similarItems.slice(0, 3), // Топ-3 похожих
  };
}

/**
 * Автоматически назначает группы похожим позициям
 * Когда пользователь назначает группу вручную, система ищет похожие позиции
 * и предлагает назначить им ту же группу
 */
export function autoAssignSimilarItems(
  sourceItem: ParsedItem, // Позиция, которой назначили группу
  allItems: ParsedItem[],
  minConfidence: number = 40 // Минимальная уверенность для автоназначения (снижено с 70 до 40)
): Array<{
  itemId: string;
  suggestedSkupina: string;
  confidence: number;
}> {
  if (!sourceItem.skupina) {
    return [];
  }

  // Находим похожие позиции
  const similarItems = findSimilarItems(sourceItem, allItems, {
    threshold: 0.65, // Более мягкий порог (было 0.5) - находит больше похожих
    maxResults: 50, // Увеличено с 20 до 50
    includeUnclassified: true, // Ищем среди неклассифицированных
  });

  // Фильтруем по уверенности и возвращаем предложения
  return similarItems
    .filter((similar) => {
      // Пропускаем уже классифицированные
      if (similar.item.skupina) return false;

      // Улучшенная формула уверенности с нелинейным масштабированием
      // При score=0.0 (идеальное совпадение) → confidence=100%
      // При score=0.5 (среднее) → confidence=75%
      // При score=0.65 (порог) → confidence=52%
      const confidence = Math.round(Math.pow(1 - similar.score, 0.7) * 100);
      return confidence >= minConfidence;
    })
    .map((similar) => ({
      itemId: similar.item.id,
      suggestedSkupina: sourceItem.skupina!,
      confidence: Math.round(Math.pow(1 - similar.score, 0.7) * 100),
    }));
}
