import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PortfolioItem } from '@/types';

interface UpdatePortfolioItemParams {
    ticker: string;
    weight?: number;
    shares?: number;
}

export function useUpdatePortfolioItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ ticker, weight, shares }: UpdatePortfolioItemParams) => {
            const response = await fetch('/api/portfolio', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ticker, weight, shares }),
            });

            if (!response.ok) {
                throw new Error('Failed to update portfolio item');
            }

            return response.json();
        },
        onMutate: async ({ ticker, weight, shares }) => {
            await queryClient.cancelQueries({ queryKey: ['portfolio'] });
            const previousPortfolio = queryClient.getQueryData<PortfolioItem[]>(['portfolio']);

            if (previousPortfolio) {
                queryClient.setQueryData<PortfolioItem[]>(['portfolio'], (old) => {
                    if (!old) return [];
                    return old.map((item) => {
                        if (item.ticker === ticker) {
                            return {
                                ...item,
                                ...(weight !== undefined && { weight }),
                                ...(shares !== undefined && { shares }),
                            };
                        }
                        return item;
                    });
                });
            }

            return { previousPortfolio };
        },
        onError: (err, newTodo, context) => {
            if (context?.previousPortfolio) {
                queryClient.setQueryData(['portfolio'], context.previousPortfolio);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['portfolio'] });
        },
    });
}
