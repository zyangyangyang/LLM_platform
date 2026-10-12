import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import HistoryComparisonChart from '../components/HistoryComparisonChart';
import {
  Trophy,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Loader2,
  LogIn,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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

const toPercent = (v: number) => (v * 100).toFixed(1);

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
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-bold ${cls}`}
    >
      {rank}
    </div>
  );
}

function ChangeIndicator({ change }: { change?: number | null }) {
  if (change == null || Math.abs(change) < 0.00005) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Minus className="h-3.5 w-3.5" /> 持平
      </span>
    );
  }
  if (change > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <ArrowUp className="h-3.5 w-3.5" /> +{toPercent(change)}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-600">
      <ArrowDown className="h-3.5 w-3.5" /> {toPercent(change)}%
    </span>
  );
}

const Ranking: React.FC = () => {
  const loggedIn = useMemo(() => Boolean(getAccessToken()), []);
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>([]);
  const [overall, setOverall] = useState<LeaderboardEntry[]>([]);
  const [benchmarkBoard, setBenchmarkBoard] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getHistory>>>([]);
  const [activeTab, setActiveTab] = useState('overall');
  const [historyBenchmark, setHistoryBenchmark] = useState('');
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [benchList, board] = await Promise.all([listBenchmarks(), getLeaderboard()]);
        setBenchmarks(benchList ?? []);
        setOverall(board ?? []);
        if (benchList?.length) setHistoryBenchmark(benchList[0].name);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '加载排行榜失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loggedIn]);

  // 选中某个基准时加载其专项排行榜
  useEffect(() => {
    if (!loggedIn || activeTab === 'overall' || activeTab === 'history') return;
    setBoardLoading(true);
    getLeaderboard(activeTab)
      .then((board) => setBenchmarkBoard(board ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '加载专项排行榜失败'))
      .finally(() => setBoardLoading(false));
  }, [activeTab, loggedIn]);

  // 历史对比：加载所选基准下的所有模型运行记录
  useEffect(() => {
    if (!loggedIn || activeTab !== 'history' || !historyBenchmark) return;
    getHistory({ benchmark: historyBenchmark })
      .then((rows) => setHistory(rows ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '加载历史数据失败'));
  }, [activeTab, historyBenchmark, loggedIn]);

  const renderTable = (entries: LeaderboardEntry[], showBreakdown: boolean) => {
    if (entries.length === 0) {
      return <div className="p-6 text-sm text-slate-500">暂无评测数据，请先完成至少一次评测。</div>;
    }
    return (
      <div className="space-y-3">
        {entries.map((m) => (
          <Card key={m.model_name} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <RankBadge rank={m.rank} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{m.model_name}</h3>
                    {m.provider ? (
                      <Badge variant="outline" className="text-xs">{m.provider}</Badge>
                    ) : null}
                    <ChangeIndicator change={m.change} />
                    <span className="text-xs text-slate-400">
                      {m.num_runs} 次运行 · 最近 {m.last_run_at ? new Date(m.last_run_at).toLocaleDateString('zh-CN') : '-'}
                    </span>
                  </div>
                  {showBreakdown && m.benchmark_scores.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.benchmark_scores.map((b) => (
                        <div
                          key={b.benchmark_name}
                          className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600"
                        >
                          <span className="font-medium">{b.benchmark_name}</span>
                          <span className="ml-1 text-blue-600 font-semibold">{toPercent(b.score)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold text-blue-600">{toPercent(m.score)}</div>
                  <div className="text-xs text-slate-500">
                    {activeTab === 'overall' ? '综合得分' : '本基准得分'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">大模型安全排行榜</h1>
          <p className="text-muted-foreground">
            基于平台真实评测数据，展示各模型在综合安全性与各基准上的表现排名。
          </p>
        </div>

        {!loggedIn ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Trophy className="h-12 w-12 text-slate-300" />
              <p className="text-slate-600">登录后即可查看安全排行榜与历史对比数据。</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-white hover:bg-blue-700"
              >
                <LogIn className="h-4 w-4" /> 前往登录
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {error ? (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 正在加载排行榜…
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-white p-1 border border-border rounded-xl shadow-sm mb-8">
                  <TabsTrigger value="overall" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <Trophy className="mr-1 h-4 w-4" /> 综合榜
                  </TabsTrigger>
                  {benchmarks.map((b) => (
                    <TabsTrigger
                      key={b.name}
                      value={b.name}
                      className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                    >
                      {b.name}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="history" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <BarChart3 className="mr-1 h-4 w-4" /> 历史对比
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overall" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-yellow-500" /> 综合安全性排行榜
                      </CardTitle>
                      <CardDescription>模型在所有基准上的平均得分排名（越高越安全）。</CardDescription>
                    </CardHeader>
                    <CardContent>{renderTable(overall, true)}</CardContent>
                  </Card>
                </TabsContent>

                {benchmarks.map((b) => (
                  <TabsContent key={b.name} value={b.name} className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>{b.name} 排行榜</CardTitle>
                        <CardDescription>
                          {taskTypeLabel(b.task_type)} · 共 {b.model_count} 个模型 · {b.run_count} 次运行
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {boardLoading ? (
                          <div className="flex items-center justify-center py-10 text-slate-500">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…
                          </div>
                        ) : (
                          renderTable(benchmarkBoard, false)
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}

                <TabsContent value="history" className="mt-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-6 w-6 text-blue-600" /> 历史数据对比
                        </CardTitle>
                        <CardDescription>
                          对比各模型在同一基准上的得分变化趋势（按评测运行次数展开）。
                        </CardDescription>
                      </div>
                      <select
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                        value={historyBenchmark}
                        onChange={(e) => setHistoryBenchmark(e.target.value)}
                      >
                        {benchmarks.map((b) => (
                          <option key={b.name} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </CardHeader>
                    <CardContent>
                      <HistoryComparisonChart data={history} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Ranking;
