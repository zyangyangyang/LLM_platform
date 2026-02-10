import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { Trophy, Shield, AlertTriangle, Lock, Eye, FileText, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'react-router-dom';

interface ModelRanking {
  rank: number;
  name: string;
  score: number;
  change: number; // -1: down, 0: same, 1: up
  provider: string;
  details: {
    promptInjection: number;
    contentSafety: number;
    dataPrivacy: number;
    biasFairness: number;
    robustness: number;
  };
}

const Ranking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'overall';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'overall';
    setActiveTab(tab);
  }, [searchParams]);

  // 模拟数据
  const overallRankings: ModelRanking[] = [
    {
      rank: 1,
      name: 'GPT-4',
      score: 95.8,
      change: 1,
      provider: 'OpenAI',
      details: {
        promptInjection: 98,
        contentSafety: 96,
        dataPrivacy: 94,
        biasFairness: 95,
        robustness: 96
      }
    },
    {
      rank: 2,
      name: 'Claude 3 Opus',
      score: 94.2,
      change: 0,
      provider: 'Anthropic',
      details: {
        promptInjection: 97,
        contentSafety: 95,
        dataPrivacy: 93,
        biasFairness: 94,
        robustness: 92
      }
    },
    {
      rank: 3,
      name: 'Qwen-Plus',
      score: 91.5,
      change: 1,
      provider: 'Alibaba',
      details: {
        promptInjection: 92,
        contentSafety: 91,
        dataPrivacy: 90,
        biasFairness: 92,
        robustness: 92
      }
    },
    {
      rank: 4,
      name: 'Gemini Pro',
      score: 89.3,
      change: -1,
      provider: 'Google',
      details: {
        promptInjection: 90,
        contentSafety: 89,
        dataPrivacy: 88,
        biasFairness: 90,
        robustness: 89
      }
    },
    {
      rank: 5,
      name: 'LLaMA 2 70B',
      score: 87.1,
      change: 0,
      provider: 'Meta',
      details: {
        promptInjection: 88,
        contentSafety: 86,
        dataPrivacy: 87,
        biasFairness: 88,
        robustness: 86
      }
    },
    {
      rank: 6,
      name: 'ChatGLM-6B',
      score: 84.6,
      change: 1,
      provider: 'Zhipu AI',
      details: {
        promptInjection: 85,
        contentSafety: 84,
        dataPrivacy: 83,
        biasFairness: 85,
        robustness: 86
      }
    },
    {
      rank: 7,
      name: 'Baichuan-13B',
      score: 82.3,
      change: -1,
      provider: 'Baichuan',
      details: {
        promptInjection: 83,
        contentSafety: 81,
        dataPrivacy: 82,
        biasFairness: 83,
        robustness: 82
      }
    },
    {
      rank: 8,
      name: 'Yi-34B',
      score: 80.5,
      change: 0,
      provider: '01.AI',
      details: {
        promptInjection: 81,
        contentSafety: 80,
        dataPrivacy: 79,
        biasFairness: 81,
        robustness: 81
      }
    }
  ];

  const getRankingsByCategory = (category: string): ModelRanking[] => {
    return [...overallRankings].sort((a, b) => {
      const scoreA = a.details[category as keyof typeof a.details] || 0;
      const scoreB = b.details[category as keyof typeof b.details] || 0;
      return scoreB - scoreA;
    }).map((model, index) => ({
      ...model,
      rank: index + 1,
      score: model.details[category as keyof typeof model.details] || 0
    }));
  };

  const getCategoryName = (key: string): string => {
    const names: Record<string, string> = {
      overall: '综合安全性',
      promptInjection: '提示词注入防御',
      contentSafety: '内容合规检测',
      dataPrivacy: '数据隐私保护',
      biasFairness: '偏见与公平性',
      robustness: '鲁棒性压力测试'
    };
    return names[key] || key;
  };

  const getCategoryIcon = (key: string) => {
    const icons: Record<string, React.ReactNode> = {
      overall: <Trophy className="w-5 h-5" />,
      promptInjection: <Shield className="w-5 h-5" />,
      contentSafety: <AlertTriangle className="w-5 h-5" />,
      dataPrivacy: <Lock className="w-5 h-5" />,
      biasFairness: <Eye className="w-5 h-5" />,
      robustness: <FileText className="w-5 h-5" />
    };
    return icons[key] || <Trophy className="w-5 h-5" />;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (change < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rank === 2) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const renderRankingTable = (rankings: ModelRanking[]) => {
    return (
      <div className="space-y-3">
        {rankings.map((model) => (
          <Card key={model.name} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-lg border-2 font-bold text-lg ${getRankColor(model.rank)}`}>
                    {model.rank}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">{model.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {model.provider}
                      </Badge>
                      {getChangeIcon(model.change)}
                    </div>
                    {activeTab === 'overall' && (
                      <div className="mt-2 grid grid-cols-5 gap-2 text-xs">
                        <div className="text-gray-600">
                          <span className="font-medium">注入防御:</span> {model.details.promptInjection}
                        </div>
                        <div className="text-gray-600">
                          <span className="font-medium">内容合规:</span> {model.details.contentSafety}
                        </div>
                        <div className="text-gray-600">
                          <span className="font-medium">隐私保护:</span> {model.details.dataPrivacy}
                        </div>
                        <div className="text-gray-600">
                          <span className="font-medium">公平性:</span> {model.details.biasFairness}
                        </div>
                        <div className="text-gray-600">
                          <span className="font-medium">鲁棒性:</span> {model.details.robustness}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{model.score.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">综合得分</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const categories = [
    { key: 'overall', name: '综合安全性', icon: Trophy },
    { key: 'promptInjection', name: '提示词注入防御', icon: Shield },
    { key: 'contentSafety', name: '内容合规检测', icon: AlertTriangle },
    { key: 'dataPrivacy', name: '数据隐私保护', icon: Lock },
    { key: 'biasFairness', name: '偏见与公平性', icon: Eye },
    { key: 'robustness', name: '鲁棒性压力测试', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">大模型安全排行榜</h1>
          <p className="text-muted-foreground">
            基于平台评测数据，展示各大模型在安全性各维度的表现排名
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-white border border-border rounded-xl shadow-sm mb-8">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger
                  key={category.key}
                  value={category.key}
                  className="flex items-center gap-2 text-sm font-medium data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 py-3"
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{category.name}</span>
                  <span className="lg:hidden">{category.name.split(' ')[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="overall" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  综合安全性排行榜
                </CardTitle>
                <CardDescription>
                  基于多维度安全评测的综合得分排名
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderRankingTable(overallRankings)}
              </CardContent>
            </Card>
          </TabsContent>

          {categories.slice(1).map((category) => (
            <TabsContent key={category.key} value={category.key} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getCategoryIcon(category.key)}
                    {category.name}排行榜
                  </CardTitle>
                  <CardDescription>
                    {category.name}维度的专项排名
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderRankingTable(getRankingsByCategory(category.key))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
};

export default Ranking;
