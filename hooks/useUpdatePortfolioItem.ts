import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PortfolioItem } from '@/types';
import { PortfolioItemSchema } from '@/schemas/assetSchema';
import { z } from 'zod';

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

            const data = await response.json();

            try {
                return PortfolioItemSchema.parse(data);
            } catch (error) {
                 if (error instanceof z.ZodError) {
                    console.warn('API response validation failed for update item:', error.issues);
                } else {
                    console.warn('API response validation failed for update item:', error);
                }
                return data as PortfolioItem;
            }
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
