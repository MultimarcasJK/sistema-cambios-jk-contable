'use client';

import React from 'react';
import { AppMode, RateTier } from '@/types';
import { RateInfoResult } from '@/lib/rates-service';

interface RateTierSelectorProps {
  rateInfo: RateInfoResult;
  appMode: AppMode;
  selectedTier: RateTier;
  onSelectTier: (tier: RateTier) => void;
  isDark?: boolean;
  compact?: boolean;
}

export function RateTierSelector({
  rateInfo,
  appMode,
  selectedTier,
  onSelectTier,
  isDark = false,
  compact = false,
}: RateTierSelectorProps) {
  const options: Array<{ tier: RateTier; label: string; title: string; accent?: 'vip' | 'mayor' }> = [];

  if (appMode === 'detal') {
    if (!rateInfo.hasVip) return null;
    options.push({
      tier: 'normal',
      label: 'Normal',
      title: 'Tasa estándar Detal',
    });
    options.push({
      tier: 'vip',
      label: compact
        ? `★ VIP (+$${rateInfo.vipFee})`
        : `★ VIP (${rateInfo.vipRate} · +$${rateInfo.vipFee})`,
      title: `Tasa VIP (${rateInfo.vipMargin}% margen + $${rateInfo.vipFee} comisión)`,
      accent: 'vip',
    });
  } else {
    if (!rateInfo.hasMayorRst && !rateInfo.hasMayorVolumen) return null;
    options.push({
      tier: 'normal',
      label: 'Mayor',
      title: 'Tasa estándar Mayor',
    });
    if (rateInfo.hasMayorRst) {
      options.push({
        tier: 'mayor_rst',
        label: compact ? 'Mayor X RST' : `Mayor X RST (${rateInfo.mayorRstRate})`,
        title: `Tasa Mayor X RST (${rateInfo.mayorRstMargin}% margen)`,
        accent: 'mayor',
      });
    }
    if (rateInfo.hasMayorVolumen) {
      options.push({
        tier: 'mayor_volumen',
        label: compact ? 'Mayor $1,000+' : `Mayor $1,000+ (${rateInfo.mayorVolumenRate})`,
        title: `Tasa Mayor $1,000+ (${rateInfo.mayorVolumenMargin}% margen)`,
        accent: 'mayor',
      });
    }
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {options.map((opt) => {
        const active = selectedTier === opt.tier;
        let cls = '';
        if (active && opt.accent === 'vip') {
          cls = 'bg-amber-400 text-amber-950 border-amber-500 shadow-xs';
        } else if (active && opt.accent === 'mayor') {
          cls = 'bg-blue-600 text-white border-blue-500 shadow-xs';
        } else if (active) {
          cls = isDark
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
            : 'bg-emerald-600 text-white border-emerald-600 shadow-xs';
        } else if (isDark) {
          cls = 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white hover:border-slate-500';
        } else {
          cls = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100';
        }

        return (
          <button
            key={opt.tier}
            type="button"
            onClick={() => onSelectTier(opt.tier)}
            title={opt.title}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${cls}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
