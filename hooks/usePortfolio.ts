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
    initialData: [],
  });
};
