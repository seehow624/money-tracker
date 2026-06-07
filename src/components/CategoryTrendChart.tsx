'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { colorFor } from '@/lib/colors';
import { fmtCurrency } from '@/lib/format';

type Cat = { id: number; name: string; icon: string | null; color: string | null };
type Point = { month: string } & Record<string, number | string>;

export function CategoryTrendChart({
  data,
  categories,
  baseCurrency,
}: {
  data: Point[];
  categories: Cat[];
  baseCurrency: string;
}) {
  if (categories.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-zinc-500">
        No history yet.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickFormatter={(m) => m.slice(2, 7)}
            axisLine={{ stroke: '#e4e4e7' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const sorted = [...payload].sort(
                (a, b) => (b.value as number) - (a.value as number),
              );
              return (
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm shadow-lg space-y-0.5">
                  <div className="font-medium mb-1">{label}</div>
                  {sorted.map((p) => (
                    <div
                      key={p.dataKey as string}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="flex-1">{String(p.dataKey)}</span>
                      <span className="tabular-nums">
                        {fmtCurrency((p.value as number) ?? 0, baseCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconSize={8}
            formatter={(v) => (
              <span className="text-zinc-600 dark:text-zinc-400">{v}</span>
            )}
          />
          {categories.map((c) => (
            <Line
              key={c.id}
              type="monotone"
              dataKey={c.name}
              stroke={colorFor(c.color).bg}
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
