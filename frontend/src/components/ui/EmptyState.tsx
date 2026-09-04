import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

interface EmptyStateProps {
  title: string;
  description: string;
  action: string;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  const router = useRouter();

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC] font-sans min-h-[75vh]">
      <div className="w-full max-w-xl bg-white border border-[#E5E7EB] rounded-2xl p-8 text-center flex flex-col items-center gap-6 shadow-xs relative overflow-hidden">
        {/* Subtle Light Blooms */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[96px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-[96px] pointer-events-none" />

        {/* Custom SVG Architecture Dependency Network */}
        <div className="w-full h-40 relative flex items-center justify-center bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl overflow-hidden shrink-0 select-none">
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:16px_16px]" />
          <svg className="w-full h-full" viewBox="0 0 400 160">
            {/* Connection Paths */}
            <path d="M 80,80 H 320" stroke="rgba(79, 70, 229, 0.2)" strokeWidth="1.5" />
            <path d="M 80,80 L 160,40" stroke="rgba(20, 184, 166, 0.2)" strokeWidth="1.5" />
            <path d="M 80,80 L 160,120" stroke="rgba(20, 184, 166, 0.2)" strokeWidth="1.5" />
            <path d="M 320,80 L 240,40" stroke="rgba(20, 184, 166, 0.2)" strokeWidth="1.5" />
            <path d="M 320,80 L 240,120" stroke="rgba(20, 184, 166, 0.2)" strokeWidth="1.5" />
            <path d="M 160,40 L 240,40" stroke="rgba(79, 70, 229, 0.15)" strokeWidth="1" strokeDasharray="3,3" />
            <path d="M 160,120 L 240,120" stroke="rgba(79, 70, 229, 0.15)" strokeWidth="1" strokeDasharray="3,3" />

            {/* Flowing Particles */}
            <circle r="3" fill="#4F46E5">
              <animateMotion dur="4s" repeatCount="indefinite" path="M 80,80 H 320" />
            </circle>
            <circle r="2.5" fill="#14B8A6">
              <animateMotion dur="3s" repeatCount="indefinite" path="M 80,80 L 160,40" />
            </circle>
            <circle r="2.5" fill="#14B8A6">
              <animateMotion dur="3.5s" repeatCount="indefinite" path="M 80,80 L 160,120" />
            </circle>

            {/* Nodes */}
            <g>
              <circle cx="80" cy="80" r="14" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="2" />
              <text x="80" y="83" fill="#111827" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">UI</text>
            </g>
            <g>
              <circle cx="160" cy="40" r="12" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" />
              <text x="160" y="43" fill="#4B5563" fontSize="7" fontFamily="monospace" textAnchor="middle">Auth</text>
            </g>
            <g>
              <circle cx="160" cy="120" r="12" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" />
              <text x="160" y="123" fill="#4B5563" fontSize="7" fontFamily="monospace" textAnchor="middle">Cache</text>
            </g>
            <g>
              <circle cx="240" cy="40" r="12" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" />
              <text x="240" y="43" fill="#4B5563" fontSize="7" fontFamily="monospace" textAnchor="middle">API</text>
            </g>
            <g>
              <circle cx="240" cy="120" r="12" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" />
              <text x="240" y="123" fill="#4B5563" fontSize="7" fontFamily="monospace" textAnchor="middle">Job</text>
            </g>
            <g>
              <circle cx="320" cy="80" r="14" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="2" />
              <text x="320" y="83" fill="#111827" fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">DB</text>
            </g>
          </svg>
        </div>

        {/* Titles & Descriptions */}
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed px-4">{description}</p>
        </div>

        {/* Onboarding Wizard Progress */}
        <div className="w-full text-left bg-[#F8FAFC] border border-[#E5E7EB] p-5 rounded-xl flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Onboarding Progress</span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-mono font-bold">1 / 4 Completed</Badge>
          </div>

          <div className="grid grid-cols-4 gap-2 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full" />
            <div className="bg-slate-200 h-full rounded-full" />
            <div className="bg-slate-200 h-full rounded-full" />
            <div className="bg-slate-200 h-full rounded-full" />
          </div>

          <div className="grid grid-cols-4 text-[9px] font-medium text-slate-500 text-center gap-1 select-none leading-none">
            <div className="text-primary font-bold">1. Connect GitHub</div>
            <div>2. Import Repo</div>
            <div>3. Run Scan</div>
            <div>4. Explore Map</div>
          </div>
        </div>

        {/* Checklist */}
        <div className="w-full text-left bg-[#F8FAFC] border border-[#E5E7EB] p-4 rounded-xl flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Import a repository to unlock:</span>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Architecture Graph</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Codebase Chat</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Security Audit</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Health Analysis</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 col-span-2">
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>PR Reviews</span>
            </div>
          </div>
        </div>

        <Button 
          onClick={() => router.push('/dashboard?import=true')}
          className="bg-primary hover:bg-primary/95 text-white w-full text-xs font-bold cursor-pointer h-10 rounded-xl"
        >
          {action}
        </Button>
      </div>
    </div>
  );
}
