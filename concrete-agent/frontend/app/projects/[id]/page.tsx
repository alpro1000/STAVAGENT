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
import { CostTrendChart } from '@/components/charts/CostTrendChart';
import { AssistantChat } from '@/components/assistant/AssistantChat';
import { ArtifactWorkspace } from '@/components/artifacts/ArtifactWorkspace';
import { BudgetAnalysis } from '@/components/dashboard/BudgetAnalysis';
import { TopIssues, Issue } from '@/components/dashboard/TopIssues';
import { ProjectTimeline, TimelineEvent } from '@/components/dashboard/ProjectTimeline';
import { DashboardExport } from '@/components/dashboard/DashboardExport';
import { KBSearch } from '@/components/kb/KBSearch';
import { KBResults } from '@/components/kb/KBResults';
import { KBDetail } from '@/components/kb/KBDetail';
import { KBRelatedItems } from '@/components/kb/KBRelatedItems';
import { KBStatisticsView } from '@/components/kb/KBStatistics';
import {
  KBItem,
  KBSearchFilters,
  KBViewMode,
} from '@/lib/kb-types';
import { mockKBItems, mockKBStatistics } from '@/lib/mock-kb-data';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Knowledge Base state
  const [kbItems, setKbItems] = useState<KBItem[]>(mockKBItems);
  const [filteredKbItems, setFilteredKbItems] = useState<KBItem[]>(mockKBItems);
  const [kbViewMode, setKbViewMode] = useState<KBViewMode>('list');
  const [selectedKbItem, setSelectedKbItem] = useState<KBItem | null>(null);
  const [showKbStats, setShowKbStats] = useState(false);

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

  // Knowledge Base handlers
  const handleKbSearch = (filters: KBSearchFilters) => {
    let filtered = [...kbItems];

    // Filter by query
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          item.standardCode?.toLowerCase().includes(query)
      );
    }

    // Filter by categories
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter((item) => filters.categories!.includes(item.category));
    }

    // Filter by languages
    if (filters.languages && filters.languages.length > 0) {
      filtered = filtered.filter((item) => filters.languages!.includes(item.language));
    }

    // Filter by standard types
    if (filters.standardTypes && filters.standardTypes.length > 0) {
      filtered = filtered.filter(
        (item) => item.standardType && filters.standardTypes!.includes(item.standardType)
      );
    }

    setFilteredKbItems(filtered);
  };

  const handleKbReset = () => {
    setFilteredKbItems(kbItems);
  };

  const handleKbItemClick = (item: KBItem) => {
    // Increment view count
    const updatedItems = kbItems.map((i) =>
      i.id === item.id ? { ...i, views: i.views + 1 } : i
    );
    setKbItems(updatedItems);
    setFilteredKbItems(updatedItems);

    // Show detail
    setSelectedKbItem(item);
  };

  const handleKbDetailClose = () => {
    setSelectedKbItem(null);
  };

  const handleKbRelatedClick = (itemId: string) => {
    // Find and show related items
    const item = kbItems.find((i) => i.id === itemId);
    if (item) {
      handleKbItemClick(item);
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

              {/* Budget Analysis */}
              <BudgetAnalysis
                original={230100}
                afterAudit={185500}
                breakdown={{
                  overpriced: { count: 8, amount: 52000 },
                  missing: { count: 3, amount: 12400 },
                  optimized: { count: 15, amount: 32200 },
                }}
              />

              {/* Cost Trend Chart */}
              <CostTrendChart
                data={[
                  { date: 'Week 1', original: 50000, afterAudit: 48000, savings: 2000 },
                  { date: 'Week 2', original: 80000, afterAudit: 75000, savings: 5000 },
                  { date: 'Week 3', original: 120000, afterAudit: 110000, savings: 10000 },
                  { date: 'Week 4', original: 180000, afterAudit: 160000, savings: 20000 },
                  { date: 'Week 5', original: 230100, afterAudit: 185500, savings: 44600 },
                ]}
              />

              {/* Two Column Layout: Top Issues + Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Issues */}
                <TopIssues
                  issues={[
                    {
                      id: '1',
                      type: 'red',
                      category: 'price',
                      description: 'Reinforcement steel price 35% above market average',
                      impact: 'high',
                      positionCode: '121151113',
                      positionName: 'Concrete C30/37',
                      recommendation: 'Review supplier pricing. Current: 18 Kč/kg, Market avg: 13 Kč/kg. Potential savings: 16,000 Kč',
                    },
                    {
                      id: '2',
                      type: 'amber',
                      category: 'standards',
                      description: 'Missing ČSN 73 1201 reference for load calculation',
                      impact: 'medium',
                      positionCode: '121151114',
                      positionName: 'Foundation formwork',
                      recommendation: 'Add standards citation. Verify load-bearing capacity calculation meets ČSN requirements',
                    },
                    {
                      id: '3',
                      type: 'red',
                      category: 'quantity',
                      description: 'Quantity mismatch between drawings and estimate',
                      impact: 'high',
                      positionCode: '121151115',
                      positionName: 'Excavation',
                      recommendation: 'Recalculate volume. Drawing shows 52 m³, estimate shows 42 m³. Verify with GPT-4 Vision analysis',
                    },
                  ]}
                />

                {/* Project Timeline */}
                <ProjectTimeline
                  events={[
                    {
                      id: '1',
                      type: 'upload',
                      title: 'Project Created',
                      description: 'Uploaded 3 files (vykaz_vymer.xlsx, foundation.pdf)',
                      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
                      user: 'Admin User',
                    },
                    {
                      id: '2',
                      type: 'parse',
                      title: 'Files Parsed',
                      description: 'Successfully parsed 53 positions from Excel',
                      timestamp: new Date(Date.now() - 7000000),
                      metadata: { positions: 53, workflow: 'A' },
                    },
                    {
                      id: '3',
                      type: 'validate',
                      title: 'Validation Complete',
                      description: 'All positions validated against KROS database',
                      timestamp: new Date(Date.now() - 6800000),
                    },
                    {
                      id: '4',
                      type: 'enrich',
                      title: 'Enrichment Complete',
                      description: 'Added price data and standards references',
                      timestamp: new Date(Date.now() - 6600000),
                      metadata: { matched: 48, partial: 5 },
                    },
                    {
                      id: '5',
                      type: 'audit',
                      title: 'AI Audit Complete',
                      description: 'Multi-role audit finished: 42 OK, 8 warnings, 3 errors',
                      timestamp: new Date(Date.now() - 6400000),
                      metadata: { green: 42, amber: 8, red: 3 },
                    },
                    {
                      id: '6',
                      type: 'chat',
                      title: 'Assistant Consulted',
                      description: 'User asked: "Calculate concrete volume for foundation"',
                      timestamp: new Date(Date.now() - 3600000),
                      user: 'Admin User',
                    },
                  ]}
                />
              </div>

              {/* Export Dashboard */}
              <DashboardExport projectName={project.name} projectId={projectId} />
            </div>
          </TabsContent>

          {/* Assistant Tab */}
          <TabsContent value="assistant">
            <div className="h-[calc(100vh-300px)] min-h-[600px]">
              <AssistantChat
                projectId={projectId}
                context={{
                  projectId: projectId,
                  projectName: project.name,
                  workflow: project.workflow,
                  metadata: {
                    status: project.status,
                    progress: project.progress,
                    positionsCount: project.positionsCount,
                    issuesCount: project.issuesCount,
                  },
                }}
              />
            </div>
          </TabsContent>

          {/* Artifacts Tab */}
          <TabsContent value="artifacts">
            <div className="h-[calc(100vh-300px)] min-h-[600px]">
              <ArtifactWorkspace projectId={projectId} />
            </div>
          </TabsContent>

          {/* Library Tab - Knowledge Base */}
          <TabsContent value="library">
            <div className="space-y-6">
              {/* KB Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">📚 Knowledge Base</h2>
                  <p className="text-gray-600 mt-1">
                    Vyhledejte v databázi norem, ceníků a technických informací
                  </p>
                </div>
                <button
                  onClick={() => setShowKbStats(!showKbStats)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    showKbStats
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {showKbStats ? '📊 Zobrazit vyhledávání' : '📊 Zobrazit statistiky'}
                </button>
              </div>

              {showKbStats ? (
                /* Statistics View */
                <KBStatisticsView
                  statistics={mockKBStatistics}
                  onItemClick={handleKbRelatedClick}
                />
              ) : (
                <>
                  {/* Search */}
                  <KBSearch onSearch={handleKbSearch} onReset={handleKbReset} />

                  {/* Results */}
                  <KBResults
                    items={filteredKbItems}
                    viewMode={kbViewMode}
                    onViewModeChange={setKbViewMode}
                    onItemClick={handleKbItemClick}
                    total={filteredKbItems.length}
                    page={1}
                    pageSize={filteredKbItems.length}
                  />

                  {/* Related Items (shown when item has related) */}
                  {selectedKbItem?.relatedItems &&
                    selectedKbItem.relatedItems.length > 0 && (
                      <KBRelatedItems
                        items={kbItems.filter((item) =>
                          selectedKbItem.relatedItems?.includes(item.id)
                        )}
                        onItemClick={handleKbItemClick}
                      />
                    )}
                </>
              )}

              {/* Detail Modal */}
              {selectedKbItem && (
                <KBDetail
                  item={selectedKbItem}
                  onClose={handleKbDetailClose}
                  onRelatedClick={handleKbRelatedClick}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
