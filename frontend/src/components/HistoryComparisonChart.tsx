import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipProps,
} from 'recharts';
import type { HistoryPoint } from '@/lib/auth';

// 分类色板（固定顺序，不循环）。浅色表面，来自 dataviz 参考色板。
const SERIES_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];

const GRID_COLOR = '#e1e0d9';
const AXIS_TICK = '#898781';

type Props = {
  data: HistoryPoint[];
  height?: number;
};

type SeriesPoint = { index: number; score: number; finishedAt?: string | null };

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HistoryTooltip({
  active,
  payload,
  label,
  timeMeta,
}: TooltipProps<number, string> & { timeMeta: Record<string, Record<number, string | null>> }) {
  if (!active || !payload || payload.length === 0) return null;
  const idx = (payload[0]?.payload as { index?: number })?.index ?? 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-slate-900">{String(label)}评测</div>
      <div className="space-y-1">
        {payload.map((item) => {
          const name = String(item.dataKey ?? item.name ?? '');
          const ts = timeMeta[name]?.[idx];
          return (
            <div key={name} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-600">{name}</span>
              <span className="ml-auto font-mono tabular-nums font-medium text-slate-900">
                {typeof item.value === 'number' ? `${item.value.toFixed(1)}%` : '-'}
              </span>
              {ts ? <span className="text-slate-400">{formatDateTime(ts)}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 历史数据对比折线图。
 * - 单一基准下：一条线代表一个模型，x 轴为该模型的第 1..N 次评测。
 * - 单一模型下：一条线代表一个基准，x 轴为该基准下的第 1..N 次评测。
 * 得分按百分比（0-100）展示，越高越好。
 */
const HistoryComparisonChart: React.FC<Props> = ({ data, height = 320 }) => {
  const { rows, seriesNames, seriesKey, timeMeta } = useMemo(() => {
    const models = [...new Set(data.map((d) => d.model_name))];
    const benchmarks = [...new Set(data.map((d) => d.benchmark_name))];

    let key: 'model_name' | 'benchmark_name' = 'model_name';
    if (benchmarks.length === 1 && models.length >= 1) key = 'model_name';
    else if (models.length === 1 && benchmarks.length > 1) key = 'benchmark_name';

    // 按序列名分组，每组内按时间排序，得到该序列的得分时间序列
    const groups = new Map<string, SeriesPoint[]>();
    for (const d of data) {
      const name = key === 'model_name' ? d.model_name : d.benchmark_name;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push({
        index: 0,
        score: d.score * 100,
        finishedAt: d.finished_at,
      });
    }

    const names: string[] = [];
    const seriesPoints = new Map<string, SeriesPoint[]>();
    for (const [name, pts] of groups) {
      pts.sort((a, b) => {
        const ta = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
        const tb = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
        return ta - tb;
      });
      pts.forEach((p, i) => {
        p.index = i + 1;
      });
      seriesPoints.set(name, pts);
      names.push(name);
    }
    names.sort();

    const maxRuns = Math.max(1, ...names.map((n) => seriesPoints.get(n)!.length));

    const timeMeta: Record<string, Record<number, string | null>> = {};
    const builtRows: Record<string, unknown>[] = [];
    for (let i = 1; i <= maxRuns; i++) {
      const row: Record<string, unknown> = { index: i, label: `第${i}次` };
      for (const n of names) {
        const pts = seriesPoints.get(n)!;
        const p = pts[i - 1];
        row[n] = p ? Number(p.score.toFixed(2)) : null;
        if (p) {
          if (!timeMeta[n]) timeMeta[n] = {};
          timeMeta[n][i] = p.finishedAt ?? null;
        }
      }
      builtRows.push(row);
    }

    return {
      rows: builtRows,
      seriesNames: names,
      seriesKey: key,
      timeMeta,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-500 py-10">
        暂无历史评测数据，请先完成至少一次评测运行。
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: AXIS_TICK, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: GRID_COLOR }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: AXIS_TICK, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}`}
            width={36}
          />
          <Tooltip content={<HistoryTooltip timeMeta={timeMeta} />} />
          {seriesNames.length > 1 ? (
            <Legend
              verticalAlign="bottom"
              height={28}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span className="text-xs text-slate-600">{value}</span>
              )}
            />
          ) : null}
          {seriesNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 0, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-slate-400">
        纵轴为得分（%），按评测运行次数（{seriesKey === 'model_name' ? '每个模型' : '每个基准'}的时间顺序）展开，越高越好。
      </p>
    </div>
  );
};

export default HistoryComparisonChart;
