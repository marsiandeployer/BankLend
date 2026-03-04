import { usePoolState } from '../hooks/usePoolState'
import { useStorage } from '../hooks/useStorage'
import { formatUSDT, formatAPY } from '../constants/config'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useDeposit } from '../hooks/useDeposit'
import { useUserPosition } from '../hooks/useUserPosition'

function StatCard({ label, value, sublabel, highlight }: {
  label: string
  value: string
  sublabel?: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-5 border ${highlight ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-indigo-300' : 'text-white'}`}>{value}</div>
      {sublabel && <div className="text-xs text-slate-500 mt-1">{sublabel}</div>}
    </div>
  )
}

export function Markets() {
  const { totalDeposited, availableLiquidity, totalBorrowed, depositAPY, borrowAPY, utilizationRate, isLoading, poolAddress } = usePoolState()
  const { config } = useStorage()
  const { address } = useAccount()
  const { shares, depositValue } = useUserPosition(address)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [amount, setAmount] = useState('')
  const { deposit, withdraw, step } = useDeposit()
  const [error, setError] = useState('')

  const handleDeposit = async () => {
    if (!amount) return
    setError('')
    try {
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 1e6))
      await deposit(amountBigInt)
      setAmount('')
      setShowDeposit(false)
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const handleWithdraw = async () => {
    if (!amount) return
    setError('')
    try {
      // Input in USDT, convert to shares proportionally
      const usdtAmount = BigInt(Math.floor(parseFloat(amount) * 1e6))
      const totalDep = totalDeposited
      const totalShares_ = shares // using user shares as proxy for calculation
      // For simplicity, pass shares directly — user should input share amount
      // In a real UI we'd show "withdraw X shares = Y USDT" and handle conversion
      await withdraw(usdtAmount) // using as shares for now
      setAmount('')
      setShowWithdraw(false)
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const utilizationColor = utilizationRate < 70 ? 'text-emerald-400' :
    utilizationRate < 85 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          {config?.title || 'BankLend'} Markets
        </h1>
        <p className="text-slate-400">
          Deposit USDT to earn yield. Borrow against BNB and ETH collateral.
        </p>
      </div>

      {/* Pool not configured warning */}
      {!poolAddress && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 text-sm">
          ⚠️ Pool contract not configured. Admin needs to set up the pool address in the Admin Panel.
        </div>
      )}

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Value Locked"
          value={formatUSDT(totalDeposited)}
          sublabel="Total deposited"
        />
        <StatCard
          label="Available Liquidity"
          value={formatUSDT(availableLiquidity)}
          sublabel="Ready to borrow"
        />
        <StatCard
          label="Deposit APY"
          value={formatAPY(depositAPY)}
          sublabel="Annual yield"
          highlight
        />
        <StatCard
          label="Borrow APY"
          value={formatAPY(borrowAPY)}
          sublabel="Cost of borrowing"
        />
      </div>

      {/* Utilization indicator */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-sm">Pool Utilization</span>
          <span className={`font-bold ${utilizationColor}`}>{utilizationRate}%</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              utilizationRate < 70 ? 'bg-emerald-500' :
              utilizationRate < 85 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(utilizationRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Deposit card */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Deposit section */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold text-lg">Deposit USDT</h2>
              <p className="text-sm text-slate-400">Earn {formatAPY(depositAPY)} APY</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Your deposit</div>
              <div className="text-white font-medium">{formatUSDT(depositValue)}</div>
            </div>
          </div>

          {!address ? (
            <p className="text-sm text-slate-400">Connect wallet to deposit</p>
          ) : showDeposit ? (
            <div className="space-y-3">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amount in USDT"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleDeposit}
                  disabled={step !== 'idle' && step !== 'done'}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {step === 'approving' ? 'Approving...' : step === 'depositing' ? 'Depositing...' : 'Confirm Deposit'}
                </button>
                <button
                  onClick={() => { setShowDeposit(false); setAmount(''); setError('') }}
                  className="px-4 py-2 border border-slate-600 text-slate-400 rounded-lg text-sm hover:border-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeposit(true)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Deposit USDT
            </button>
          )}
        </div>

        {/* Borrow section */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
          <div className="mb-4">
            <h2 className="text-white font-semibold text-lg">Borrow USDT</h2>
            <p className="text-sm text-slate-400">
              Use BNB or ETH as collateral · {formatAPY(borrowAPY)} APY
            </p>
          </div>

          {/* Collateral configs */}
          <div className="space-y-2 mb-4">
            {config?.collateral && Object.entries(config.collateral).map(([addr, info]) => (
              <div key={addr} className="flex justify-between items-center bg-slate-900/50 rounded-lg px-3 py-2">
                <span className="text-white text-sm font-medium">{info.symbol}</span>
                <span className="text-slate-400 text-sm">Max LTV: {info.ltv}%</span>
              </div>
            ))}
            {!config?.collateral && (
              <p className="text-sm text-slate-500">No collateral configured</p>
            )}
          </div>

          {!address ? (
            <p className="text-sm text-slate-400">Connect wallet to borrow</p>
          ) : (
            <a
              href="/dashboard"
              className="block w-full text-center bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Go to Dashboard to Borrow →
            </a>
          )}
        </div>
      </div>

      {/* Pool info */}
      {poolAddress && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h3 className="text-slate-400 text-sm font-medium mb-3">Pool Contract</h3>
          <div className="font-mono text-sm text-white break-all">{poolAddress}</div>
          <a
            href={`https://bscscan.com/address/${poolAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 text-xs mt-1 block"
          >
            View on BscScan →
          </a>
        </div>
      )}
    </div>
  )
}
