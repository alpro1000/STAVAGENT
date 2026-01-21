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

import type { Task, ScheduleEntry, Resources, Calendar } from '../calculators/types';

/**
 * Resource availability tracker
 * Maps resource ID → earliest available day
 */
type ResourceAvailability = Map<string, number>;

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
export function scheduleProject(
  tasks: Task[],
  resources: Resources,
  calendar?: Calendar
): ScheduleEntry[] {
  const schedule: ScheduleEntry[] = [];
  const resourceAvailability: ResourceAvailability = new Map();

  // Initialize resource availability (all start at day 0)
  initializeResourceAvailability(resourceAvailability, resources);

  // 1. Topological sort by predecessors
  const sortedTasks = topologicalSort(tasks);

  // 2. Schedule each task
  for (const task of sortedTasks) {
    // Earliest start = max(predecessors finish, resource available)
    let earliestStart = 0;

    // Check predecessors
    if (task.predecessors && task.predecessors.length > 0) {
      for (const predId of task.predecessors) {
        const pred = schedule.find(s => s.task_id === predId);
        if (pred) {
          earliestStart = Math.max(earliestStart, pred.end_day);
        }
      }
    }

    // Check resource availability
    const requiredResources = getRequiredResources(task);
    for (const resourceId of requiredResources) {
      const available = resourceAvailability.get(resourceId) || 0;
      earliestStart = Math.max(earliestStart, available);
    }

    // Calculate end day
    const endDay = earliestStart + task.duration_days;

    // Add to schedule
    schedule.push({
      task_id: task.id,
      start_day: earliestStart,
      end_day: endDay,
      resources_used: task.resources_required
    });

    // Update resource availability
    for (const resourceId of requiredResources) {
      resourceAvailability.set(resourceId, endDay);
    }
  }

  return schedule;
}

/**
 * Initialize resource availability map
 */
function initializeResourceAvailability(
  availability: ResourceAvailability,
  resources: Resources
): void {
  // Crews
  for (let i = 0; i < resources.crew_rebar_count; i++) {
    availability.set(`crew_rebar_${i}`, 0);
  }
  for (let i = 0; i < resources.crew_formwork_count; i++) {
    availability.set(`crew_formwork_${i}`, 0);
  }
  for (let i = 0; i < resources.crew_concreting_count; i++) {
    availability.set(`crew_concreting_${i}`, 0);
  }

  // Equipment
  for (let i = 0; i < resources.formwork_kits_count; i++) {
    availability.set(`formwork_kit_${i}`, 0);
  }
  for (let i = 0; i < resources.pumps_count; i++) {
    availability.set(`pump_${i}`, 0);
  }
}

/**
 * Get required resource IDs for a task
 */
function getRequiredResources(task: Task): string[] {
  const resources: string[] = [];

  // Map task type to resource types
  switch (task.type) {
    case 'rebar':
      // Requires rebar crew
      resources.push('crew_rebar_0'); // Use first available crew (simplified)
      break;

    case 'formwork_in':
    case 'formwork_out':
      // Requires formwork crew + kit
      resources.push('crew_formwork_0');
      resources.push('formwork_kit_0'); // Kit assigned in resources_required
      break;

    case 'pour':
      // Requires concreting crew + pump
      resources.push('crew_concreting_0');
      resources.push('pump_0');
      break;

    case 'wait_strip':
      // Requires kit (occupied during wait)
      resources.push('formwork_kit_0');
      break;

    case 'move_clean':
      // Requires kit
      resources.push('formwork_kit_0');
      break;

    default:
      break;
  }

  // Add any additional resources from resources_required
  if (task.resources_required) {
    const reqKeys = Object.keys(task.resources_required);
    resources.push(...reqKeys);
  }

  return resources;
}

/**
 * Topological sort (by predecessors)
 * Simple implementation using DFS
 */
function topologicalSort(tasks: Task[]): Task[] {
  const sorted: Task[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  // Build adjacency map (task_id → predecessors)
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // DFS visit
  function visit(taskId: string): void {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      throw new Error(`Circular dependency detected for task ${taskId}`);
    }

    visiting.add(taskId);

    const task = taskMap.get(taskId);
    if (task && task.predecessors) {
      for (const predId of task.predecessors) {
        visit(predId);
      }
    }

    visiting.delete(taskId);
    visited.add(taskId);

    if (task) {
      sorted.push(task);
    }
  }

  // Visit all tasks
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      visit(task.id);
    }
  }

  return sorted;
}

/**
 * Find critical path (longest path from start to end)
 *
 * @param schedule - Schedule with task timings
 * @param tasks - Original tasks with predecessors
 * @returns Array of task IDs on critical path
 */
export function findCriticalPath(schedule: ScheduleEntry[], tasks: Task[]): string[] {
  if (schedule.length === 0) return [];

  // Find project end (latest end_day)
  const projectEnd = Math.max(...schedule.map(s => s.end_day));

  // Build task map
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // Build schedule map
  const scheduleMap = new Map<string, ScheduleEntry>();
  for (const entry of schedule) {
    scheduleMap.set(entry.task_id, entry);
  }

  // Calculate slack (float) for each task
  const slack = new Map<string, number>();

  // Forward pass (already done in schedule)
  // Backward pass: calculate late start/late finish
  for (const entry of schedule) {
    const task = taskMap.get(entry.task_id);
    if (!task) continue;

    // If no successors → late finish = project end
    const successors = tasks.filter(t =>
      t.predecessors && t.predecessors.includes(entry.task_id)
    );

    let lateFinish = projectEnd;
    if (successors.length > 0) {
      // Late finish = min(late start of successors)
      lateFinish = Math.min(
        ...successors.map(succ => {
          const succEntry = scheduleMap.get(succ.id);
          return succEntry ? succEntry.start_day : projectEnd;
        })
      );
    }

    const lateStart = lateFinish - task.duration_days;
    const taskSlack = lateStart - entry.start_day;
    slack.set(entry.task_id, taskSlack);
  }

  // Critical path = tasks with slack ≈ 0
  const criticalTasks = schedule
    .filter(entry => {
      const taskSlack = slack.get(entry.task_id) || 0;
      return Math.abs(taskSlack) < 0.01; // Floating point tolerance
    })
    .map(entry => entry.task_id);

  return criticalTasks;
}

/**
 * Calculate project duration (makespan)
 */
export function calculateProjectDuration(schedule: ScheduleEntry[]): number {
  if (schedule.length === 0) return 0;
  return Math.max(...schedule.map(s => s.end_day));
}

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

export function getScheduleSummary(
  schedule: ScheduleEntry[],
  tasks: Task[],
  resources: Resources
): ScheduleSummary {
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // Total duration
  const total_duration_days = calculateProjectDuration(schedule);

  // Total labor hours and cost
  let total_labor_hours = 0;
  let total_cost = 0;
  for (const entry of schedule) {
    const task = taskMap.get(entry.task_id);
    if (task) {
      total_labor_hours += task.labor_hours;
      total_cost += task.cost_labor + (task.cost_machine || 0) + (task.cost_rental || 0);
    }
  }

  // Critical path
  const critical_path_tasks = findCriticalPath(schedule, tasks);

  // Resource utilization (placeholder for now)
  const resource_utilization = new Map<string, number>();

  return {
    total_duration_days,
    total_labor_hours,
    total_cost,
    critical_path_tasks,
    resource_utilization
  };
}
