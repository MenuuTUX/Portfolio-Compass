import { useQuery } from '@tanstack/react-query';
import { Portfolio } from '@/types';

export const usePortfolio = () => {
  return useQuery<Portfolio>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio');
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      return res.json();
    },
    staleTime: 5000, // Keep data fresh for 5 seconds to prevent immediate refetch on interaction
    initialData: [], // Provide initial data to prevent hydration mismatch and loading states
  });
};
