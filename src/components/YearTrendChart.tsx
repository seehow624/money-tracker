'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { fmtCurrency } from '@/lib/format';

type Point = { month: string; income: number; expense: number };

export function YearTrendChart({ data, baseCurrency }: { data: Point[]; baseCurrency: string }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
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
              const inc = payload.find((p) => p.dataKey === 'income')?.value as
                | number
                | undefined;
              const exp = payload.find((p) => p.dataKey === 'expense')?.value as
                | number
                | undefined;
              const net = (inc ?? 0) - (exp ?? 0);
              return (
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm shadow-lg">
                  <div className="font-medium mb-1">{label}</div>
                  <div className="text-emerald-600">+ {fmtCurrency(inc ?? 0, baseCurrency)}</div>
                  <div className="text-rose-600">− {fmtCurrency(exp ?? 0, baseCurrency)}</div>
                  <div
                    className={
                      'text-xs mt-1 ' +
                      (net >= 0 ? 'text-emerald-700' : 'text-rose-700')
                    }
                  >
                    net {net >= 0 ? '+' : ''}
                    {fmtCurrency(net, baseCurrency)}
                  </div>
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
          <ReferenceLine y={0} stroke="#a1a1aa" />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
