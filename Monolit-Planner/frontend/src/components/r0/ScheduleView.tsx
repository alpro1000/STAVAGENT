/**
 * Schedule View Component
 * Display calculated schedule with Gantt-like visualization
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Task {
  id: string;
  capture_id: string;
  capture_name: string;
  element_name: string;
  type: string;
  sequence: number;
  description: string;
  duration_days: number;
  labor_hours: number;
  cost_labor: number;
  cost_machine: number;
  source_tag: string;
  confidence: number;
}

interface ScheduleEntry {
  task_id: string;
  start_day: number;
  end_day: number;
  is_critical?: boolean;
}

interface ScheduleSummary {
  total_duration_days: number;
  total_labor_hours: number;
  total_cost: number;
  critical_path_length: number;
}

interface ScheduleViewProps {
  projectId: string;
}

const TASK_COLORS: Record<string, string> = {
  rebar: '#ef4444',        // red
  formwork_in: '#f97316',  // orange
  pour: '#3b82f6',         // blue
  wait_strip: '#9ca3af',   // gray
  formwork_out: '#f59e0b', // amber
  move_clean: '#6b7280'    // gray
};

const TASK_LABELS: Record<string, string> = {
  rebar: 'Armování',
  formwork_in: 'Bednění',
  pour: 'Betonáž',
  wait_strip: 'Vytvrzování',
  formwork_out: 'Odbednění',
  move_clean: 'Přemístění'
};

export default function ScheduleView({ projectId }: ScheduleViewProps) {
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Fetch tasks
  const { data: tasksData, isLoading: loadingTasks } = useQuery({
    queryKey: ['r0-tasks', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/r0/tasks?project_id=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    enabled: !!projectId
  });

  // Calculate schedule mutation
  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/r0/schedule/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      if (!res.ok) throw new Error('Failed to calculate schedule');
      return res.json();
    }
  });

  const tasks: Task[] = tasksData?.tasks || [];

  const handleCalculate = () => {
    calculateMutation.mutate();
  };

  if (loadingTasks) {
    return <div className="r0-loading">Načítám úkoly...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="r0-empty-state">
        <h3>📅 Harmonogram</h3>
        <p>Žádné úkoly. Nejprve vygenerujte úkoly v záložce "Takty".</p>
      </div>
    );
  }

  const schedule = calculateMutation.data?.schedule as ScheduleEntry[] | undefined;
  const summary = calculateMutation.data?.summary as ScheduleSummary | undefined;
  const criticalPath = calculateMutation.data?.critical_path as string[] | undefined;

  // Calculate total project duration for scaling
  const maxDay = schedule ? Math.max(...schedule.map(s => s.end_day)) : 0;
  const dayWidth = maxDay > 0 ? Math.max(800 / maxDay, 20) : 20;

  // Group tasks by element
  const tasksByElement = tasks.reduce((acc, task) => {
    const key = task.element_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="r0-schedule">
      {/* Toolbar */}
      <div className="r0-toolbar">
        <button
          className="r0-btn r0-btn-primary"
          onClick={handleCalculate}
          disabled={calculateMutation.isPending}
        >
          {calculateMutation.isPending ? '⏳ Počítám...' : '📊 Vypočítat harmonogram'}
        </button>

        {summary && (
          <div className="r0-summary-cards">
            <div className="r0-summary-card">
              <span className="r0-summary-value">{summary.total_duration_days.toFixed(1)}</span>
              <span className="r0-summary-label">dní celkem</span>
            </div>
            <div className="r0-summary-card">
              <span className="r0-summary-value">{summary.total_labor_hours.toFixed(0)}</span>
              <span className="r0-summary-label">pracovních hodin</span>
            </div>
            <div className="r0-summary-card">
              <span className="r0-summary-value">{(summary.total_cost / 1000).toFixed(0)}k</span>
              <span className="r0-summary-label">CZK náklady</span>
            </div>
            <div className="r0-summary-card r0-summary-critical">
              <span className="r0-summary-value">{summary.critical_path_length}</span>
              <span className="r0-summary-label">kritických úkolů</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="r0-legend">
        {Object.entries(TASK_LABELS).map(([type, label]) => (
          <div key={type} className="r0-legend-item">
            <span
              className="r0-legend-color"
              style={{ backgroundColor: TASK_COLORS[type] }}
            />
            <span>{label}</span>
          </div>
        ))}
        <div className="r0-legend-item r0-legend-critical">
          <span className="r0-legend-color r0-legend-critical-color" />
          <span>Kritická cesta</span>
        </div>
      </div>

      {/* Gantt-like view */}
      {schedule ? (
        <div className="r0-gantt">
          {/* Timeline header */}
          <div className="r0-gantt-header">
            <div className="r0-gantt-label-col">Úkol</div>
            <div className="r0-gantt-timeline">
              {Array.from({ length: Math.ceil(maxDay) + 1 }, (_, i) => (
                <div
                  key={i}
                  className="r0-gantt-day-marker"
                  style={{ left: `${i * dayWidth}px` }}
                >
                  {i}
                </div>
              ))}
            </div>
          </div>

          {/* Tasks by element */}
          {Object.entries(tasksByElement).map(([elementName, elementTasks]) => (
            <div key={elementName} className="r0-gantt-group">
              <div className="r0-gantt-group-header">{elementName}</div>
              {elementTasks.map((task) => {
                const scheduleEntry = schedule.find(s => s.task_id === task.id);
                const isCritical = criticalPath?.includes(task.id);

                return (
                  <div key={task.id} className="r0-gantt-row">
                    <div className="r0-gantt-label-col">
                      <span className="r0-task-type">
                        {TASK_LABELS[task.type] || task.type}
                      </span>
                    </div>
                    <div className="r0-gantt-timeline">
                      {scheduleEntry && (
                        <div
                          className={`r0-gantt-bar ${isCritical ? 'critical' : ''}`}
                          style={{
                            left: `${scheduleEntry.start_day * dayWidth}px`,
                            width: `${(scheduleEntry.end_day - scheduleEntry.start_day) * dayWidth}px`,
                            backgroundColor: TASK_COLORS[task.type]
                          }}
                          onClick={() => setShowDetails(showDetails === task.id ? null : task.id)}
                          title={`${task.description}: ${task.duration_days.toFixed(2)} dní`}
                        >
                          {(scheduleEntry.end_day - scheduleEntry.start_day) * dayWidth > 50 && (
                            <span className="r0-gantt-bar-label">
                              {task.duration_days.toFixed(1)}d
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="r0-info-box">
          <h4>📊 Výpočet harmonogramu</h4>
          <p>
            Klikněte na "Vypočítat harmonogram" pro zobrazení Ganttova diagramu
            s kritickou cestou a časovou osou.
          </p>
          <p>
            <strong>Celkem úkolů:</strong> {tasks.length}
          </p>
        </div>
      )}

      {/* Tasks Table */}
      <div className="r0-tasks-table-section">
        <h4>📋 Seznam úkolů ({tasks.length})</h4>
        <table className="r0-table r0-table-compact">
          <thead>
            <tr>
              <th>Element</th>
              <th>Takt</th>
              <th>Typ</th>
              <th className="r0-num">Trvání (d)</th>
              <th className="r0-num">Práce (h)</th>
              <th className="r0-num">Náklady (CZK)</th>
              <th>Zdroj</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className={criticalPath?.includes(task.id) ? 'r0-critical-row' : ''}>
                <td>{task.element_name}</td>
                <td>{task.capture_name}</td>
                <td>
                  <span
                    className="r0-task-badge"
                    style={{ backgroundColor: TASK_COLORS[task.type] }}
                  >
                    {TASK_LABELS[task.type] || task.type}
                  </span>
                </td>
                <td className="r0-num">{task.duration_days.toFixed(2)}</td>
                <td className="r0-num">{task.labor_hours.toFixed(1)}</td>
                <td className="r0-num">{(task.cost_labor + task.cost_machine).toLocaleString('cs-CZ')}</td>
                <td>
                  <span className={`r0-source-tag ${task.source_tag.toLowerCase()}`}>
                    {task.source_tag}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
