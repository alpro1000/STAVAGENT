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
      const config = await configAPI.get();
      setDaysPerMonth(config.days_per_month_mode);
      return config;
    }
  });

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
