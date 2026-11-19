import React from 'react';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'sm', pulse = false }) => {
  const norm = status.toUpperCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-300';
  let dotColor = 'bg-slate-400';

  if (norm === 'PUBLISHED' || norm === 'COMPLETED' || norm === 'ACTIVE' || norm === 'SUCCESS') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-300/80';
    dotColor = 'bg-emerald-500';
  } else if (norm === 'PROCESSING' || norm === 'RUNNING' || norm === 'IN_FLIGHT') {
    styles = 'bg-sky-50 text-sky-700 border-sky-300/80';
    dotColor = 'bg-sky-500';
  } else if (norm === 'QUEUED' || norm === 'DRAFT' || norm === 'INFO') {
    styles = 'bg-slate-100 text-slate-700 border-slate-300';
    dotColor = 'bg-slate-500';
  } else if (norm === 'RETRYING' || norm === 'WARN') {
    styles = 'bg-amber-50 text-amber-800 border-amber-300/80';
    dotColor = 'bg-amber-500';
  } else if (norm === 'FAILED' || norm === 'DEAD_LETTERED' || norm === 'DLQ' || norm === 'ERROR') {
    styles = 'bg-rose-50 text-rose-700 border-rose-300/80';
    dotColor = 'bg-rose-500';
  } else if (norm === 'DEPRECATED' || norm === 'PAUSED') {
    styles = 'bg-orange-50 text-orange-800 border-orange-300/80';
    dotColor = 'bg-orange-500';
  } else if (norm === 'RETIRED') {
    styles = 'bg-gray-100 text-gray-600 border-gray-300';
    dotColor = 'bg-gray-400';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClasses} ${styles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${pulse ? 'animate-ping' : ''}`}></span>
      <span>{status}</span>
    </span>
  );
};
