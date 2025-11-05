'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PROJECT_STATUS, WORKFLOW_TYPES } from '@/lib/constants';

interface ProjectsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedWorkflow: string;
  onWorkflowChange: (workflow: string) => void;
  onReset: () => void;
}

export function ProjectsFilters({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedWorkflow,
  onWorkflowChange,
  onReset,
}: ProjectsFiltersProps) {
  const hasActiveFilters =
    searchQuery || selectedStatus !== 'all' || selectedWorkflow !== 'all';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            Status:
          </span>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">All</option>
            <option value={PROJECT_STATUS.PROCESSING}>Processing</option>
            <option value={PROJECT_STATUS.COMPLETED}>Completed</option>
            <option value={PROJECT_STATUS.FAILED}>Failed</option>
            <option value={PROJECT_STATUS.PENDING}>Pending</option>
          </select>
        </div>

        {/* Workflow Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            Workflow:
          </span>
          <select
            value={selectedWorkflow}
            onChange={(e) => onWorkflowChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">All</option>
            <option value={WORKFLOW_TYPES.A}>Workflow A</option>
            <option value={WORKFLOW_TYPES.B}>Workflow B</option>
          </select>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button variant="outline" onClick={onReset} className="whitespace-nowrap">
            Reset Filters
          </Button>
        )}
      </div>
    </div>
  );
}
