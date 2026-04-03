/**
 * useProjects — React Query hook for project list.
 *
 * Single source of truth: data lives only in React Query cache.
 * No duplicate state in context.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bridgesAPI } from '../services/api';
import type { Bridge } from '@stavagent/monolit-shared';

const PROJECTS_KEY = ['projects'] as const;

export function useProjects() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => bridgesAPI.getAll(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });

  const createMutation = useMutation({
    mutationFn: (params: {
      project_id?: string;
      bridge_id?: string;
      project_name?: string;
      object_name?: string;
      description?: string;
    }) => bridgesAPI.create(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Bridge> }) =>
      bridgesAPI.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bridgesAPI.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectName: string) => bridgesAPI.deleteByProjectName(projectName),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });

  const renameProjectMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      bridgesAPI.renameProject(oldName, newName),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bridgesAPI.bulkDelete(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'completed' | 'archived' }) =>
      bridgesAPI.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    createProject: createMutation.mutateAsync,
    updateProject: updateMutation.mutateAsync,
    deleteObject: deleteMutation.mutateAsync,
    deleteProject: deleteProjectMutation.mutateAsync,
    renameProject: renameProjectMutation.mutateAsync,
    bulkDelete: bulkDeleteMutation.mutateAsync,
    updateStatus: statusMutation.mutateAsync,

    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      deleteProjectMutation.isPending ||
      renameProjectMutation.isPending ||
      bulkDeleteMutation.isPending ||
      statusMutation.isPending,
  };
}

export { PROJECTS_KEY };
