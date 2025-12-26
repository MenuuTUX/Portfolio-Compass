import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { analyzeEtf } from '@/lib/etf-analysis';
import { ETF } from '@/types';
import { cn } from '@/lib/utils';

export default function EtfVerdictCard({ etf }: { etf: ETF }) {
  const verdict = analyzeEtf(etf);

  const getIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default: return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case 'good': return "border-emerald-500/20 bg-emerald-500/5";
      case 'warning': return "border-rose-500/20 bg-rose-500/5";
      default: return "border-blue-500/20 bg-blue-500/5";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {Object.entries(verdict).map(([key, data]) => (
        <div key={key} className={cn("p-4 rounded-xl border flex flex-col gap-2", getColor(data.status))}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{key}</span>
            {getIcon(data.status)}
          </div>
          <div className="font-bold text-white text-lg">{data.label}</div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {data.description}
          </p>
        </div>
      ))}
    </div>
  );
}
