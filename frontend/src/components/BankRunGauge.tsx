import { APP_CONFIG, formatUSDT } from '../constants/config'

interface BankRunGaugeProps {
  utilizationRate: number
  totalDeposited: bigint
  adminWithdrawn: bigint
  totalBorrowed: bigint
  availableLiquidity: bigint
}

export function BankRunGauge({
  utilizationRate,
  totalDeposited,
  adminWithdrawn,
  totalBorrowed,
  availableLiquidity,
}: BankRunGaugeProps) {
  const { safe, caution } = APP_CONFIG.utilization

  const getColor = () => {
    if (utilizationRate < safe) return 'emerald'
    if (utilizationRate < caution) return 'amber'
    return 'red'
  }

  const color = getColor()

  const colorMap = {
    emerald: {
      bar: 'bg-emerald-500',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      label: '✓ Safe',
    },
    amber: {
      bar: 'bg-amber-500',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      label: '⚠ Caution',
    },
    red: {
      bar: 'bg-red-500',
      text: 'text-red-400',
      border: 'border-red-500/30',
      bg: 'bg-red-500/10',
      label: '🚨 Bank Run Risk',
    },
  }

  const c = colorMap[color]
  const cappedRate = Math.min(utilizationRate, 100)

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg">Bank Mode</h3>
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${c.text} ${c.bg} border ${c.border}`}>
          {c.label}
        </span>
      </div>

      {/* Utilization gauge */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-400">Utilization Rate</span>
          <span className={`text-sm font-bold ${c.text}`}>{utilizationRate}%</span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} transition-all duration-500 rounded-full`}
            style={{ width: `${cappedRate}%` }}
          />
        </div>
        {/* Threshold markers */}
        <div className="relative mt-1 h-2">
          <div
            className="absolute w-0.5 h-2 bg-amber-500/60"
            style={{ left: `${safe}%` }}
            title={`Caution threshold: ${safe}%`}
          />
          <div
            className="absolute w-0.5 h-2 bg-red-500/60"
            style={{ left: `${caution}%` }}
            title={`Danger threshold: ${caution}%`}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0%</span>
          <span className="text-amber-600">{safe}% caution</span>
          <span className="text-red-600">{caution}% danger</span>
          <span>100%</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Total Deposited</div>
          <div className="text-white font-medium">{formatUSDT(totalDeposited)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Available Liquidity</div>
          <div className="text-white font-medium">{formatUSDT(availableLiquidity)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Admin Withdrawn</div>
          <div className={`font-medium ${adminWithdrawn > 0n ? 'text-amber-400' : 'text-white'}`}>
            {formatUSDT(adminWithdrawn)}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Total Borrowed</div>
          <div className="text-white font-medium">{formatUSDT(totalBorrowed)}</div>
        </div>
      </div>

      {/* Warning for high utilization */}
      {utilizationRate >= safe && (
        <div className={`rounded-lg p-3 ${c.bg} border ${c.border} text-sm`}>
          {utilizationRate >= caution ? (
            <p className="text-red-300">
              <strong>🚨 Bank Run Risk:</strong> Utilization is critically high. If all depositors
              request withdrawals simultaneously, the pool may not have sufficient liquidity.
              Return funds to the pool immediately.
            </p>
          ) : (
            <p className="text-amber-300">
              <strong>⚠ Caution:</strong> Utilization is elevated. Ensure sufficient buffer
              before advertising APY to new depositors.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
