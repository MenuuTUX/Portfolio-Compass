import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useAddStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticker: string) => {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) throw new Error('Failed to add stock');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate the query to trigger a true background refresh
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
};
