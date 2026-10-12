import React from 'react';
import type { EvalMetricItem } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

// ===== 取值助手 =====

function findMetric(metrics: EvalMetricItem[], name: string): EvalMetricItem | undefined {
  return metrics.find((m) => m.metric_name === name);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// 保留 1 位小数，避免 0.8500000000000001 这种浮点尾巴
function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

// ===== 通过 / 失败 / 错误构成 =====

const PASS_FAIL_CONFIG = {
  passed: { label: '通过', color: '#059669' },
  failed: { label: '判错', color: '#dc2626' },
  errors: { label: '调用失败', color: '#d97706' },
} satisfies ChartConfig;

const PassFailChart: React.FC<{ metric?: EvalMetricItem }> = ({ metric }) => {
  const details = metric?.details_json;
  const data = [
    { key: 'passed', value: details?.passed ?? 0 },
    { key: 'failed', value: details?.failed ?? 0 },
    { key: 'errors', value: details?.errors ?? 0 },
  ].filter((item) => item.value > 0);

  const total = details?.total ?? 0;
  // 通过率的分母是有判定结论的样本数，不含调用失败/裁判不可用的那些。
  const judged = details?.judged ?? 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">结果构成</CardTitle>
        <CardDescription>
          {judged > 0
            ? `共 ${total} 条样本，${judged} 条有判定结论，通过率 ${percent(metric?.metric_value ?? 0)}`
            : `共 ${total} 条样本，均无判定结论`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">该任务暂无样本结果</div>
        ) : (
          <div className="relative">
            <ChartContainer config={PASS_FAIL_CONFIG} className="mx-auto aspect-square max-h-[220px]">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={data} dataKey="value" nameKey="key" innerRadius={58} strokeWidth={2}>
                  {data.map((item) => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            {/* 环心数字：叠在图表上，省掉 recharts 的 Label 配置。
                取后端的 metric_value（以 judged 为分母），与上方卡片同源，
                不要自己用 total 再算一遍。 */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-emerald-600">
                {judged > 0 ? percent(metric?.metric_value ?? 0) : '—'}
              </span>
              <span className="text-xs text-muted-foreground">
                {judged > 0 ? '通过率' : '不可评估'}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {data.map((item) => (
            <div key={item.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: `var(--color-${item.key})` }}
                />
                {PASS_FAIL_CONFIG[item.key as keyof typeof PASS_FAIL_CONFIG].label}
              </span>
              <span className="font-medium">
                {item.value}
                <span className="text-muted-foreground font-normal ml-1">
                  （{percent(ratio(item.value, total))}）
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ===== 防御命中率 =====

const DEFENSE_CONFIG = {
  hit_rate: { label: '命中率', color: '#2563eb' },
} satisfies ChartConfig;

const DefenseHitChart: React.FC<{
  inputMetric?: EvalMetricItem;
  outputMetric?: EvalMetricItem;
}> = ({ inputMetric, outputMetric }) => {
  if (!inputMetric && !outputMetric) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">防御检测</CardTitle>
          <CardDescription>本任务未配置防御策略</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-10 text-center text-sm text-slate-500">
            在新建评测任务时选择防御策略，即可在此看到输入侧 / 输出侧的命中情况
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = [
    inputMetric
      ? {
          side: '输入侧',
          hit_rate: inputMetric.metric_value,
          defended: inputMetric.details_json?.defended ?? 0,
          hits: inputMetric.details_json?.hits ?? 0,
        }
      : null,
    outputMetric
      ? {
          side: '输出侧',
          hit_rate: outputMetric.metric_value,
          defended: outputMetric.details_json?.defended ?? 0,
          hits: outputMetric.details_json?.hits ?? 0,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">防御检测命中率</CardTitle>
        <CardDescription>
          分母是「有该侧判定结论的样本数」，未启用防御的样本不计入
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={DEFENSE_CONFIG} className="mx-auto aspect-video max-h-[220px]">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="side" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              domain={[0, 1]}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
              formatter={(value: number) => percent(value)}
            />
            <Bar dataKey="hit_rate" fill="var(--color-hit_rate)" radius={[6, 6, 0, 0]} maxBarSize={72} />
          </BarChart>
        </ChartContainer>

        <div className="mt-4 space-y-2">
          {data.map((item) => (
            <div key={item.side} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.side}</span>
              <span className="font-medium">
                {item.hits} / {item.defended} 命中
                <span className="text-muted-foreground font-normal ml-1">
                  （{percent(item.hit_rate)}）
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ===== 按标注分组的通过率 =====

const LABEL_CONFIG = {
  pass_rate: { label: '通过率', color: '#7c3aed' },
} satisfies ChartConfig;

const LabelPassRateChart: React.FC<{ metric?: EvalMetricItem }> = ({ metric }) => {
  const byLabel = metric?.details_json?.by_label;
  const data = byLabel
    ? Object.entries(byLabel).map(([label, stat]) => ({
        label,
        pass_rate: stat.pass_rate,
        total: stat.total,
        passed: stat.passed,
      }))
    : [];

  if (data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">按标注分组</CardTitle>
          <CardDescription>数据集的 ground truth 分布</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-10 text-center text-sm text-slate-500">
            该任务的样本没有标注 label 字段
          </div>
        </CardContent>
      </Card>
    );
  }

  // 横向柱状图：标注值可能是长文本，放 Y 轴更好读
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">按标注分组通过率</CardTitle>
        <CardDescription>样本按数据集 labels_json.label 分组后的通过率</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={LABEL_CONFIG}
          className="aspect-video max-h-[280px]"
          style={{ height: Math.max(data.length * 44 + 40, 140) }}
        >
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              domain={[0, 1]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={96}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
              formatter={(value: number) => percent(value)}
            />
            <Bar dataKey="pass_rate" fill="var(--color-pass_rate)" radius={[0, 6, 6, 0]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>

        <div className="mt-4 space-y-2">
          {data.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">
                {item.passed} / {item.total}
                <span className="text-muted-foreground font-normal ml-1">
                  （{percent(item.pass_rate)}）
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ===== 对外入口 =====
//
// recharts 体积不小（打包后约 420KB），这里只导出这一个聚合组件，
// 由 Results 页用 React.lazy 引入 —— 图表代码单独成 chunk，
// 不进首页/评测页的首屏包，且只有真的打开评测报告时才下载。

const ResultCharts: React.FC<{ metrics: Map<string, EvalMetricItem> }> = ({ metrics }) => (
  <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <PassFailChart metric={metrics.get('exact_match')} />
      <DefenseHitChart
        inputMetric={metrics.get('defense_input_hit_rate')}
        outputMetric={metrics.get('defense_output_hit_rate')}
      />
    </div>
    <div className="mb-8">
      <LabelPassRateChart metric={metrics.get('label_pass_rate')} />
    </div>
  </>
);

export default ResultCharts;
