'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { colorFor } from '@/lib/colors';
import { fmtMoney } from '@/lib/format';

type Slice = {
  id: number;
  name: string;
  spent: number;
  icon: string | null;
  color: string | null;
};

export function CategoryDonut({ data }: { data: Slice[] }) {
  const filtered = data.filter((d) => d.spent > 0).sort((a, b) => b.spent - a.spent);
  const top = filtered.slice(0, 8);
  const rest = filtered.slice(8);
  const slices: Slice[] =
    rest.length > 0
      ? [
          ...top,
          {
            id: -1,
            name: `Other (${rest.length})`,
            spent: rest.reduce((s, c) => s + c.spent, 0),
            icon: '·',
            color: 'gray',
          },
        ]
      : top;

  const total = slices.reduce((s, c) => s + c.spent, 0);

  if (total === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-zinc-500">
        No expenses this month yet.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="spent"
            nameKey="name"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={1}
            stroke="none"
          >
            {slices.map((s) => (
              <Cell key={s.id} fill={colorFor(s.color).bg} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Slice;
              const pct = total > 0 ? (p.spent / total) * 100 : 0;
              return (
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm shadow-lg">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-zinc-500 text-xs tabular-nums">
                    {fmtMoney(p.spent)} · {pct.toFixed(1)}%
                  </div>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: 11 }}
            iconSize={8}
            formatter={(value, entry) => {
              const p = entry.payload as unknown as Slice;
              const pct = total > 0 ? (p.spent / total) * 100 : 0;
              return (
                <span className="text-zinc-600 dark:text-zinc-400">
                  {value} · {pct.toFixed(0)}%
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
