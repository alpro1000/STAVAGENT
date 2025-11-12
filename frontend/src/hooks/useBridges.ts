/**
 * useBridges hook - Fetch and manage bridges
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bridgesAPI } from '../services/api';
import { useAppContext } from '../context/AppContext';

export function useBridges() {
  const { setBridges } = useAppContext();

  const query = useQuery({
    queryKey: ['bridges'],
    queryFn: async () => {
      return await bridgesAPI.getAll();
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes - no refetch unless stale
    refetchOnMount: false, // CRITICAL: Never refetch on mount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch when reconnecting
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    gcTime: 30 * 60 * 1000 // Keep in cache for 30 minutes before garbage collection
  });

  // Update context when query.data changes
  // Use useEffect to prevent infinite render loops
  useEffect(() => {
    if (query.data) {
      setBridges(query.data);
    }
  }, [query.data, setBridges]);

  return query;
}
