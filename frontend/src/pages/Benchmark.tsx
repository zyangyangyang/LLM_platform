import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import HistoryComparisonChart from '../components/HistoryComparisonChart';
import {
  BarChart3,
  ArrowLeft,
  Play,
  Loader2,
  LogIn,
  Users,
  Trophy,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  getAccessToken,
  getHistory,
  getLeaderboard,
  listBenchmarks,
  type BenchmarkSummary,
  type LeaderboardEntry,
} from '@/lib/auth';

const TASK_TYPE_LABELS: Record<string, string> = {
  hallucination: '幻觉检测',
  prompt_attack: '提示词攻击',
  multimodal: '多模态攻击',
  safety: '综合安全',
};

const taskTypeLabel = (t: string) => TASK_TYPE_LABELS[t] ?? t;
const toPercent = (v: number) => `${(v * 100).toFixed(1)}%`;

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
      : rank === 2
        ? 'bg-gray-100 text-gray-800 border-gray-300'
        : rank === 3
          ? 'bg-orange-100 text-orange-800 border-orange-300'
          : 'bg-blue-50 text-blue-700 border-blue-200';
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 text-base font-bold ${cls}`}
    >
      {rank}
    </div>
  );
}

const Benchmark: React.FC = () => {
  const loggedIn = useMemo(() => Boolean(getAccessToken()), []);
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>([]);
  const [selected, setSelected] = useState<BenchmarkSummary | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getHistory>>>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    listBenchmarks()
      .then((list) => setBenchmarks(list ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '加载 Benchmark 库失败'))
      .finally(() => setLoading(false));
  }, [loggedIn]);

  const selectBenchmark = (b: BenchmarkSummary) => {
    setSelected(b);
    setDetailLoading(true);
    setError('');
    Promise.all([getLeaderboard(b.name), getHistory({ benchmark: b.name })])
      .then(([boardRows, historyRows]) => {
        setBoard(boardRows ?? []);
        setHistory(historyRows ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '加载基准详情失败'))
      .finally(() => setDetailLoading(false));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Benchmark 库</h1>
          <p className="text-muted-foreground">
            平台已注册的安全评测基准数据集，查看各模型表现并对比历史数据。
          </p>
        </div>

        {!loggedIn ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Database className="h-12 w-12 text-slate-300" />
              <p className="text-slate-600">登录后即可浏览 Benchmark 库并查看评测结果。</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-white hover:bg-blue-700"
              >
                <LogIn className="h-4 w-4" /> 前往登录
              </Link>
            </CardContent>
          </Card>
        ) : selected ? (
          <div>
            <button
              onClick={() => setSelected(null)}
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> 返回 Benchmark 库
            </button>

            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-foreground">{selected.name}</h2>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                    {taskTypeLabel(selected.task_type)}
                  </Badge>
                </div>
                {selected.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                ) : null}
              </div>
              <Link to={`/assessment?benchmark=${encodeURIComponent(selected.name)}`}>
                <Button className="bg-primary text-white hover:bg-blue-700">
                  <Play className="mr-2 h-4 w-4" /> 运行评测
                </Button>
              </Link>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: '参与模型', value: String(selected.model_count), icon: <Users className="h-5 w-5" /> },
                { label: '评测运行', value: String(selected.run_count), icon: <BarChart3 className="h-5 w-5" /> },
                { label: '历史最高分', value: toPercent(selected.best_score), icon: <Trophy className="h-5 w-5" /> },
                { label: '最近得分', value: toPercent(selected.latest_score), icon: <Database className="h-5 w-5" /> },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600">{s.icon}</div>
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-bold text-foreground">{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {error ? (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>排行榜</CardTitle>
                  <CardDescription>各模型在该基准上的最新得分排名。</CardDescription>
                </CardHeader>
                <CardContent>
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-10 text-slate-500">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…
                    </div>
                  ) : board.length === 0 ? (
                    <div className="py-6 text-sm text-slate-500">该基准暂无评测结果。</div>
                  ) : (
                    <div className="space-y-2">
                      {board.map((m) => (
                        <div
                          key={m.model_name}
                          className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
                        >
                          <RankBadge rank={m.rank} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{m.model_name}</span>
                              {m.provider ? (
                                <span className="text-xs text-slate-400">{m.provider}</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-400">{m.num_runs} 次运行</div>
                          </div>
                          <div className="text-lg font-bold text-blue-600">{toPercent(m.score)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>历史对比</CardTitle>
                  <CardDescription>该基准上各模型得分随时间/运行次数的变化。</CardDescription>
                </CardHeader>
                <CardContent>
                  <HistoryComparisonChart data={history} />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 正在加载 Benchmark 库…
              </div>
            ) : benchmarks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                  <Database className="h-12 w-12 text-slate-300" />
                  <p className="text-slate-600">
                    暂无可展示的 Benchmark。请先在「新建评测」中运行一次评测，或由管理员注册基准数据集。
                  </p>
                  <Link to="/assessment">
                    <Button className="bg-primary text-white hover:bg-blue-700">
                      <Play className="mr-2 h-4 w-4" /> 发起评测
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {benchmarks.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => selectBenchmark(b)}
                    className="text-left"
                  >
                    <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="truncate">{b.name}</span>
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                            {taskTypeLabel(b.task_type)}
                          </Badge>
                        </CardTitle>
                        {b.description ? (
                          <CardDescription className="line-clamp-2">{b.description}</CardDescription>
                        ) : null}
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-xs text-slate-500">模型</p>
                            <p className="text-lg font-bold text-foreground">{b.model_count}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-xs text-slate-500">最高分</p>
                            <p className="text-lg font-bold text-amber-600">{toPercent(b.best_score)}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-xs text-slate-500">运行</p>
                            <p className="text-lg font-bold text-foreground">{b.run_count}</p>
                          </div>
                        </div>
                        {b.last_run_at ? (
                          <p className="mt-3 text-xs text-slate-400">
                            最近评测：{new Date(b.last_run_at).toLocaleString('zh-CN')}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Benchmark;
