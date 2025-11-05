'use client';

import { useEffect, useState } from 'react';
import { Project } from '@/lib/types';
import { getProjects } from '@/lib/api';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const { projects: fetchedProjects } = await getProjects();
      setProjects(fetchedProjects);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              🏗️ Concrete Agent
            </h1>
            <button
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => setCreateModalOpen(true)}
            >
              + New Project
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Projects</h2>
          <p className="mt-1 text-gray-600">
            Manage your construction projects and audit results
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-gray-600">Loading projects...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start">
              <span className="text-2xl">❌</span>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={loadProjects}
                  className="mt-2 text-sm font-medium text-red-800 hover:text-red-900 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl">📁</span>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No projects yet
            </h3>
            <p className="mt-2 text-gray-600">
              Get started by creating your first project
            </p>
            <button
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => setCreateModalOpen(true)}
            >
              + Create Project
            </button>
          </div>
        )}

        {/* Projects Grid */}
        {!loading && !error && projects.length > 0 && (
          <div>
            {/* Stats Summary */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {projects.length}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-600">Completed</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {projects.filter(p => p.status === 'completed').length}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-600">Processing</p>
                <p className="mt-1 text-2xl font-bold text-blue-600">
                  {projects.filter(p => p.status === 'processing').length}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm text-gray-600">Failed</p>
                <p className="mt-1 text-2xl font-bold text-red-600">
                  {projects.filter(p => p.status === 'failed').length}
                </p>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={loadProjects}
      />
    </div>
  );
}
