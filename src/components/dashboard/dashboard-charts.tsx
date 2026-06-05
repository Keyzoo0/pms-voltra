"use client";

import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatIDR, formatIDRCompact } from "@/lib/utils";

type CashPoint = { label: string; value: number };
type StatusSlice = { name: string; value: number; color: string };

function CashTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-0.5 font-medium text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{formatIDR(payload[0].value)}</p>
    </div>
  );
}

export function CashflowChart({ data }: { data: CashPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(243 75% 59%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(243 75% 59%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={64}
          stroke="currentColor"
          className="text-muted-foreground"
          tickFormatter={(v: number) => formatIDRCompact(v)}
        />
        <Tooltip
          content={<CashTooltip />}
          cursor={{ stroke: "hsl(243 75% 59%)", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(243 75% 59%)"
          strokeWidth={2.5}
          fill="url(#cashGradient)"
          dot={{ r: 3, fill: "hsl(243 75% 59%)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: StatusSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: item.payload.color }}
        />
        {item.name}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        {item.value} proyek
      </p>
    </div>
  );
}

export function StatusDonut({ data }: { data: StatusSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Tooltip content={<StatusTooltip />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {total}
        </span>
        <span className="text-xs text-muted-foreground">Total Proyek</span>
      </div>
    </div>
  );
}
