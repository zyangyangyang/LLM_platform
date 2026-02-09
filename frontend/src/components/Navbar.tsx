import React from 'react';
import { ShieldCheck, Menu, X, LayoutDashboard, FileText, Play, Trophy, Shield, AlertTriangle, Lock, Eye, FileText as FileTextIcon, ChevronDown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [rankingOpen, setRankingOpen] = React.useState(false);
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  // Check if we are in "App Mode" (dashboard, assessment, results) to show different nav items
  const isAppMode = ['/dashboard', '/assessment', '/results'].some(path => location.pathname.startsWith(path));

  const publicLinks = [
    { name: '首页', path: '/' },
    { name: '评测服务', path: '/#services' },
    { name: '关于我们', path: '/#about' },
  ];

  const rankingMenus = [
    { name: '综合安全性', path: '/ranking?tab=overall', icon: Trophy },
    { name: '提示词注入防御', path: '/ranking?tab=promptInjection', icon: Shield },
    { name: '内容合规检测', path: '/ranking?tab=contentSafety', icon: AlertTriangle },
    { name: '数据隐私保护', path: '/ranking?tab=dataPrivacy', icon: Lock },
    { name: '偏见与公平性', path: '/ranking?tab=biasFairness', icon: Eye },
    { name: '鲁棒性压力测试', path: '/ranking?tab=robustness', icon: FileTextIcon },
  ];

  const appLinks = [
    { name: '控制台', path: '/dashboard', icon: LayoutDashboard },
    { name: '新建评测', path: '/assessment', icon: Play },
    { name: '评测报告', path: '/results', icon: FileText },
  ];

  return (
    <nav data-cmp="Navbar" className={`${isLoginPage ? 'bg-gradient-to-b from-white/40 via-white/20 to-white/5 backdrop-blur-md border-b border-white/20' : 'bg-white/90 backdrop-blur-md border-b border-border'} sticky top-0 z-50 w-full transition-all duration-300`}>
      <div className="max-w-[1440px] mx-auto px-2 sm:px-3 lg:px-4">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link to={isAppMode ? "/dashboard" : "/"} className="flex items-center space-x-2 group">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <span className={`text-2xl font-bold ${isLoginPage ? 'text-white drop-shadow-lg' : 'bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500'}`}>
              智安 · 评测
            </span>
          </Link>

          {/* Desktop Navigation */}
          {!isLoginPage && (
            <div className="hidden md:flex items-center space-x-8">
              {isAppMode ? (
                appLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`flex items-center space-x-2 text-lg font-medium transition-colors ${
                      location.pathname === link.path 
                        ? 'text-primary bg-blue-50 px-3 py-1.5 rounded-md' 
                        : 'text-muted-foreground hover:text-primary'
                    }`}
                  >
                    {link.icon && <link.icon className="w-6 h-6" />}
                    <span>{link.name}</span>
                  </Link>
                ))
              ) : (
                <>
                  {publicLinks.map((link) => (
                    <Link
                      key={link.name}
                      to={link.path}
                      className="text-muted-foreground hover:text-primary font-medium transition-colors text-lg tracking-wide"
                    >
                      {link.name}
                    </Link>
                  ))}
                  <DropdownMenu open={rankingOpen} onOpenChange={setRankingOpen}>
                    <div
                      className="relative"
                      onMouseEnter={() => setRankingOpen(true)}
                      onMouseLeave={() => setRankingOpen(false)}
                    >
                      <DropdownMenuTrigger className="text-muted-foreground hover:text-primary font-medium transition-colors text-lg tracking-wide flex items-center gap-1 outline-none data-[state=open]:text-primary">
                        排行榜
                        <ChevronDown className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64 py-2">
                        {rankingMenus.map((menu) => {
                          const Icon = menu.icon;
                          return (
                            <DropdownMenuItem
                              key={menu.path}
                              className="cursor-pointer px-3 py-2.5 text-base"
                              asChild
                            >
                              <Link to={menu.path} className="flex items-center gap-3 w-full">
                                <Icon className="w-5 h-5" />
                                <span>{menu.name}</span>
                              </Link>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </div>
                  </DropdownMenu>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {!isLoginPage && !isAppMode && (
              <>
                <Link to="/login" className="text-lg font-medium text-primary hover:text-blue-700 transition-colors">
                  登录
                </Link>
                <Link
                  to="/dashboard"
                  className="bg-primary text-white hover:bg-blue-700 px-5 py-2 rounded-md text-lg font-medium transition-colors shadow-custom hover:shadow-lg transform active:scale-95 duration-200"
                >
                  免费试用
                </Link>
              </>
            )}
             {isAppMode && (
               <div className="flex items-center space-x-4">
                 <Link to="/" className="text-lg font-medium text-muted-foreground hover:text-primary transition-colors">
                   返回首页
                 </Link>
                 <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-base font-bold ring-2 ring-white">
                   JD
                 </div>
               </div>
             )}
            {isLoginPage && (
                <Link to="/" className="text-lg text-white hover:text-white/80 flex items-center gap-1 drop-shadow-md font-medium">
                  返回首页
                </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 rounded-md focus:outline-none ${isLoginPage ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-secondary'}`}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && !isLoginPage && (
        <div className="md:hidden bg-background border-b border-border absolute w-full left-0">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {(isAppMode ? appLinks : publicLinks).map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className="block px-3 py-2 rounded-md text-lg font-medium text-muted-foreground hover:text-primary hover:bg-secondary"
                onClick={() => setIsOpen(false)}
              >
                 {link.name}
              </Link>
            ))}
            {!isAppMode && (
              <>
                <div className="px-3 py-2 text-lg font-semibold text-foreground border-t border-border mt-2 pt-3">
                  排行榜
                </div>
                {rankingMenus.map((menu) => {
                  const Icon = menu.icon;
                  return (
                    <Link
                      key={menu.path}
                      to={menu.path}
                      className="block px-6 py-2 rounded-md text-base font-medium text-muted-foreground hover:text-primary hover:bg-secondary flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon className="w-4 h-4" />
                      {menu.name}
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;