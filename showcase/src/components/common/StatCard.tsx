import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-forge-teal',
  badge,
  badgeColor = 'bg-slate-100 text-slate-700',
  onClick,
}) => {
  return (
    <div 
      onClick={onClick}
      className={`p-4 bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all ${onClick ? 'cursor-pointer hover:border-slate-300' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg bg-slate-50 border border-slate-100 ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">{value}</div>
        {badge && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-slate-500 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};
