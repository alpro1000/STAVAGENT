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
      const bridges = await bridgesAPI.getAll();
      setBridges(bridges);
      return bridges;
    },
    refetchOnMount: true
  });

  return query;
}
