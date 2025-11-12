/**
 * useExports hook - Manage export history and saved files
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportAPI } from '../services/api';

export interface ExportItem {
  filename: string;
  bridge_id: string;
  timestamp: number;
  created_at: string;
  size: number; // KB
}

export function useExports() {
  const queryClient = useQueryClient();

  // Fetch list of saved exports
  const query = useQuery({
    queryKey: ['exports'],
    queryFn: async () => {
      return await exportAPI.getExportsList();
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes - same as useBridges
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false, // Don't refetch when reconnecting
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    gcTime: 30 * 60 * 1000 // Keep in cache for 30 minutes before garbage collection
  });

  // Save XLSX to server
  const saveMutation = useMutation({
    mutationFn: async (bridgeId: string) => {
      return await exportAPI.saveXLSX(bridgeId);
    },
    onSuccess: () => {
      // Invalidate and refetch exports list after saving
      queryClient.invalidateQueries({ queryKey: ['exports'] });
    }
  });

  // Download saved export
  const downloadMutation = useMutation({
    mutationFn: async (filename: string) => {
      const blob = await exportAPI.downloadExport(filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  });

  // Delete export
  const deleteMutation = useMutation({
    mutationFn: async (filename: string) => {
      return await exportAPI.deleteExport(filename);
    },
    onSuccess: () => {
      // Refetch exports list after deletion
      queryClient.invalidateQueries({ queryKey: ['exports'] });
    }
  });

  return {
    exports: (query.data as ExportItem[]) || [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,

    saveXLSX: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,

    downloadExport: downloadMutation.mutate,
    isDownloading: downloadMutation.isPending,

    deleteExport: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error
  };
}
