'use client'

import { DashboardButtonConfig } from '@/lib/config/dashboard-data';
import DashboardButton from '../ui/DashboardButton';

interface DynamicGridProps {
  items: DashboardButtonConfig[];
  onItemClick: (item: DashboardButtonConfig) => void;
  className?: string;
}

export default function DynamicGrid({ items, onItemClick, className = '' }: DynamicGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 bg-white/50 rounded-lg p-6 border-2 border-dashed border-[#8b7355]/30">
        <p className="text-[#8b7355] italic">No items configured in the dashboard.</p>
      </div>    
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 ${className}`}>
      {items.map((item) => (
        <DashboardButton 
          key={item.id} 
          config={item} 
          onClick={onItemClick} 
        />
      ))}
    </div>
  )
}
