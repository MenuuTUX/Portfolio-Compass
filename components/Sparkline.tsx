"use client";

import { memo } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/utils";

interface SparklineProps {
  data: { date: string; price: number }[];
  color: string;
  name?: string;
  /** Size classes for the wrapper. */
  className?: string;
}

function summarise(data: { price: number }[]) {
  if (data.length === 0) return null;
  let low = Infinity;
  let high = -Infinity;
  for (const point of data) {
    if (point.price < low) low = point.price;
    if (point.price > high) high = point.price;
  }
  return {
    first: data[0].price,
    last: data[data.length - 1].price,
    low,
    high,
    count: data.length,
  };
}

const Sparkline = memo(({ data, color, name, className }: SparklineProps) => {
  // One summary row for screen readers instead of one row per point.
  const summary = summarise(data);
  return (
    <div className={cn("h-8 w-20", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area
            type="linear"
            dataKey="price"
            stroke={color}
            fill="none"
            strokeWidth={1.25}
            strokeLinejoin="round"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Price History Sparkline{name ? ` for ${name}` : ""}</caption>
        <thead>
          <tr>
            <th scope="col">First</th>
            <th scope="col">Last</th>
            <th scope="col">Low</th>
            <th scope="col">High</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {summary && (
            <tr>
              <td>{formatCurrency(summary.first)}</td>
              <td>{formatCurrency(summary.last)}</td>
              <td>{formatCurrency(summary.low)}</td>
              <td>{formatCurrency(summary.high)}</td>
              <td>{summary.count}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});

Sparkline.displayName = "Sparkline";

export default Sparkline;
