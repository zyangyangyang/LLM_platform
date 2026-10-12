import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import { 
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link, useSearchParams } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getEvalTask,
  getEvalTaskMetrics,
  getEvalTaskProgress,
  getEvalTaskSamples,
  listEvalTasks,
  type EvalMetricItem,
} from '@/lib/auth';
// 图表依赖 recharts，懒加载成独立 chunk，不拖慢首屏
const ResultCharts = React.lazy(() => import('@/components/ResultCharts'));

// 评测运行中，指标与样本明细按此间隔跟随刷新。
// 不能和进度条一样 1 秒一次：/metrics 会现算全量样本
// （list_all_by_task 把该 run 的所有结果行拉回来再逐条 JSON 解析），
// 任务上千条时每秒一次纯属浪费。
const METRICS_REFRESH_MS = 5000;

const MetricCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn' | 'bad';
}> = ({ label, value, hint, tone = 'default' }) => {
  const toneClass = {
    default: 'text-slate-900',
    ok: 'text-emerald-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
  }[tone];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${toneClass}`}>{value}</div>
        {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
      </CardContent>
    </Card>
  );
};

// 任务上记录的评测口径，由所选数据集推导（见 Assessment.resolveTaskType）。
// 报告里展示的就是它 —— 不是创建页那三个从未被持久化的复选框。
const TASK_TYPE_LABELS: Record<string, string> = {
  hallucination: '幻觉检测',
  prompt_attack: '提示词攻击',
  multimodal: '多模态攻击',
  safety: '安全评测',
};

// 运行开始时留档的生成参数（被测模型 / 裁判各一份）。
// 结构见 scripts/add_gen_params_to_task_runs.py，不含任何密钥。
type GenParamsEntry = {
  config_name?: string | null;
  provider?: string | null;
  endpoint?: string | null;
  /** 后端 effective_generation_params 算出的、真正发出去的那份参数 */
  request?: Record<string, unknown> | null;
};

type GenParamsSnapshot = {
  model?: GenParamsEntry | null;
  judge?: GenParamsEntry | null;
};

// 报告元信息：说明这份报告是对「哪个数据集、哪个模型、什么口径」做的
type TaskInfo = {
  dataset_name?: string | null;
  model_name?: string | null;
  task_type?: string | null;
  attack_strategy_id?: string | null;
  attack_strategy_name?: string | null;
  defense_strategy_id?: string | null;
  defense_strategy_name?: string | null;
  /** 迁移前建的老任务没有这份快照，为 null —— 与「用了默认参数」是两回事 */
  gen_params_json?: GenParamsSnapshot | null;
};

const InfoItem: React.FC<{
  label: string;
  value?: string | null;
  /** value 为空时的文案。「未启用」和「已删除」是两回事，由调用方区分 */
  placeholder?: string;
  hint?: string;
}> = ({ label, value, placeholder = '未启用', hint }) => (
  <div className="min-w-0">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p
      className={`text-sm font-medium truncate ${value ? 'text-foreground' : 'text-slate-400'}`}
      title={value || undefined}
    >
      {value || placeholder}
    </p>
    {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
  </div>
);

// 把一份生成参数快照摊平成「键: 值」列表。request 里的键由厂商决定（不同家支持
// 的参数不一样），所以不写死字段名，有什么展示什么。
function describeGenParams(entry: GenParamsEntry): { label: string; value: string }[] {
  const request = entry.request ?? {};
  const rows: { label: string; value: string }[] = [];

  const model = request.model;
  rows.push({ label: '实际模型', value: typeof model === 'string' && model ? model : '未知' });

  rows.push({
    label: 'Temperature',
    value: typeof request.temperature === 'number' ? String(request.temperature) : '未指定（厂商默认）',
  });
  rows.push({
    label: 'Max Tokens',
    value: typeof request.max_tokens === 'number' ? String(request.max_tokens) : '未指定（厂商默认）',
  });

  // 厂商特有的键（top_p、thinking 之类）也一并列出，免得快照看着像漏了东西
  const known = new Set(['model', 'temperature', 'max_tokens']);
  Object.entries(request)
    .filter(([key]) => !known.has(key))
    .forEach(([key, value]) => {
      rows.push({ label: key, value: value === null ? 'null' : String(value) });
    });

  if (entry.config_name && entry.config_name !== model) {
    rows.push({ label: '配置名', value: entry.config_name });
  }
  return rows;
}

const GenParamsBlock: React.FC<{ title: string; entry?: GenParamsEntry | null }> = ({
  title,
  entry,
}) => {
  if (!entry) {
    return (
      <div className="rounded-md border border-border px-3 py-2">
        <p className="text-xs font-medium mb-1">{title}</p>
        <p className="text-xs text-slate-400">本次运行没有留下记录</p>
      </div>
    );
  }
  const rows = describeGenParams(entry);
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs font-medium mb-1.5">{title}</p>
      <dl className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2 text-xs">
            <dt className="text-muted-foreground shrink-0 w-24">{row.label}</dt>
            <dd className="font-mono truncate" title={row.value}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

type EvalTask = {
  id: string;
  name: string;
  status: string;
  created_at?: string;
};

// /progress 返回的是 run 级状态（pending/running/completed/failed），
// 与任务级状态（queued/running/finished/failed）不是同一套取值，别混用。
type TaskProgress = {
  status: string;
  progress_done: number;
  progress_total: number;
  percent: number;
};

// 后端防御算法 detect_input / detect_output 的返回结构
type DefenseVerdict = {
  is_attack?: boolean;
  score?: number;
  reason?: string;
  details?: Record<string, unknown>;
};

// 任务未配置防御策略时 score_json 里不会有这两个字段，需要与“检测通过”区分开
function asVerdict(value: unknown): DefenseVerdict | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as DefenseVerdict;
  if (typeof row.is_attack !== 'boolean') return null;
  return row;
}

function verdictTitle(verdict: DefenseVerdict): string {
  const parts: string[] = [];
  if (verdict.reason) parts.push(verdict.reason);
  if (typeof verdict.score === 'number') parts.push(`风险分 ${verdict.score.toFixed(2)}`);
  const hits = verdict.details?.hits;
  if (Array.isArray(hits) && hits.length > 0) parts.push(`命中：${hits.join('、')}`);
  return parts.join('；') || '无明细';
}

const VerdictBadge: React.FC<{ side: string; verdict: DefenseVerdict }> = ({ side, verdict }) => (
  <Badge
    variant="outline"
    title={verdictTitle(verdict)}
    className={
      verdict.is_attack
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  >
    {side}侧 {verdict.is_attack ? '命中' : '通过'}
  </Badge>
);

const Results: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<EvalTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);

  const hasGenParams = Boolean(
    taskInfo?.gen_params_json &&
      (taskInfo.gen_params_json.model || taskInfo.gen_params_json.judge),
  );
  const [metrics, setMetrics] = useState<EvalMetricItem[]>([]);
  const [samples, setSamples] = useState<Array<{ sample_id: string; input_text: string; model_output: string; score_json?: Record<string, unknown> }>>([]);
  const [totalSamples, setTotalSamples] = useState(0);
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const taskList = await listEvalTasks() as EvalTask[];
        setTasks(taskList);
        const queryTaskId = searchParams.get('taskId');
        const picked = queryTaskId || taskList[0]?.id || '';
        setSelectedTaskId(picked);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '加载任务失败');
      }
    };
    loadTasks();
  }, [searchParams]);

  // silent = true 用于轮询：不切 loading、不动 error，失败也就静默吞掉，
  // 免得评测进行中每几秒闪一次「正在加载结果...」或弹出瞬时网络错误。
  const loadDetails = useCallback(async (silent = false) => {
    if (!selectedTaskId) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [task, metricItems, sampleResp, taskProgress] = await Promise.all([
        getEvalTask(selectedTaskId) as Promise<TaskInfo & { status: string }>,
        getEvalTaskMetrics(selectedTaskId),
        getEvalTaskSamples(selectedTaskId, 1, 20) as Promise<{
          items: Array<{ sample_id: string; input_text: string; model_output: string; score_json?: Record<string, unknown> }>;
          total: number;
        }>,
        getEvalTaskProgress(selectedTaskId) as Promise<TaskProgress>,
      ]);
      setTaskStatus(task.status || '');
      setTaskInfo(task);
      setMetrics(metricItems || []);
      setSamples(sampleResp?.items || []);
      setTotalSamples(sampleResp?.total ?? sampleResp?.items?.length ?? 0);
      setProgressDone(taskProgress?.progress_done ?? 0);
      setProgressTotal(taskProgress?.progress_total ?? 0);
      setProgressPercent(taskProgress?.percent ?? 0);
    } catch (e: unknown) {
      if (!silent) setError(e instanceof Error ? e.message : '加载任务结果失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // 轮询：进度条每秒跟进（/progress 很便宜），指标与样本按 METRICS_REFRESH_MS 节流刷新，
  // 并在 run 状态发生翻转时立刻补一次，保证跑到 completed/failed 的那一帧就是终值。
  useEffect(() => {
    if (!selectedTaskId) return;
    let intervalId = 0;
    let prevRunStatus = '';
    let lastMetricsAt = 0;

    const tick = async () => {
      try {
        const p = await getEvalTaskProgress(selectedTaskId) as TaskProgress;

        setProgressDone(p?.progress_done ?? 0);
        setProgressTotal(p?.progress_total ?? 0);
        setProgressPercent(p?.percent ?? 0);

        const runStatus = String(p?.status || '').toLowerCase();
        const isDone = ['completed', 'failed'].includes(runStatus);
        const statusChanged = runStatus !== prevRunStatus;
        prevRunStatus = runStatus;

        if (statusChanged || Date.now() - lastMetricsAt >= METRICS_REFRESH_MS) {
          lastMetricsAt = Date.now();
          await loadDetails(true);
        }

        // 结束帧刷完之后再停，否则最后一次指标会停在倒数第二个进度上
        if (isDone && statusChanged) window.clearInterval(intervalId);
      } catch {
        // 忽略单次轮询失败
      }
    };

    intervalId = window.setInterval(tick, 1000);

    return () => window.clearInterval(intervalId);
  }, [selectedTaskId, loadDetails]);

  // 后端 TaskService.get_task_metrics 现算的指标；缺失的项一律按 undefined 处理，
  // 由各图表自己决定「未启用」还是「无数据」，不要在这里塞 0 冒充真实值。
  const metricByName = useMemo(() => {
    const map = new Map<string, EvalMetricItem>();
    metrics.forEach((item) => map.set(item.metric_name, item));
    return map;
  }, [metrics]);

  const exactMatch = metricByName.get('exact_match')?.metric_value ?? 0;
  const errorRate = metricByName.get('error_rate');
  const details = metricByName.get('exact_match')?.details_json ?? undefined;
  // 样本存在 ≠ 有结论：判别不了（裁判调不通等）的样本会被记为 error 并从分母剔除。
  // judged 为 0 时通过率无从谈起，必须显示「不可评估」而不是 0%。
  const judged = details?.judged ?? 0;
  const hasResults = judged > 0;

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      {/* 背景装饰图案 */}
      <div className="pointer-events-none absolute inset-0">
        {/* 右上角淡蓝色光晕 */}
        <div className="absolute -top-32 -right-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl" />
        {/* 左下角淡紫色光晕 */}
        <div className="absolute bottom-[-120px] left-[-80px] w-[420px] h-[420px] bg-indigo-200/40 rounded-full blur-3xl" />
        {/* 右侧渐变矩形 */}
        <div className="absolute top-1/3 right-24 w-64 h-64 bg-gradient-to-br from-sky-100/70 to-blue-100/40 rounded-3xl rotate-3 blur-sm border border-white/40" />
        {/* 细线条网格 */}
        <div
          className="absolute inset-0 opacity-25 mix-blend-soft-light"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        {/* 点状装饰 */}
        <div className="absolute top-24 left-1/4 grid grid-cols-6 gap-3 opacity-40 text-sky-300">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-sky-300" />
          ))}
        </div>
        <div className="absolute bottom-24 right-1/3 grid grid-cols-5 gap-3 opacity-40 text-indigo-300">
          {Array.from({ length: 15 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
          ))}
        </div>
      </div>

      <Navbar />

      <main className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-gray-200 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground">评测结果</h1>
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">
                <CheckCircle className="w-3 h-3 mr-1" /> {taskStatus || '未知状态'}
              </Badge>
            </div>
            {progressTotal > 0 && ['queued', 'running'].includes((taskStatus || '').toLowerCase()) ? (
              <div className="mt-2 space-y-2">
                <div className="text-sm text-slate-600">
                  进度：{progressDone}/{progressTotal}（{Math.round(progressPercent)}%）
                </div>
                <Progress value={progressPercent} />
              </div>
            ) : null}
            <p className="text-muted-foreground text-sm">选择任务后可查看实时指标与样本结果。</p>
          </div>
          <div className="flex gap-3">
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedTaskId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedTaskId(nextId);
                setSearchParams({ taskId: nextId });
              }}
            >
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}（{task.status}）
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 报告元信息：说明这份报告是对「什么数据集 / 什么模型 / 什么口径」做的。
            数据来自 getEvalTask(with_names=True)，不参与任何计算，
            纯粹是给人工复核提供上下文——光看一堆数字无法判断结论是否可信。 */}
        {taskInfo ? (
          <Card className="mb-6 border-border shadow-sm">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                <InfoItem
                  label="数据集"
                  value={taskInfo.dataset_name}
                  placeholder="已删除或不可用"
                />
                <InfoItem
                  label="被测模型"
                  value={taskInfo.model_name}
                  placeholder="已删除或不可用"
                />
                <InfoItem
                  label="评测口径"
                  value={
                    taskInfo.task_type
                      ? `${TASK_TYPE_LABELS[taskInfo.task_type] ?? taskInfo.task_type}（${taskInfo.task_type}）`
                      : null
                  }
                  placeholder="未记录"
                  hint="由所选数据集决定"
                />
                <InfoItem
                  label="攻击策略"
                  value={taskInfo.attack_strategy_name}
                  placeholder={taskInfo.attack_strategy_id ? '已删除' : '未启用'}
                />
                <InfoItem
                  label="防御策略"
                  value={taskInfo.defense_strategy_name}
                  placeholder={taskInfo.defense_strategy_id ? '已删除' : '未启用'}
                />
              </div>

              {/* 运行时的生成参数快照。没有它，报告只能说明「哪个模型」，说不清
                  「用什么参数跑的」—— 而 temperature 一改，同样的数据集就会给出
                  不同的数字。迁移前的老任务读不到，那种情况直说不留记录，不能
                  默认成「用了默认参数」。 */}
              {hasGenParams ? (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    本次运行实际发出去的生成参数（运行开始时留档；之后修改模型配置不会改动这份报告）
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <GenParamsBlock title="被测模型" entry={taskInfo.gen_params_json?.model} />
                    <GenParamsBlock title="裁判模型" entry={taskInfo.gen_params_json?.judge} />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            label="通过率 (Exact Match)"
            value={hasResults ? `${(exactMatch * 100).toFixed(2)}%` : '不可评估'}
            hint={
              hasResults
                ? `${details?.passed ?? 0} / ${judged} 通过`
                : details?.total
                ? `${details.total} 条样本均无判定结论`
                : '暂无结果'
            }
            tone={hasResults ? 'ok' : 'default'}
          />
          <MetricCard
            label="样本数量"
            value={String(totalSamples)}
            hint={totalSamples > 20 ? '下方明细仅展示最近 20 条' : undefined}
          />
          <MetricCard
            label="判错样本"
            value={String(details?.failed ?? 0)}
            hint={details?.failed ? '模型输出与标注不符' : '暂无判错样本'}
            tone={details?.failed ? 'bad' : 'default'}
          />
          <MetricCard
            label="调用失败"
            value={errorRate ? `${(errorRate.metric_value * 100).toFixed(1)}%` : '-'}
            hint={
              errorRate
                ? `${errorRate.details_json?.errors ?? 0} 条无判定结论（调用失败或裁判不可用）`
                : '暂无数据'
            }
            tone={errorRate?.metric_value ? 'warn' : 'default'}
          />
        </div>

        {/* 可视化分析：数据全部来自 getEvalTaskMetrics 现算，非前端估算 */}
        <React.Suspense
          fallback={
            <div className="mb-8 h-64 rounded-lg border border-border bg-white/60 flex items-center justify-center text-sm text-slate-500">
              正在加载图表...
            </div>
          }
        >
          <ResultCharts metrics={metricByName} />
        </React.Suspense>

        <Card className="border-border shadow-sm overflow-hidden">
           <CardHeader className="bg-slate-50/50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                 <CardTitle>样本明细（最近 20 条）</CardTitle>
              </div>
           </CardHeader>
           <CardContent className="p-0">
             {error ? <div className="p-4 text-sm text-red-600">{error}</div> : null}
             {loading ? <div className="p-4 text-sm text-slate-500">正在加载结果...</div> : null}
              <Table>
                 <TableHeader>
                    <TableRow>
                       <TableHead className="w-[120px]">Sample ID</TableHead>
                       <TableHead>输入文本</TableHead>
                       <TableHead>模型输出</TableHead>
                       <TableHead className="w-[150px]">防御检测</TableHead>
                       <TableHead className="w-[140px]">评分</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {samples.map((item) => {
                      const inputVerdict = asVerdict(item.score_json?.defense_input);
                      const outputVerdict = asVerdict(item.score_json?.defense_output);
                      return (
                        <TableRow key={item.sample_id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{item.sample_id}</TableCell>
                          <TableCell className="max-w-[320px] truncate">{item.input_text}</TableCell>
                          <TableCell className="max-w-[460px] truncate">{item.model_output}</TableCell>
                          <TableCell>
                            {inputVerdict || outputVerdict ? (
                              <div className="flex flex-wrap gap-1">
                                {inputVerdict ? <VerdictBadge side="输入" verdict={inputVerdict} /> : null}
                                {outputVerdict ? <VerdictBadge side="输出" verdict={outputVerdict} /> : null}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">未启用</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {typeof item.score_json?.exact_match === 'number' ? (
                              <Badge variant="outline">{Number(item.score_json.exact_match).toFixed(2)}</Badge>
                            ) : (
                              <span className="text-xs text-slate-500">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Results;