'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { fmtMyr } from '@/lib/format';
import { paletteFor } from '@/lib/palette';

type Slice = {
  id: number;
  name: string;
  spent: number;
  icon: string | null;
  color: string | null;
};

const RADIAN = Math.PI / 180;

export function MonthlyPie({ data }: { data: Slice[] }) {
  const filtered = data.filter((d) => d.spent > 0).sort((a, b) => b.spent - a.spent);
  const total = filtered.reduce((s, c) => s + c.spent, 0);

  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-zinc-500">
        No data this month.
      </div>
    );
  }

  // Show every slice — no lumping into "Other" — so colors line up 1:1 with the list below.
  const slices: Slice[] = filtered;

  return (
    <div className="aspect-square w-full max-w-[400px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
          <Pie
            data={slices}
            dataKey="spent"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius="75%"
            paddingAngle={0}
            stroke="#fff"
            strokeWidth={1.5}
            isAnimationActive={false}
            label={(p: {
              cx?: number;
              cy?: number;
              midAngle?: number;
              outerRadius?: number;
              percent?: number;
              index?: number;
            }) => {
              const cx = p.cx ?? 0;
              const cy = p.cy ?? 0;
              const midAngle = p.midAngle ?? 0;
              const outerRadius =
                typeof p.outerRadius === 'number' ? p.outerRadius : 0;
              const percent = p.percent ?? 0;
              const index = p.index ?? 0;
              const slice = slices[index];
              if (!slice || percent < 0.008) return <g key={index} />;
              const sin = Math.sin(-midAngle * RADIAN);
              const cos = Math.cos(-midAngle * RADIAN);
              const sx = cx + (outerRadius + 1) * cos;
              const sy = cy + (outerRadius + 1) * sin;
              const mx = cx + (outerRadius + 18) * cos;
              const my = cy + (outerRadius + 18) * sin;
              const ex = mx + (cos >= 0 ? 1 : -1) * 16;
              const ey = my;
              const textAnchor = cos >= 0 ? 'start' : 'end';
              const stroke = paletteFor(index);
              const labelName =
                slice.name.length > 14
                  ? slice.name.slice(0, 12) + '…'
                  : slice.name;
              return (
                <g>
                  <path
                    d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
                    stroke={stroke}
                    fill="none"
                    strokeWidth={1}
                  />
                  <circle cx={ex} cy={ey} r={2} fill={stroke} />
                  <text
                    x={ex + (cos >= 0 ? 4 : -4)}
                    y={ey - 2}
                    textAnchor={textAnchor}
                    fill="currentColor"
                    fontSize={11}
                    fontWeight={600}
                    className="fill-zinc-800 dark:fill-zinc-100"
                  >
                    {labelName}
                  </text>
                  <text
                    x={ex + (cos >= 0 ? 4 : -4)}
                    y={ey + 11}
                    textAnchor={textAnchor}
                    fill="currentColor"
                    fontSize={10}
                    className="fill-zinc-500"
                  >
                    {(percent * 100).toFixed(1)}%
                  </text>
                </g>
              );
            }}
            labelLine={false}
          >
            {slices.map((s, idx) => (
              <Cell key={s.id} fill={paletteFor(idx)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Slice;
              const pct = total > 0 ? (p.spent / total) * 100 : 0;
              return (
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm shadow-lg">
                  <div className="font-medium">
                    {p.icon} {p.name}
                  </div>
                  <div className="text-zinc-500 text-xs tabular-nums">
                    {fmtMyr(p.spent)} · {pct.toFixed(1)}%
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
