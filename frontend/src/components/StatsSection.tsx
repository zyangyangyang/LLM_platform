import React from 'react';

const StatsSection: React.FC = () => {
  const stats = [
    { label: '累计评测模型', value: '500+' },
    { label: '检测出安全漏洞', value: '12,000+' },
    { label: '企业级合作伙伴', value: '50+' },
    { label: '每日请求处理', value: '1M+' },
  ];

  return (
    <div data-cmp="StatsSection" className="bg-primary py-16">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="p-4">
              <div className="text-4xl lg:text-5xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-blue-100 text-sm lg:text-base font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatsSection;