import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import FeatureCard from '../components/FeatureCard';
import StatsSection from '../components/StatsSection';
import Footer from '../components/Footer';
import { ShieldAlert, Eye, FileText, Database, Lock, GanttChartSquare } from 'lucide-react';

const Home: React.FC = () => {
    // Import all icons needed for this array
    // ShieldAlert, Eye, FileText, Database, Lock, GanttChartSquare are imported above

  const features = [
    {
      icon: ShieldAlert,
      title: "提示词注入防御",
      description: "应用先进的语义分析技术，实时检测并防御各类 Prompt Injection 攻击，确保模型输出安全可控。"
    },
    {
      icon: Eye,
      title: "内容合规检测",
      description: "多维度的内容审核机制，自动识别涉黄、涉暴、涉政等违规内容，符合国内外安全监管要求。"
    },
    {
      icon: Database,
      title: "数据隐私保护",
      description: "针对 PII（个人身份信息）进行深度扫描与脱敏处理，防止大模型训练与推理过程中的数据泄露。"
    },
    {
      icon: GanttChartSquare,
      title: "偏见与公平性评估",
      description: "系统化评估模型在性别、种族、地域等维度的表现，量化偏见指标，推动 AI 公平性建设。"
    },
    {
      icon: FileText,
      title: "自动化评测报告",
      description: "一键生成专家级安全评测报告，包含详细的漏洞分析、风险评级及修复建议，支持 PDF 导出。"
    },
    {
      icon: Lock,
      title: "鲁棒性压力测试",
      description: "通过高强度的对抗样本库进行压力测试，评估模型在恶意输入下的稳定性与抗干扰能力。"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main>
        <Hero />
        
        {/* Features Grid */}
        <section id="services" className="py-24 bg-white">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
                全方位的大模型安全解决方案
              </h2>
              <p className="text-lg text-muted-foreground">
                覆盖模型全生命周期，从数据准备到模型部署，我们为您提供无死角的安全保障体系。
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <FeatureCard 
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>
          </div>
        </section>

        <StatsSection />

        {/* CTA Section */}
        <section className="py-24 bg-gray-50">
           <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
             <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
               {/* Decorative circles */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2"></div>
               <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -translate-x-1/3 translate-y-1/3"></div>
               
               <div className="relative z-10 max-w-3xl mx-auto">
                 <h2 className="text-3xl md:text-4xl font-bold mb-6">准备好提升您的大模型安全性了吗？</h2>
                 <p className="text-blue-100 text-lg mb-8">
                   立即注册即可获得免费的初步安全扫描报告，让您的 AI 之路行稳致远。
                 </p>
                 <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button className="px-8 py-3 bg-white text-blue-700 rounded-lg font-bold hover:bg-gray-100 transition-colors shadow-lg">
                      立即免费试用
                    </button>
                    <button className="px-8 py-3 bg-transparent border border-white/40 text-white rounded-lg font-medium hover:bg-white/10 transition-colors">
                      联系销售团队
                    </button>
                 </div>
               </div>
             </div>
           </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;