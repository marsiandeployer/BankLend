interface LTVBarProps {
  currentLTV: number         // 0-100 percent
  liquidationThreshold: number  // e.g. 80
  maxLTV?: number            // e.g. 75 (optional, for display)
}

export function LTVBar({ currentLTV, liquidationThreshold }: LTVBarProps) {
  const pct = Math.min(Math.max(currentLTV, 0), 100)

  const color =
    pct < liquidationThreshold * 0.6
      ? 'bg-emerald-500'
      : pct < liquidationThreshold * 0.8
      ? 'bg-amber-500'
      : 'bg-red-500'

  const textColor =
    pct < liquidationThreshold * 0.6
      ? 'text-emerald-400'
      : pct < liquidationThreshold * 0.8
      ? 'text-amber-400'
      : 'text-red-400'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400">LTV</span>
        <span className={`font-medium ${textColor}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="relative h-3 bg-slate-700 rounded-full overflow-visible">
        {/* Filled bar */}
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
        {/* Liquidation threshold marker */}
        <div
          className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-white/70 rounded-full"
          style={{ left: `${Math.min(liquidationThreshold, 100)}%` }}
          title={`Liquidation at ${liquidationThreshold}%`}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>0%</span>
        <span className="text-slate-500">Liq. {liquidationThreshold}%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
