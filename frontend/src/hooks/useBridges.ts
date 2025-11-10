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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - no refetch unless stale
    refetchOnMount: false, // CRITICAL: Never refetch on mount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    gcTime: 10 * 60 * 1000 // Keep in cache for 10 minutes before garbage collection
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
