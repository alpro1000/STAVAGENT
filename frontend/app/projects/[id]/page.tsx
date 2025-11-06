'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject } from '@/lib/api';
import { STATUS_CONFIG, WORKFLOW_CONFIG } from '@/lib/constants';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { IssuesPieChart } from '@/components/charts/IssuesPieChart';
import { StatusBarChart } from '@/components/charts/StatusBarChart';
import { ProgressAreaChart } from '@/components/charts/ProgressAreaChart';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProject(projectId);
      setProject(data);
    } catch (err: any) {
      console.error('Failed to load project:', err);
      setError(err?.response?.data?.detail || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <span className="text-6xl">❌</span>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Project not found
          </h2>
          <p className="mt-2 text-gray-600">{error || 'Project does not exist'}</p>
          <button
            onClick={() => router.push('/projects')}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[project.status];
  const workflowConfig = WORKFLOW_CONFIG[project.workflow];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/projects')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Projects
              </button>
              <span className="text-gray-400">/</span>
              <h1 className="text-lg font-semibold text-gray-900 truncate max-w-md">
                {project.name}
              </h1>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center gap-3">
              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                <span>{statusConfig.icon}</span>
                <span>{statusConfig.label}</span>
              </span>

              {/* Workflow Badge */}
              <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                <span>{workflowConfig.icon}</span>
                <span>{workflowConfig.label}</span>
              </span>

              {/* Export Button */}
              <button className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="dashboard" className="w-full">
          {/* Tabs Navigation */}
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">
              📊 Dashboard
            </TabsTrigger>
            <TabsTrigger value="assistant">
              💬 Assistant
            </TabsTrigger>
            <TabsTrigger value="artifacts">
              📐 Artifacts
            </TabsTrigger>
            <TabsTrigger value="library">
              📚 Library
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="space-y-6">
              {/* Health Metrics */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🟢</span>
                    <p className="text-sm font-medium text-gray-600">OK</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">
                    {project.issuesCount?.green || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {project.issuesCount?.green && project.positionsCount
                      ? `${Math.round((project.issuesCount.green / project.positionsCount) * 100)}%`
                      : '0%'}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🟡</span>
                    <p className="text-sm font-medium text-gray-600">Warnings</p>
                  </div>
                  <p className="text-3xl font-bold text-yellow-600">
                    {project.issuesCount?.amber || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {project.issuesCount?.amber && project.positionsCount
                      ? `${Math.round((project.issuesCount.amber / project.positionsCount) * 100)}%`
                      : '0%'}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🔴</span>
                    <p className="text-sm font-medium text-gray-600">Errors</p>
                  </div>
                  <p className="text-3xl font-bold text-red-600">
                    {project.issuesCount?.red || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {project.issuesCount?.red && project.positionsCount
                      ? `${Math.round((project.issuesCount.red / project.positionsCount) * 100)}%`
                      : '0%'}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📊</span>
                    <p className="text-sm font-medium text-gray-600">Total</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">
                    {project.positionsCount || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Positions</p>
                </div>
              </div>

              {/* Project Info */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Project Information
                </h3>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Project ID</dt>
                    <dd className="mt-1 text-sm text-gray-900">{project.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(project.createdAt).toLocaleString()}
                    </dd>
                  </div>
                  {project.progress !== undefined && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Progress</dt>
                      <dd className="mt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {project.progress}%
                          </span>
                        </div>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Charts Section */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Analytics & Charts
                </h3>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Pie Chart */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Issues Distribution
                    </h4>
                    <IssuesPieChart
                      data={project.issuesCount || { green: 0, amber: 0, red: 0 }}
                    />
                  </div>

                  {/* Bar Chart */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Issues Breakdown
                    </h4>
                    <StatusBarChart
                      data={project.issuesCount || { green: 0, amber: 0, red: 0 }}
                    />
                  </div>
                </div>

                {/* Area Chart - Full Width */}
                {project.progress !== undefined && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Progress Over Time
                    </h4>
                    <ProgressAreaChart progress={project.progress} />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Assistant Tab */}
          <TabsContent value="assistant">
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <span className="text-6xl">💬</span>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Assistant Chat
              </h3>
              <p className="mt-2 text-gray-600">
                AI assistant chat will be added here (Phase 3 Week 3)
              </p>
            </div>
          </TabsContent>

          {/* Artifacts Tab */}
          <TabsContent value="artifacts">
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <span className="text-6xl">📐</span>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Artifact Workspace
              </h3>
              <p className="mt-2 text-gray-600">
                Editable artifacts will be added here (Phase 3 Week 4)
              </p>
            </div>
          </TabsContent>

          {/* Library Tab */}
          <TabsContent value="library">
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <span className="text-6xl">📚</span>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Knowledge Base
              </h3>
              <p className="mt-2 text-gray-600">
                Project-specific standards library will be added here (Phase 3 Week 6)
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
