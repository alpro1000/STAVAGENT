import React from 'react';
import { useProjects } from '../hooks/useProject';
import Header from '../components/layout/Header';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function ProjectsPage() {
  const { projectsQuery, selectProject } = useProjects();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header onNewProject={() => console.log('New project')} />
      <div className="flex-1 overflow-y-auto p-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Tvoje projekty</h2>
        {projectsQuery.isLoading ? (
          <LoadingSpinner text="Načítám projekty" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectsQuery.data?.map((project) => (
              <div
                key={project.id ?? project.project_id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:border-blue-400 cursor-pointer transition"
                onClick={() => selectProject(project)}
              >
                <h3 className="font-semibold text-gray-800">{project.name}</h3>
                {project.positions_total && (
                  <p className="text-sm text-gray-500">{project.positions_total} pozic</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
