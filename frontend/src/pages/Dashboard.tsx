import React from 'react';
import Navbar from '../components/Navbar';
import { 
  ShieldAlert, 
  ShieldCheck, 
  FileSearch, 
  Activity, 
  ArrowRight, 
  AlertTriangle,
  Zap,
  Lock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
    // Icons used: ShieldAlert, ShieldCheck, FileSearch, Activity, ArrowRight, AlertTriangle, Zap, Lock
 
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      {/* 背景装饰图案 */}
      <div className="pointer-events-none absolute inset-0">
        {/* 左上角淡蓝色光晕 */}
        <div className="absolute -top-32 -left-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl" />
        {/* 右下角淡紫色光晕 */}
        <div className="absolute bottom-[-120px] right-[-80px] w-[420px] h-[420px] bg-indigo-200/40 rounded-full blur-3xl" />
        {/* 左侧渐变矩形 */}
        <div className="absolute top-1/4 left-16 w-64 h-64 bg-gradient-to-br from-sky-100/70 to-blue-100/40 rounded-3xl -rotate-6 blur-sm border border-white/40" />
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
        <div className="absolute top-24 right-1/4 grid grid-cols-6 gap-3 opacity-40 text-sky-300">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-sky-300" />
          ))}
        </div>
        <div className="absolute bottom-28 left-1/3 grid grid-cols-5 gap-3 opacity-40 text-indigo-300">
          {Array.from({ length: 15 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
          ))}
        </div>
      </div>

      <Navbar />
      
      <main className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">欢迎回来，安全管理员</h1>
            <p className="text-muted-foreground mt-1">这里是您的AI安全态势感知中心。</p>
          </div>
          <div className="flex gap-3">
            <Link to="/assessment">
                <Button className="bg-primary hover:bg-blue-700 shadow-custom text-white">
                <Zap className="mr-2 h-4 w-4" /> 快速评测
                </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: "已评测模型", value: "12", icon: activityIcon, color: "bg-blue-100 text-blue-600" },
            { label: "发现高危漏洞", value: "3", icon: alertIcon, color: "bg-red-100 text-red-600" },
            { label: "整体安全评分", value: "85", icon: shieldIcon, color: "bg-green-100 text-green-600" },
            { label: "今日API调用", value: "1.2k", icon: zapIcon, color: "bg-purple-100 text-purple-600" }
          ].map((stat, i) => (
             <Card key={i} className="border-border shadow-sm hover:shadow-md transition-shadow">
               <CardContent className="p-6 flex items-center space-x-4">
                 <div className={`p-3 rounded-lg ${stat.color}`}>
                   {stat.icon}
                 </div>
                 <div>
                   <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                   <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
                 </div>
               </CardContent>
             </Card>
          ))}
        </div>

        {/* Core Functions / Quick Access */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4 text-foreground">核心功能入口</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Attack/Red Teaming */}
            <Link to="/assessment?mode=attack" className="group">
              <Card className="h-full border-border shadow-sm hover:border-red-200 hover:shadow-custom transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full translate-x-8 -translate-y-8 group-hover:bg-red-100 transition-colors"></div>
                <CardHeader>
                  <CardTitle className="flex items-center text-red-700">
                    <ShieldAlert className="mr-2 h-5 w-5" /> 
                    红队攻击 (Attack)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    模拟真实世界的黑客攻击手法，对模型进行对抗性测试，挖掘潜在的提示词注入和越狱风险。
                  </p>
                  <div className="text-sm text-red-600 font-medium flex items-center group-hover:translate-x-1 transition-transform">
                    发起攻击测试 <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Defense/Guardrails */}
            <Link to="/assessment?mode=defense" className="group">
              <Card className="h-full border-border shadow-sm hover:border-blue-200 hover:shadow-custom transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full translate-x-8 -translate-y-8 group-hover:bg-blue-100 transition-colors"></div>
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-700">
                    <ShieldCheck className="mr-2 h-5 w-5" /> 
                    防御护栏 (Defense)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    配置并测试输入/输出过滤规则，建立强大的内容防火墙，拦截幻觉、偏见及有害内容的生成。
                  </p>
                  <div className="text-sm text-blue-600 font-medium flex items-center group-hover:translate-x-1 transition-transform">
                    配置防御策略 <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Evaluation */}
            <Link to="/assessment?mode=evaluate" className="group">
              <Card className="h-full border-border shadow-sm hover:border-purple-200 hover:shadow-custom transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full translate-x-8 -translate-y-8 group-hover:bg-purple-100 transition-colors"></div>
                <CardHeader>
                  <CardTitle className="flex items-center text-purple-700">
                    <FileSearch className="mr-2 h-5 w-5" /> 
                    综合评估 (Evaluate)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    全方位评估模型的安全性、公正性与合规性，生成符合监管要求的深度分析报告。
                  </p>
                  <div className="text-sm text-purple-600 font-medium flex items-center group-hover:translate-x-1 transition-transform">
                    开始综合评估 <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>

          </div>
        </div>

        {/* Recent Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2">
             <Card className="border-border shadow-sm">
               <CardHeader className="border-b border-gray-100 pb-4">
                 <div className="flex items-center justify-between">
                   <CardTitle className="text-lg">近期评测任务</CardTitle>
                   <Button variant="outline" size="sm" className="h-8 text-xs">查看全部</Button>
                 </div>
               </CardHeader>
               <CardContent className="pt-4">
                 <div className="space-y-4">
                   {[
                     { name: "LLaMA-2-7b 对抗基准测试", status: "已完成", risk: "中风险", date: "2024-03-20", type: "攻击" },
                     { name: "ChatGLM3 提示词注入专项", status: "进行中", risk: "检测中...", date: "2024-03-21", type: "评估" },
                     { name: "Qwen-14b 幻觉检测", status: "已完成", risk: "低风险", date: "2024-03-19", type: "防御" }
                   ].map((task, i) => (
                     <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                       <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                         <div className={`w-2 h-2 rounded-full ${task.status === '进行中' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                         <div>
                           <p className="font-medium text-sm text-foreground">{task.name}</p>
                           <p className="text-xs text-muted-foreground">{task.type} • {task.date}</p>
                         </div>
                       </div>
                       <div className="flex items-center space-x-3">
                         <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                           task.risk === '中风险' ? 'bg-orange-100 text-orange-700' : 
                           task.risk === '低风险' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'
                         }`}>
                           {task.risk}
                         </span>
                         <Link to="/results">
                           <Button variant="ghost" size="sm" className="h-8 text-xs">详情</Button>
                         </Link>
                       </div>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           </div>
           
           <div>
             <Card className="border-border shadow-sm h-full">
               <CardHeader>
                 <CardTitle className="text-lg">安全防护指数</CardTitle>
                 <CardDescription>过去 30 天模型防御成功率</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="flex items-center justify-center py-6">
                   <div className="relative w-40 h-40">
                     <svg className="w-full h-full" viewBox="0 0 100 100">
                       <circle className="text-gray-100 stroke-current" strokeWidth="10" cx="50" cy="50" r="40" fill="transparent"></circle>
                       <circle className="text-primary stroke-current" strokeWidth="10" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" strokeDasharray="251.2" strokeDashoffset="30" transform="rotate(-90 50 50)"></circle>
                     </svg>
                     <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                       <span className="text-3xl font-bold text-primary">88%</span>
                       <span className="text-xs text-muted-foreground">综合安全率</span>
                     </div>
                   </div>
                 </div>
                 <div className="space-y-3 mt-4">
                   <div>
                     <div className="flex justify-between text-xs mb-1">
                       <span>Prompt 注入拦截</span>
                       <span className="font-medium">92%</span>
                     </div>
                     <Progress value={92} className="h-2" />
                   </div>
                   <div>
                     <div className="flex justify-between text-xs mb-1">
                       <span>有害内容过滤</span>
                       <span className="font-medium">85%</span>
                     </div>
                     <Progress value={85} className="h-2" />
                   </div>
                 </div>
               </CardContent>
             </Card>
           </div>
        </div>

      </main>
    </div>
  );
};

// Helper constants for icons
const activityIcon = <Activity className="w-6 h-6" />;
const alertIcon = <AlertTriangle className="w-6 h-6" />;
const shieldIcon = <ShieldCheck className="w-6 h-6" />;
const zapIcon = <Zap className="w-6 h-6" />;

export default Dashboard;