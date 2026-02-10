import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { Mail, Lock, CheckCircle, ArrowRight, Scale } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getAccessToken, loginWithPassword, saveAccessToken } from '../lib/auth';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [token, setToken] = useState<string>(() => getAccessToken() || '');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const data = await loginWithPassword(email, password);
      saveAccessToken(data.access_token);
      setToken(data.access_token);
      console.log('Login success');
      // 登录成功后跳转到 dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || '登录失败');
      } else {
        setError('登录失败');
      }
      console.error('Login failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navbar - 透明白色渐变 */}
      <div className="relative z-50">
        <Navbar />
      </div>
      
      {/* 全屏背景层 - 覆盖整个页面 */}
      <div className="fixed top-0 inset-x-0 bottom-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white overflow-hidden">
        {/* 装饰性渐变圆形 */}
        <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-blue-600/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-indigo-600/30 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]"></div>
        
        {/* 网格图案装饰 */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
        
        {/* 几何图形装饰 */}
        <div className="absolute top-20 left-20 w-32 h-32 border-2 border-blue-400/30 rounded-lg rotate-45"></div>
        <div className="absolute bottom-32 right-32 w-24 h-24 border-2 border-indigo-400/30 rounded-full"></div>
        <div className="absolute top-1/3 right-1/4 w-16 h-16 border-2 border-purple-400/30 rotate-12"></div>
        
        {/* 天秤图案 - 居中显示 */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-0">
          <Scale 
            className="w-64 h-64 text-white/10 lg:w-96 lg:h-96" 
            strokeWidth={1.5}
            style={{
              filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.1))'
            }}
          />
        </div>
        
        {/* 左侧内容 - 作为背景装饰，文字中偏上，放大并往中间靠 */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-1/2 flex flex-col justify-start px-16 xl:px-24 pt-24 relative z-10">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-5xl font-bold mb-8 leading-tight text-white/90">
              专业的安全评测<br />守护您的 AI 创新
            </h2>
            <p className="text-slate-300/80 text-xl mb-10 leading-relaxed">
              加入数千家企业，使用 SecureEval AI 确保大模型的安全性、合规性与鲁棒性。
            </p>
            
            <div className="space-y-5">
              {[
                "符合 ISO 27001、SOC2 标准",
                "全天候 24/7 实时监控与威胁阻断",
                "支持私有化部署，数据零泄露"
              ].map((item, i) => (
                <div key={i} className="flex items-center space-x-3 text-slate-200/80 text-lg">
                  <CheckCircle className="text-green-400 w-6 h-6 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-14 p-8 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <p className="italic text-slate-300/80 text-lg">
                "智安评测平台帮助我们发现了潜在的数据泄露风险，是目前市面上最专业的 LLM 安全工具。"
              </p>
              <div className="mt-5 flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500"></div>
                <div>
                  <div className="font-medium text-lg">张伟</div>
                  <div className="text-sm text-slate-400">某头部 AI 独角兽 CTO</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 登录卡片 - 浮动在背景上，位置不变，放大 */}
      <div className="relative z-40 flex-1 flex items-center justify-center lg:justify-end p-4 sm:p-8 min-h-[calc(100vh-64px)]">
        <div className="w-full max-w-lg space-y-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-10 border border-white/20 lg:mr-16 xl:mr-24">
          <div className="text-center lg:text-left">
            <h2 className="text-4xl font-bold text-gray-900">欢迎回来</h2>
            <p className="mt-3 text-gray-600 text-lg">请输入您的账号信息以访问评测控制台</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-7">
            <div>
              <label htmlFor="email" className="block text-base font-medium text-gray-700 mb-2">
                工作邮箱
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-6 w-6 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-12 pr-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-gray-900 text-base"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-base font-medium text-gray-700">
                  密码
                </label>
                <a href="#" className="text-base font-medium text-blue-600 hover:text-blue-500">
                  忘记密码？
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-6 w-6 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-12 pr-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-gray-900 text-base"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-base text-gray-900">
                30天内自动登录
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-custom text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  登录中...
                </span>
              ) : (
                <span className="flex items-center">
                  立即登录 <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700">
              {error}
            </div>
          ) : null}

          {token ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div className="text-base font-medium text-emerald-800">登录成功！正在跳转...</div>
            </div>
          ) : null}

          <div className="mt-10 border-t border-gray-200 pt-6">
            <p className="text-center text-base text-gray-600">
              还没有账号？{' '}
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                申请企业试用
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
