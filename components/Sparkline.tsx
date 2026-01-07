"use client";

import { useId, memo } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface SparklineProps {
  data: { date: string; price: number }[];
  color: string;
  name?: string;
}

const Sparkline = memo(({ data, color, name }: SparklineProps) => {
  const uniqueId = useId();
  const gradientId = `gradient-${uniqueId}`;

  return (
    <div className="h-16 w-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
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
