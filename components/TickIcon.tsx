
import React, { useState } from 'react';
import { getAssetIconUrl } from '@/lib/etf-providers';
import { motion } from 'framer-motion';

export const TickIcon = ({ ticker, x, y }: { ticker: string; x: number; y: number }) => {
    const [hasError, setHasError] = useState(false);

    // Logic: if it's "Other" or "Cash", no icon.
    // Otherwise try to get icon.
    // If error, show fallback circle with initial.

    if (ticker === 'Cash' || ticker === 'Other') return null;

    const iconUrl = getAssetIconUrl(ticker, ticker, 'STOCK');

    if (!iconUrl || hasError) {
        // Fallback: Circle with First Letter
        return (
            <g transform={`translate(${x - 80}, ${y - 10})`}>
                <circle cx={10} cy={10} r={10} fill="#333" />
                <text x={10} y={14} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="bold">
                    {ticker.substring(0, 1)}
                </text>
            </g>
        );
    }

    return (
        <foreignObject x={x - 80} y={y - 10} width={20} height={20}>
            {/* We use img tag here inside foreignObject because SVG <image> doesn't support onError well */}
            <img
                src={iconUrl}
                alt={ticker}
                className="w-full h-full rounded-full object-cover"
                onError={() => setHasError(true)}
            />
        </foreignObject>
    );
};
