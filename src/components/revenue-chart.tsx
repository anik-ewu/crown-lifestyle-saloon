"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/format";

// Single series, so no legend: the card title names it. Colour checked with the
// dataviz validator against the white card surface.
const BAR = "#a07c22";

export type RevenuePoint = { label: string; revenue: number; bills: number };

function compactTaka(poisha: number) {
  const t = poisha / 100;
  if (t >= 100000) return `৳${(t / 100000).toFixed(t >= 1000000 ? 0 : 1)}L`;
  if (t >= 1000) return `৳${(t / 1000).toFixed(t >= 10000 ? 0 : 1)}k`;
  return `৳${t}`;
}

/** Four even, round steps (1/2/2.5/5 × 10^n) that cover the max. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 100000];
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return [0, 1, 2, 3, 4].map((i) => i * step);
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const ticks = niceTicks(Math.max(...data.map((d) => d.revenue)));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e7e5e4" strokeWidth={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d6d3d1" }} tick={{ fill: "#78716c", fontSize: 12 }} interval="preserveStartEnd" />
          <YAxis ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tickFormatter={compactTaka} tickLine={false} axisLine={false} tick={{ fill: "#78716c", fontSize: 12 }} width={56} />
          <Tooltip
            cursor={{ fill: "#f5f5f4" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as RevenuePoint;
              return (
                <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm shadow-md">
                  <p className="font-medium text-stone-900">{label}</p>
                  <p className="tabular-nums text-stone-700">{money(p.revenue)}</p>
                  <p className="text-xs text-stone-500">{p.bills} bill{p.bills === 1 ? "" : "s"}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="revenue" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
