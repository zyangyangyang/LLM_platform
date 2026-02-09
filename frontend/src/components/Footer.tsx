import React from 'react';
import { ShieldCheck, Github, Twitter, Linkedin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer data-cmp="Footer" className="bg-slate-50 border-t border-border pt-16 pb-8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <ShieldCheck className="text-white w-4 h-4" />
              </div>
              <span className="text-lg font-bold text-foreground">智安 · 评测</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              致力于为全球企业提供最专业的 AI 大模型安全评估服务与解决方案。
            </p>
            <div className="flex space-x-4">
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-blue-50 border border-border cursor-pointer transition-colors">
                <Github size={16} />
              </span>
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-blue-50 border border-border cursor-pointer transition-colors">
                <Twitter size={16} />
              </span>
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-blue-50 border border-border cursor-pointer transition-colors">
                <Linkedin size={16} />
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">产品服务</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">模型安全评测</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">红队对抗演练</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">合规性扫描</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">API 安全网关</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">资源中心</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">技术文档</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">行业白皮书</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">安全博客</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">漏洞数据库</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">联系支持</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">帮助中心</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">商务合作</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">support@secureeval.ai</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">+86 10 1234 5678</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; 2024 SecureEval AI. 保留所有权利。</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-foreground">隐私政策</a>
            <a href="#" className="hover:text-foreground">服务条款</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;