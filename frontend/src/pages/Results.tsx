import React, { useEffect, useMemo, useState } from 'react';
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
import { getEvalTask, getEvalTaskMetrics, getEvalTaskProgress, getEvalTaskSamples, listEvalTasks } from '@/lib/auth';

type EvalTask = {
  id: string;
  name: string;
  status: string;
  created_at?: string;
};

const Results: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<EvalTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [metrics, setMetrics] = useState<Array<{ metric_name: string; metric_value: number }>>([]);
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

  useEffect(() => {
    const loadDetails = async () => {
      if (!selectedTaskId) return;
      setLoading(true);
      setError('');
      try {
        const [task, metricItems, sampleResp, taskProgress] = await Promise.all([
          getEvalTask(selectedTaskId) as Promise<{ status: string }>,
          getEvalTaskMetrics(selectedTaskId) as Promise<Array<{ metric_name: string; metric_value: number }>>,
          getEvalTaskSamples(selectedTaskId, 1, 20) as Promise<{
            items: Array<{ sample_id: string; input_text: string; model_output: string; score_json?: Record<string, unknown> }>;
            total: number;
          }>,
          getEvalTaskProgress(selectedTaskId) as Promise<{
            status: string;
            progress_done: number;
            progress_total: number;
            percent: number;
          }>,
        ]);
        setTaskStatus(task.status || '');
        setMetrics(metricItems || []);
        setSamples(sampleResp?.items || []);
        setTotalSamples(sampleResp?.total ?? sampleResp?.items?.length ?? 0);
        setProgressDone(taskProgress?.progress_done ?? 0);
        setProgressTotal(taskProgress?.progress_total ?? 0);
        setProgressPercent(taskProgress?.percent ?? 0);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '加载任务结果失败');
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [selectedTaskId]);

  // 轮询运行进度：只要任务还在排队/运行中，就每秒刷新一次进度条
  useEffect(() => {
    if (!selectedTaskId) return;
    let intervalId = window.setInterval(async () => {
      try {
        const p = await getEvalTaskProgress(selectedTaskId) as {
          status: string;
          progress_done: number;
          progress_total: number;
          percent: number;
        };

        setProgressDone(p?.progress_done ?? 0);
        setProgressTotal(p?.progress_total ?? 0);
        setProgressPercent(p?.percent ?? 0);

        const runStatus = String(p?.status || '').toLowerCase();
        if (['completed', 'failed'].includes(runStatus)) {
          window.clearInterval(intervalId);
        }
      } catch {
        // 忽略单次轮询失败
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [selectedTaskId]);

  const exactMatch = useMemo(() => {
    const item = metrics.find((m) => m.metric_name === 'exact_match');
    return item ? Number(item.metric_value) : 0;
  }, [metrics]);

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader><CardTitle>Exact Match</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-blue-700">{(exactMatch * 100).toFixed(2)}%</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>样本数量</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-slate-900">{totalSamples}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>任务状态</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-slate-900">{taskStatus || '-'}</div></CardContent>
          </Card>
        </div>

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
                       <TableHead className="w-[140px]">评分</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {samples.map((item) => (
                      <TableRow key={item.sample_id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.sample_id}</TableCell>
                        <TableCell className="max-w-[320px] truncate">{item.input_text}</TableCell>
                        <TableCell className="max-w-[460px] truncate">{item.model_output}</TableCell>
                        <TableCell>
                          {typeof item.score_json?.exact_match === 'number' ? (
                            <Badge variant="outline">{Number(item.score_json.exact_match).toFixed(2)}</Badge>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Results;