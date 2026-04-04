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
export declare function calculateBatchPlan(input: BatchCalculatorInput): BatchPlan;
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
