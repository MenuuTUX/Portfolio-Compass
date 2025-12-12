import { useQuery } from '@tanstack/react-query';
import { Portfolio } from '@/types';
import { PortfolioSchema } from '@/schemas/assetSchema';
import { z } from 'zod';

export const usePortfolio = () => {
  return useQuery<Portfolio>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio');
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      const data = await res.json();

      try {
        return PortfolioSchema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.warn('API response validation failed:', error.errors);
        } else {
            console.warn('API response validation failed:', error);
        }
        // Return data anyway to prevent app crash, or you could throw if strictness is required.
        // User asked to "log a warning", implying we might still proceed or at least return what we can.
        // However, if the data is malformed, using it might cause runtime errors elsewhere.
        // Returning it "as is" but casted (unsafe) is a typical soft-fail pattern.
        return data as Portfolio;
      }
    },
    staleTime: 5000, // Keep data fresh for 5 seconds to prevent immediate refetch on interaction
    initialData: [], // Provide initial data to prevent hydration mismatch and loading states
  });
};
