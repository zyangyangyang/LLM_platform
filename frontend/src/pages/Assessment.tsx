import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { 
  ShieldAlert, ShieldCheck, FileSearch, Upload, Info, Check, Play 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';

const Assessment: React.FC = () => {
  const [activeTab, setActiveTab] = useState("attack");
  const [loading, setLoading] = useState(false);

  const handleStart = () => {
    setLoading(true);
    // Simulate API delay
    setTimeout(() => {
        window.location.href = '/results';
    }, 2000);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      {/* 背景装饰图案 */}
      <div className="pointer-events-none absolute inset-0">
        {/* 左上角淡蓝色光晕 */}
        <div className="absolute -top-32 -left-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl" />
        {/* 右下角淡紫色光晕 */}
        <div className="absolute bottom-[-120px] right-[-80px] w-[420px] h-[420px] bg-indigo-200/40 rounded-full blur-3xl" />
        {/* 中间偏右的渐变矩形 */}
        <div className="absolute top-1/3 right-16 w-64 h-64 bg-gradient-to-br from-sky-100/70 to-blue-100/40 rounded-3xl rotate-6 blur-sm border border-white/40" />
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
        <div className="absolute top-1/3 left-1/5 grid grid-cols-5 gap-3 opacity-40 text-sky-300">
          {Array.from({ length: 15 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-sky-300" />
          ))}
        </div>
        <div className="absolute bottom-24 right-32 grid grid-cols-4 gap-3 opacity-40 text-indigo-300">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
          ))}
        </div>
      </div>

      <Navbar />

      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">新建评测任务</h1>
          <p className="text-muted-foreground mt-2">
            配置评测目标、攻击方式与检测维度，启动针对大模型的安全评估流程。
          </p>
        </div>

        <Tabs defaultValue="attack" value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Custom Tabs List */}
          <TabsList className="grid w-full grid-cols-3 h-16 p-1 bg-white border border-border rounded-xl shadow-sm mb-8">
            <TabsTrigger value="attack" className="h-full data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:shadow-none rounded-lg text-base font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> 攻击测试 (Attack)
            </TabsTrigger>
            <TabsTrigger value="defense" className="h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none rounded-lg text-base font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> 防御评估 (Defense)
            </TabsTrigger>
            <TabsTrigger value="evaluate" className="h-full data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 data-[state=active]:shadow-none rounded-lg text-base font-medium flex items-center gap-2">
              <FileSearch className="w-4 h-4" /> 综合合规 (Evaluate)
            </TabsTrigger>
          </TabsList>

          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-6">
              <CardTitle className="flex items-center gap-2">
                {activeTab === 'attack' && <span className="text-red-600">配置红队演练参数</span>}
                {activeTab === 'defense' && <span className="text-blue-600">配置防御护栏规则</span>}
                {activeTab === 'evaluate' && <span className="text-purple-600">选择合规评估标准</span>}
              </CardTitle>
              <CardDescription>
                请根据实际需求填写以下配置，标有 * 的为必填项。
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* Target Model Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="model-select">目标评测模型 *</Label>
                  <Select>
                    <SelectTrigger id="model-select" className="bg-white">
                      <SelectValue placeholder="选择要评测的模型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4 (OpenAI)</SelectItem>
                      <SelectItem value="claude-3">Claude 3 (Anthropic)</SelectItem>
                      <SelectItem value="llama-2-7b">LLaMA 2 7B (Meta)</SelectItem>
                      <SelectItem value="custom-api">Custom API Endpoint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dataset">测试数据集 *</Label>
                   <Select>
                    <SelectTrigger id="dataset" className="bg-white">
                      <SelectValue placeholder="选择基准测试集" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default-bench">Standard Security Bench v1.0</SelectItem>
                      <SelectItem value="adv-glue">Adversarial GLUE</SelectItem>
                      <SelectItem value="real-toxic">RealToxicPrompts</SelectItem>
                      <SelectItem value="custom-upload">上传自定义数据集...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Specific Dimensions Checkboxes */}
              <div className="space-y-3">
                <Label>评测维度选择</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Hallucination */}
                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => {}}>
                    <Checkbox id="dim-hallucination" defaultChecked />
                    <div className="grid gap-1.5 leading-none">
                      <label htmlFor="dim-hallucination" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                        幻觉检测 (Hallucination)
                      </label>
                      <p className="text-xs text-muted-foreground">
                        检测模型在事实性问答中的编造行为。
                      </p>
                    </div>
                  </div>

                  {/* Adversarial */}
                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => {}}>
                    <Checkbox id="dim-adversarial" defaultChecked />
                    <div className="grid gap-1.5 leading-none">
                      <label htmlFor="dim-adversarial" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                        对抗攻击 (Adversarial)
                      </label>
                      <p className="text-xs text-muted-foreground">
                        通过微扰动样本测试模型鲁棒性。
                      </p>
                    </div>
                  </div>

                  {/* Prompt Injection */}
                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => {}}>
                    <Checkbox id="dim-injection" defaultChecked />
                    <div className="grid gap-1.5 leading-none">
                      <label htmlFor="dim-injection" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                        提示词注入 (Prompt Injection)
                      </label>
                      <p className="text-xs text-muted-foreground">
                         DAN 模式、角色扮演等越狱攻击测试。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Settings (Simplified) */}
              <div className="space-y-3 pt-4 border-t border-border">
                <Label>高级参数</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="temperature" className="text-xs font-normal text-muted-foreground">Temperature (0-1)</Label>
                        <Input id="temperature" type="number" placeholder="0.7" className="bg-white" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="max-tokens" className="text-xs font-normal text-muted-foreground">Max Tokens</Label>
                        <Input id="max-tokens" type="number" placeholder="2048" className="bg-white" />
                    </div>
                </div>
              </div>

               {/* Prompt Upload Area */}
               <div className="space-y-2">
                  <Label>自定义攻击 Prompt (可选)</Label>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer">
                     <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                     <p className="text-sm text-foreground font-medium">点击上传 CSV/JSONL 文件</p>
                     <p className="text-xs text-muted-foreground mt-1">支持批量导入自定义攻击提示词</p>
                  </div>
               </div>

            </CardContent>
            
            <CardFooter className="bg-slate-50/50 border-t border-gray-100 p-6 flex justify-between items-center">
               <div className="flex items-center text-xs text-muted-foreground gap-1">
                  <Info className="w-4 h-4" />
                  本次评测预计消耗 500 Credits
               </div>
               <div className="flex gap-3">
                  <Link to="/dashboard">
                     <Button variant="outline" className="bg-white">取消</Button>
                  </Link>
                  <Button 
                    className={`${
                        activeTab === 'attack' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 
                        activeTab === 'defense' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 
                        'bg-purple-600 hover:bg-purple-700 shadow-purple-100'
                    } text-white min-w-[140px] shadow-custom`}
                    onClick={handleStart}
                    disabled={loading}
                  >
                    {loading ? (
                       <>
                         <span className="animate-spin mr-2">⟳</span> 初始化中...
                       </>
                    ) : (
                       <>
                         <Play className="w-4 h-4 mr-2" /> 开始评测
                       </>
                    )}
                  </Button>
               </div>
            </CardFooter>
          </Card>
        </Tabs>
      </main>
    </div>
  );
};

export default Assessment;