/**
 * R0 Deterministic Core - Main Application
 *
 * UI for construction planning with deterministic calculators:
 * - Projects management
 * - Elements (slab, wall, beam, footing, column)
 * - Captures (takts) auto-generation
 * - Tasks generation and scheduling
 * - Cost breakdown with traceability
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ProjectsList from './ProjectsList';
import ElementsTable from './ElementsTable';
import CapturesPanel from './CapturesPanel';
import ScheduleView from './ScheduleView';
import '../../styles/r0.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface R0Project {
  id: string;
  name: string;
  shift_hours: number;
  time_utilization_k: number;
  days_per_month: number;
  elements_count?: number;
  captures_count?: number;
  created_at: string;
  updated_at: string;
}

type Tab = 'elements' | 'captures' | 'schedule' | 'cost';

export default function R0App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('elements');
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['r0-projects'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/r0/projects`);
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    }
  });

  // Fetch selected project details
  const { data: projectData, isLoading: loadingProject } = useQuery({
    queryKey: ['r0-project', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const res = await fetch(`${API_URL}/api/r0/projects/${selectedProjectId}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    },
    enabled: !!selectedProjectId
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_URL}/api/r0/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error('Failed to create project');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['r0-projects'] });
      setSelectedProjectId(data.project.id);
    }
  });

  // Generate tasks mutation
  const generateTasksMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`${API_URL}/api/r0/tasks/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      if (!res.ok) throw new Error('Failed to generate tasks');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r0-tasks', selectedProjectId] });
      setActiveTab('schedule');
    }
  });

  const projects: R0Project[] = projectsData?.projects || [];
  const selectedProject = projectData?.project;
  const elements = projectData?.elements || [];

  const handleCreateProject = () => {
    const name = prompt('Název nového projektu:');
    if (name) {
      createProjectMutation.mutate(name);
    }
  };

  const handleGenerateTasks = () => {
    if (selectedProjectId) {
      generateTasksMutation.mutate(selectedProjectId);
    }
  };

  return (
    <div className="r0-app">
      {/* Header */}
      <header className="r0-header">
        <div className="r0-header-left">
          <a href="/" className="r0-back-link">← Zpět na Monolit</a>
          <h1 className="r0-title">
            <span className="r0-icon">🧮</span>
            R0 Deterministické jádro
          </h1>
        </div>
        <div className="r0-header-right">
          <span className="r0-badge">BETA</span>
        </div>
      </header>

      <div className="r0-layout">
        {/* Sidebar - Projects */}
        <aside className="r0-sidebar">
          <div className="r0-sidebar-header">
            <h2>Projekty</h2>
            <button
              className="r0-btn r0-btn-primary"
              onClick={handleCreateProject}
              disabled={createProjectMutation.isPending}
            >
              + Nový
            </button>
          </div>

          {loadingProjects ? (
            <div className="r0-loading">Načítám...</div>
          ) : (
            <ProjectsList
              projects={projects}
              selectedId={selectedProjectId}
              onSelect={setSelectedProjectId}
            />
          )}
        </aside>

        {/* Main Content */}
        <main className="r0-main">
          {!selectedProjectId ? (
            <div className="r0-empty-state">
              <div className="r0-empty-icon">📋</div>
              <h2>Vyberte nebo vytvořte projekt</h2>
              <p>Pro začátek vyberte projekt ze seznamu nebo vytvořte nový.</p>
              <button className="r0-btn r0-btn-primary" onClick={handleCreateProject}>
                + Nový projekt
              </button>
            </div>
          ) : loadingProject ? (
            <div className="r0-loading">Načítám projekt...</div>
          ) : (
            <>
              {/* Project Header */}
              <div className="r0-project-header">
                <h2>{selectedProject?.name}</h2>
                <div className="r0-project-meta">
                  <span>Směna: {selectedProject?.shift_hours}h</span>
                  <span>k: {selectedProject?.time_utilization_k}</span>
                  <span>Dní/měsíc: {selectedProject?.days_per_month}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="r0-tabs">
                <button
                  className={`r0-tab ${activeTab === 'elements' ? 'active' : ''}`}
                  onClick={() => setActiveTab('elements')}
                >
                  🧱 Elementy ({elements.length})
                </button>
                <button
                  className={`r0-tab ${activeTab === 'captures' ? 'active' : ''}`}
                  onClick={() => setActiveTab('captures')}
                >
                  📐 Takty
                </button>
                <button
                  className={`r0-tab ${activeTab === 'schedule' ? 'active' : ''}`}
                  onClick={() => setActiveTab('schedule')}
                >
                  📅 Harmonogram
                </button>
                <button
                  className={`r0-tab ${activeTab === 'cost' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cost')}
                >
                  💰 Náklady
                </button>
              </div>

              {/* Tab Content */}
              <div className="r0-content">
                {activeTab === 'elements' && (
                  <ElementsTable
                    projectId={selectedProjectId}
                    elements={elements}
                  />
                )}
                {activeTab === 'captures' && (
                  <CapturesPanel
                    projectId={selectedProjectId}
                    elements={elements}
                    onGenerateTasks={handleGenerateTasks}
                    isGenerating={generateTasksMutation.isPending}
                  />
                )}
                {activeTab === 'schedule' && (
                  <ScheduleView projectId={selectedProjectId} />
                )}
                {activeTab === 'cost' && (
                  <div className="r0-coming-soon">
                    <h3>💰 Rozpis nákladů</h3>
                    <p>S plnou traceabilitou - připravujeme</p>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
