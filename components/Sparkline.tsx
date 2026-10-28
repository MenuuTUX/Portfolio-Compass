"use client";

import { memo } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { cn, formatCurrency } from "@/lib/utils";

interface SparklineProps {
  data: { date: string; price: number }[];
  color: string;
  name?: string;
  /** Size classes for the wrapper. */
  className?: string;
}

const Sparkline = memo(({ data, color, name, className }: SparklineProps) => {
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
            <th scope="col">Date</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i}>
              <td>{new Date(item.date).toLocaleDateString()}</td>
              <td>{formatCurrency(item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

Sparkline.displayName = "Sparkline";

export default Sparkline;
