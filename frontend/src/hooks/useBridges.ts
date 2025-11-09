/**
 * useBridges hook - Fetch and manage bridges
 */

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
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnMount: false // Prevent infinite refetch loop
  });

  // Update context AFTER query succeeds, not inside queryFn
  // This prevents setState race conditions
  if (query.data) {
    setBridges(query.data);
  }

  return query;
}
