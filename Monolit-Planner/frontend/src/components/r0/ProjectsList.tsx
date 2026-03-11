/**
 * Projects List Component
 * Display R0 projects in sidebar
 */

import React from 'react';

interface Project {
  id: string;
  name: string;
  elements_count?: number;
  captures_count?: number;
  updated_at: string;
}

interface ProjectsListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ProjectsList({ projects, selectedId, onSelect }: ProjectsListProps) {
  if (projects.length === 0) {
    return (
      <div className="r0-projects-empty">
        <p>Žádné projekty</p>
      </div>
    );
  }

  return (
    <ul className="r0-projects-list">
      {projects.map((project) => (
        <li
          key={project.id}
          className={`r0-project-item ${selectedId === project.id ? 'selected' : ''}`}
          onClick={() => onSelect(project.id)}
        >
          <div className="r0-project-name">{project.name}</div>
          <div className="r0-project-info">
            <span>{project.elements_count || 0} elementů</span>
            <span>{project.captures_count || 0} taktů</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
