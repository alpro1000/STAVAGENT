import Link from 'next/link';
import { Project } from '@/lib/types';
import { STATUS_CONFIG, WORKFLOW_CONFIG, ISSUE_STATUS_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const statusConfig = STATUS_CONFIG[project.status];
  const workflowConfig = WORKFLOW_CONFIG[project.workflow];
  const issuesCount = project.issuesCount || { green: 0, amber: 0, red: 0 };

  return (
    <div className="group relative flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-gray-300">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary">
              {project.name}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                {workflowConfig.icon} {workflowConfig.label}
              </span>
              <span>•</span>
              <span>
                {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            <span>{statusConfig.icon}</span>
            <span>{statusConfig.label}</span>
          </span>
        </div>
      </div>

      {/* Progress Bar (if processing) */}
      {project.status === 'processing' && project.progress !== undefined && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Processing</span>
            <span>{project.progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Issues Count (Traffic Light) */}
      <div className="mb-4 flex items-center gap-4">
        {/* Green */}
        <div className="flex items-center gap-2">
          <span className="text-xl">{ISSUE_STATUS_CONFIG.green.icon}</span>
          <span className="text-2xl font-bold text-green-600">
            {issuesCount.green}
          </span>
        </div>

        {/* Amber */}
        <div className="flex items-center gap-2">
          <span className="text-xl">{ISSUE_STATUS_CONFIG.amber.icon}</span>
          <span className="text-2xl font-bold text-yellow-600">
            {issuesCount.amber}
          </span>
        </div>

        {/* Red */}
        <div className="flex items-center gap-2">
          <span className="text-xl">{ISSUE_STATUS_CONFIG.red.icon}</span>
          <span className="text-2xl font-bold text-red-600">
            {issuesCount.red}
          </span>
        </div>
      </div>

      {/* Positions Count */}
      {project.positionsCount !== undefined && (
        <div className="mb-4 text-sm text-gray-600">
          <span className="font-medium">{project.positionsCount}</span> positions
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2">
        <Link
          href={`/projects/${project.id}`}
          className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Open Project
        </Link>

        <button
          className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            // TODO: Export functionality
            console.log('Export project:', project.id);
          }}
        >
          Export
        </button>
      </div>
    </div>
  );
}
