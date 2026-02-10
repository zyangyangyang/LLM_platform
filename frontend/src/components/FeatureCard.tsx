import React from 'react';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description }) => {
  return (
    <div data-cmp="FeatureCard" className="group bg-white p-6 rounded-xl border border-border shadow-sm hover:shadow-custom hover:border-blue-200 transition-all duration-300">
      <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-5 group-hover:bg-primary transition-colors duration-300">
        <Icon className="w-6 h-6 text-primary group-hover:text-white transition-colors duration-300" />
      </div>
      <h3 className="text-xl font-semibold mb-3 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
};

export default FeatureCard;