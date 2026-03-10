/**
 * Batch Calculator - Расчет тактов заливки для массовых элементов
 * 
 * Решает проблему:
 * - 569 м³ бетона на заклады = 2 опоры + 4-8 пилиров
 * - Каждый заклад = 1 такт заливки
 * - Дилатационные швы делят элемент на секции
 */

export interface DilationJoint {
  /** Расстояние от начала (m) */
  position_m: number;
  /** Тип шва */
  type: 'construction' | 'expansion' | 'settlement';
}

export interface BatchSection {
  /** Номер секции */
  section_number: number;
  /** Длина секции (m) */
  length_m: number;
  /** Объем бетона (m³) */
  volume_m3: number;
  /** Площадь опалубки (m²) */
  formwork_m2: number;
  /** Можно залить в один день с другими? */
  can_combine: boolean;
  /** Начало секции (m от начала элемента) */
  start_m: number;
  /** Конец секции (m от начала элемента) */
  end_m: number;
}

export interface BatchPlan {
  /** Всего секций (закладов) */
  total_sections: number;
  /** Секции */
  sections: BatchSection[];
  /** Рекомендуемые такты заливки */
  recommended_batches: BatchGroup[];
  /** Всего тактов */
  total_batches: number;
  /** Общий объем */
  total_volume_m3: number;
}

export interface BatchGroup {
  /** Номер такта */
  batch_number: number;
  /** Секции в этом такте */
  section_numbers: number[];
  /** Объем такта (m³) */
  volume_m3: number;
  /** Площадь опалубки (m²) */
  formwork_m2: number;
  /** Бригада (чел) */
  crew_size: number;
  /** Дни работы */
  days: number;
}

export interface BatchCalculatorInput {
  /** Тип элемента */
  element_type: 'foundation' | 'wall' | 'column' | 'slab';
  /** Общая длина элемента (m) */
  total_length_m: number;
  /** Общий объем бетона (m³) */
  total_volume_m3: number;
  /** Количество элементов (опор, пилиров и т.д.) */
  element_count: number;
  /** Дилатационные швы */
  dilation_joints?: DilationJoint[];
  /** Максимальный объем за такт (m³) */
  max_batch_volume_m3?: number;
  /** Высота элемента (m) */
  height_m?: number;
  /** Ширина элемента (m) */
  width_m?: number;
}

/**
 * Рассчитать план тактов заливки
 */
export function calculateBatchPlan(input: BatchCalculatorInput): BatchPlan {
  const {
    element_type,
    total_length_m,
    total_volume_m3,
    element_count,
    dilation_joints = [],
    max_batch_volume_m3 = 50, // По умолчанию 50 м³ за такт
    height_m = 3,
    width_m = 0.3,
  } = input;

  // 1. Определить секции (заклады)
  const sections: BatchSection[] = [];

  if (dilation_joints.length === 0) {
    // Нет швов → делим на равные секции по количеству элементов
    const section_length = total_length_m / element_count;
    const section_volume = total_volume_m3 / element_count;
    const section_formwork = calculateFormwork(section_length, height_m, width_m);

    for (let i = 0; i < element_count; i++) {
      sections.push({
        section_number: i + 1,
        length_m: section_length,
        volume_m3: section_volume,
        formwork_m2: section_formwork,
        can_combine: section_volume < max_batch_volume_m3,
        start_m: i * section_length,
        end_m: (i + 1) * section_length,
      });
    }
  } else {
    // Есть швы → делим по швам
    const positions = [0, ...dilation_joints.map(j => j.position_m), total_length_m].sort((a, b) => a - b);
    
    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i];
      const end = positions[i + 1];
      const length = end - start;
      const volume = (length / total_length_m) * total_volume_m3;
      const formwork = calculateFormwork(length, height_m, width_m);

      sections.push({
        section_number: i + 1,
        length_m: length,
        volume_m3: volume,
        formwork_m2: formwork,
        can_combine: volume < max_batch_volume_m3,
        start_m: start,
        end_m: end,
      });
    }
  }

  // 2. Сгруппировать секции в такты
  const batches = groupSectionsIntoBatches(sections, max_batch_volume_m3);

  return {
    total_sections: sections.length,
    sections,
    recommended_batches: batches,
    total_batches: batches.length,
    total_volume_m3,
  };
}

/**
 * Сгруппировать секции в такты заливки
 */
function groupSectionsIntoBatches(
  sections: BatchSection[],
  max_volume: number
): BatchGroup[] {
  const batches: BatchGroup[] = [];
  let current_batch: number[] = [];
  let current_volume = 0;
  let current_formwork = 0;

  for (const section of sections) {
    if (current_volume + section.volume_m3 <= max_volume && section.can_combine) {
      // Добавить в текущий такт
      current_batch.push(section.section_number);
      current_volume += section.volume_m3;
      current_formwork += section.formwork_m2;
    } else {
      // Закрыть текущий такт и начать новый
      if (current_batch.length > 0) {
        batches.push({
          batch_number: batches.length + 1,
          section_numbers: current_batch,
          volume_m3: current_volume,
          formwork_m2: current_formwork,
          crew_size: estimateCrewSize(current_volume),
          days: estimateDays(current_formwork),
        });
      }

      current_batch = [section.section_number];
      current_volume = section.volume_m3;
      current_formwork = section.formwork_m2;
    }
  }

  // Добавить последний такт
  if (current_batch.length > 0) {
    batches.push({
      batch_number: batches.length + 1,
      section_numbers: current_batch,
      volume_m3: current_volume,
      formwork_m2: current_formwork,
      crew_size: estimateCrewSize(current_volume),
      days: estimateDays(current_formwork),
    });
  }

  return batches;
}

/**
 * Рассчитать площадь опалубки
 */
function calculateFormwork(length_m: number, height_m: number, width_m: number): number {
  // Опалубка с двух сторон + торцы
  return 2 * length_m * height_m + 2 * width_m * height_m;
}

/**
 * Оценить размер бригады
 */
function estimateCrewSize(volume_m3: number): number {
  if (volume_m3 < 10) return 4;
  if (volume_m3 < 30) return 6;
  if (volume_m3 < 50) return 8;
  return 10;
}

/**
 * Оценить дни работы
 */
function estimateDays(formwork_m2: number): number {
  // 20 м² опалубки в день на бригаду
  return Math.ceil(formwork_m2 / 20);
}

/**
 * Пример использования:
 * 
 * const plan = calculateBatchPlan({
 *   element_type: 'foundation',
 *   total_length_m: 120,
 *   total_volume_m3: 569,
 *   element_count: 10, // 2 опоры + 8 пилиров
 *   dilation_joints: [
 *     { position_m: 30, type: 'construction' },
 *     { position_m: 60, type: 'construction' },
 *     { position_m: 90, type: 'construction' },
 *   ],
 *   max_batch_volume_m3: 50,
 *   height_m: 4,
 *   width_m: 1.2,
 * });
 * 
 * console.log(`Всего секций: ${plan.total_sections}`);
 * console.log(`Рекомендуемых тактов: ${plan.total_batches}`);
 * plan.recommended_batches.forEach(batch => {
 *   console.log(`Такт ${batch.batch_number}: секции ${batch.section_numbers.join(', ')}, ${batch.volume_m3} м³`);
 * });
 */
