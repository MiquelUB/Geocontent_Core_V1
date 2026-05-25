import { Trophy } from "lucide-react";

interface StatsCardProps {
  title: string;
  description: React.ReactNode;
  icon?: React.ReactNode;
}

export function StatsCard({ title, description, icon }: StatsCardProps) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-start gap-4">
      <div className="bg-white p-3 rounded-full shadow-sm text-primary">
        {icon || <Trophy className="w-6 h-6" />}
      </div>
      <div>
        <h3 className="font-serif font-bold text-lg text-primary mb-1">{title}</h3>
        <div className="text-sm text-primary/80 leading-snug">{description}</div>
      </div>
    </div>
  );
}
