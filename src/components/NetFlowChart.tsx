'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { fmtMyr } from '@/lib/format';

type Point = {
  month: string;
  income: number;
  expense: number;
  net: number;
  cumulative: number;
};

export function NetFlowChart({ data }: { data: Point[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickFormatter={(m) => m.slice(2, 7)}
            axisLine={{ stroke: '#e4e4e7' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: '#71717a' }}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: '#3b82f6' }}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm shadow-lg">
                  <div className="font-medium mb-1">{label}</div>
                  <div className="text-emerald-600 text-xs tabular-nums">
                    + {fmtMyr(p.income)}
                  </div>
                  <div className="text-rose-600 text-xs tabular-nums">
                    − {fmtMyr(p.expense)}
                  </div>
                  <div
                    className={
                      'text-xs tabular-nums ' +
                      (p.net >= 0 ? 'text-emerald-700' : 'text-rose-700')
                    }
                  >
                    net {p.net >= 0 ? '+' : ''}
                    {fmtMyr(p.net)}
                  </div>
                  <div className="text-blue-600 text-xs tabular-nums mt-1 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                    Σ {p.cumulative >= 0 ? '+' : ''}
                    {fmtMyr(p.cumulative)}
                  </div>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          <ReferenceLine y={0} yAxisId="left" stroke="#a1a1aa" />
          <Bar
            yAxisId="left"
            dataKey="income"
            name="Income"
            fill="#10b981"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="expense"
            name="Expense"
            fill="#f43f5e"
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumulative"
            name="Cumulative Net"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: '#3b82f6' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
