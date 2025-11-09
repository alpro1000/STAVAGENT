/**
 * useConfig hook - Manage project configuration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configAPI } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { ProjectConfig } from '@monolit/shared';

export function useConfig() {
  const { setDaysPerMonth } = useAppContext();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      return await configAPI.get();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - no refetch unless stale
    refetchOnMount: false, // CRITICAL: Never refetch on mount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    gcTime: 10 * 60 * 1000 // Keep in cache for 10 minutes before garbage collection
  });

  // Update context AFTER query succeeds, not inside queryFn
  if (query.data) {
    setDaysPerMonth(query.data.days_per_month_mode);
  }

  const updateMutation = useMutation({
    mutationFn: async (config: Partial<ProjectConfig>) => {
      return await configAPI.update(config);
    },
    onSuccess: (data) => {
      if (data.config?.days_per_month_mode) {
        setDaysPerMonth(data.config.days_per_month_mode);
      }
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    }
  });

  return {
    ...query,
    updateConfig: updateMutation.mutate,
    isUpdating: updateMutation.isPending
  };
}
