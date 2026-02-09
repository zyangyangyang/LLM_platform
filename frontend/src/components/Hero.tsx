import React from 'react';
import { ArrowRight, ShieldCheck, Database, Lock, Server } from 'lucide-react';
import { Link } from 'react-router-dom';

const Hero: React.FC = () => {
  return (
    <div data-cmp="Hero" className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white pt-20 pb-24 md:pt-32 md:pb-32">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-[1440px] z-0 pointer-events-none">
        <div className="absolute top-20 right-[-10%] w-[600px] h-[600px] bg-blue-200/20 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-[-10%] w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-blue-700 text-sm font-medium animate-fadeIn">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2"></span>
              全新一代大模型安全评测引擎
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              构建可信赖的 <br />
              <span className="text-primary">人工智能未来</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
              提供全方位的 LLM 安全评估服务，涵盖内容安全、数据隐私、偏见检测及对抗攻击防御，助您打造合规、鲁棒的 AI 应用。
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white rounded-lg font-medium shadow-custom hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center"
              >
                开始评测 <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
              <button className="w-full sm:w-auto px-8 py-3.5 bg-white text-foreground border border-border rounded-lg font-medium hover:bg-secondary hover:text-primary transition-all duration-200">
                查看演示
              </button>
            </div>
            
            <div className="pt-8 flex items-center justify-center lg:justify-start gap-8 text-muted-foreground/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> <span>ISO 27001 认证</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5" /> <span>本地化部署</span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto lg:ml-auto w-full max-w-lg lg:max-w-xl">
             <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 relative z-10 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                   <div className="flex space-x-2">
                     <div className="w-3 h-3 rounded-full bg-red-400"></div>
                     <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                     <div className="w-3 h-3 rounded-full bg-green-400"></div>
                   </div>
                   <div className="text-xs text-gray-400 font-mono">Analysis_Report_v2.0.pdf</div>
                </div>
                
                <div className="space-y-4">
                   <div className="flex items-start gap-4 p-3 rounded-lg bg-blue-50/50">
                      <div className="p-2 bg-blue-100 rounded-md text-blue-600">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">Prompt Injection Detected</h4>
                        <p className="text-xs text-gray-500 mt-1">High risk pattern identified in input vectors.</p>
                      </div>
                      <span className="ml-auto text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">High</span>
                   </div>

                   <div className="flex items-start gap-4 p-3 rounded-lg bg-white border border-gray-100">
                      <div className="p-2 bg-green-100 rounded-md text-green-600">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">PII Leakage Check</h4>
                        <p className="text-xs text-gray-500 mt-1">No personal identifiable information found.</p>
                      </div>
                      <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Pass</span>
                   </div>

                   <div className="flex items-start gap-4 p-3 rounded-lg bg-white border border-gray-100">
                      <div className="p-2 bg-purple-100 rounded-md text-purple-600">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800">Model Robustness</h4>
                        <p className="text-xs text-gray-500 mt-1">Stress testing completed across 5000 samples.</p>
                      </div>
                      <span className="ml-auto text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">98%</span>
                   </div>
                   
                   <div className="mt-6 pt-4 border-t border-gray-100">
                      <div className="flex justify-between text-sm mb-2">
                         <span className="text-gray-500">System Status</span>
                         <span className="text-green-600 font-medium">Optimal</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full w-[92%]"></div>
                      </div>
                   </div>
                </div>
             </div>
             
             {/* Decorative stacked card */}
             <div className="absolute top-4 left-4 w-full h-full bg-blue-600 rounded-2xl -z-10 opacity-10 transform rotate-3"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;