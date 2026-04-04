/**
 * Scheduling Engine
 * Simple serial resource-constrained scheduler
 *
 * Algorithm:
 *   1. Topological sort (by predecessors)
 *   2. For each task:
 *      - earliest_start = max(predecessors finish, resource available)
 *      - Assign task to earliest_start
 *      - Update resource availability
 *   3. Calculate critical path
 *   4. Find bottlenecks
 */
import type { Task, ScheduleEntry, Resources, Calendar } from '../calculators/types.js';
/**
 * Schedule a project with resource constraints
 *
 * @param tasks - List of tasks with predecessors and resource requirements
 * @param resources - Available resources (crews, kits, pumps)
 * @param calendar - Calendar (optional, for future expansion)
 * @returns Schedule with start/end times for each task
 *
 * @example
 * const schedule = scheduleProject(tasks, resources, calendar);
 * console.log(schedule);
 * // [
 * //   { task_id: 'T1', start_day: 0, end_day: 3.2, resources_used: {...} },
 * //   { task_id: 'T2', start_day: 3.2, end_day: 5.25, resources_used: {...} },
 * //   ...
 * // ]
 */
export declare function scheduleProject(tasks: Task[], resources: Resources, calendar?: Calendar): ScheduleEntry[];
/**
 * Find critical path (longest path from start to end)
 *
 * @param schedule - Schedule with task timings
 * @param tasks - Original tasks with predecessors
 * @returns Array of task IDs on critical path
 */
export declare function findCriticalPath(schedule: ScheduleEntry[], tasks: Task[]): string[];
/**
 * Calculate project duration (makespan)
 */
export declare function calculateProjectDuration(schedule: ScheduleEntry[]): number;
/**
 * Get schedule summary
 */
export interface ScheduleSummary {
    total_duration_days: number;
    total_labor_hours: number;
    total_cost: number;
    critical_path_tasks: string[];
    resource_utilization: Map<string, number>;
}
export declare function getScheduleSummary(schedule: ScheduleEntry[], tasks: Task[], resources: Resources): ScheduleSummary;
