import { useAccount } from 'wagmi'
import { useUserPosition } from '../hooks/useUserPosition'
import { usePoolState } from '../hooks/usePoolState'
import { useDeposit } from '../hooks/useDeposit'
import { useBorrow } from '../hooks/useBorrow'
import { useCollaterals } from '../hooks/useCollaterals'
import { formatUSDT, formatToken, formatAPY } from '../constants/config'
import { useState } from 'react'
import { ConnectWallet } from '../components/ConnectWallet'
import { LTVBar } from '../components/LTVBar'

const LIQUIDATION_THRESHOLD = 80

export function Dashboard() {
  const { address, isConnected } = useAccount()
  const { shares, depositValue, borrow, healthFactor, pendingInterest, isLoading, refetch } = useUserPosition(address)
  const { depositAPY, borrowAPY, totalShares, totalDeposited } = usePoolState()
  const { deposit, withdraw, step: depositStep } = useDeposit()
  const { repay, step: borrowStep } = useBorrow()
  const { collaterals } = useCollaterals()

  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [repayAmount, setRepayAmount] = useState('')
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'repay' | null>(null)
  const [error, setError] = useState('')

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <h2 className="text-2xl font-bold text-white">Connect Your Wallet</h2>
        <p className="text-slate-400">Connect to view your positions</p>
        <ConnectWallet />
      </div>
    )
  }

  const hasDeposit = shares > 0n
  const hasBorrow = borrow !== null && borrow.principal > 0n

  // Find collateral info for active borrow
  const borrowCollateral = hasBorrow
    ? collaterals.find(c => c.address.toLowerCase() === borrow!.collateralToken.toLowerCase())
    : null

  const collateralValueUSD = borrowCollateral && hasBorrow
    ? (Number(borrow!.collateralAmount) / Math.pow(10, borrowCollateral.decimals)) * borrowCollateral.priceUSD
    : 0

  const totalOwed = hasBorrow
    ? Number(borrow!.principal + borrow!.interestOwed + pendingInterest) / 1e6
    : 0

  const currentLTV = collateralValueUSD > 0
    ? Math.min((totalOwed / collateralValueUSD) * 100, 100)
    : 0

  const handleDeposit = async () => {
    if (!depositAmount) return
    setError('')
    try {
      await deposit(BigInt(Math.floor(parseFloat(depositAmount) * 1e6)))
      setDepositAmount('')
      setActiveModal(null)
      refetch()
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount) return
    setError('')
    try {
      const usdtBig = BigInt(Math.floor(parseFloat(withdrawAmount) * 1e6))
      const sharesForAmount = totalDeposited > 0n
        ? (usdtBig * totalShares) / totalDeposited
        : usdtBig
      await withdraw(sharesForAmount)
      setWithdrawAmount('')
      setActiveModal(null)
      refetch()
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const handleRepay = async () => {
    if (!repayAmount) return
    setError('')
    try {
      await repay(BigInt(Math.floor(parseFloat(repayAmount) * 1e6)))
      setRepayAmount('')
      setActiveModal(null)
      refetch()
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My Dashboard</h1>
        <p className="text-slate-400 font-mono text-sm">{address}</p>
      </div>

      {/* Deposit position */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Deposit Position</h2>
          <span className="text-sm text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">
            {formatAPY(depositAPY)} APY
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-slate-400">Deposited Value</div>
            <div className="text-2xl font-bold text-white mt-1">
              {isLoading ? '...' : formatUSDT(depositValue)}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Earning APY</div>
            <div className="text-lg font-medium text-indigo-300 mt-1">
              {formatAPY(depositAPY)}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setActiveModal('deposit'); setError('') }}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            + Deposit
          </button>
          {hasDeposit && (
            <button
              onClick={() => { setActiveModal('withdraw'); setError('') }}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Withdraw
            </button>
          )}
        </div>

        {activeModal === 'deposit' && (
          <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <h3 className="text-white font-medium mb-3">Deposit USDT</h3>
            <input
              type="number"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              placeholder="Amount in USDT"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-3"
            />
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDeposit}
                disabled={depositStep !== 'idle' && depositStep !== 'done'}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm"
              >
                {depositStep === 'approving' ? 'Approving...' : depositStep === 'depositing' ? 'Depositing...' : 'Confirm'}
              </button>
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeModal === 'withdraw' && (
          <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <h3 className="text-white font-medium mb-3">Withdraw USDT</h3>
            <p className="text-sm text-slate-400 mb-3">
              Available: {formatUSDT(depositValue)}
            </p>
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="Amount in USDT"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-3"
            />
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleWithdraw}
                disabled={depositStep !== 'idle' && depositStep !== 'done'}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm"
              >
                {depositStep === 'depositing' ? 'Withdrawing...' : 'Confirm'}
              </button>
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Borrow position */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Borrow Position</h2>
          <span className="text-sm text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
            {formatAPY(borrowAPY)} APY
          </span>
        </div>

        {hasBorrow ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-slate-400">Borrowed</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {formatUSDT(borrow!.principal)}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Accrued Interest</div>
                <div className="text-lg font-medium text-amber-400 mt-1">
                  +{formatUSDT(borrow!.interestOwed + pendingInterest)}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Collateral Locked</div>
                <div className="text-lg font-medium text-slate-300 mt-1">
                  {formatToken(borrow!.collateralAmount, borrowCollateral?.decimals ?? 18, 4)}{' '}
                  {borrowCollateral?.symbol ?? '...'}
                </div>
                {collateralValueUSD > 0 && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    ≈ ${collateralValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-slate-400 mb-2">Health</div>
                <LTVBar
                  currentLTV={currentLTV}
                  liquidationThreshold={LIQUIDATION_THRESHOLD}
                />
              </div>
            </div>

            <button
              onClick={() => { setActiveModal('repay'); setError('') }}
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Repay Loan
            </button>

            {activeModal === 'repay' && (
              <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                <h3 className="text-white font-medium mb-3">Repay USDT</h3>
                <p className="text-sm text-slate-400 mb-3">
                  Total owed: {formatUSDT(borrow!.principal + borrow!.interestOwed + pendingInterest)}
                </p>
                <input
                  type="number"
                  value={repayAmount}
                  onChange={e => setRepayAmount(e.target.value)}
                  placeholder="Amount to repay in USDT"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-3"
                />
                {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleRepay}
                    disabled={borrowStep !== 'idle' && borrowStep !== 'done'}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm"
                  >
                    {borrowStep === 'approving-usdt' ? 'Approving...' : borrowStep === 'repaying' ? 'Repaying...' : 'Confirm Repay'}
                  </button>
                  <button onClick={() => setActiveModal(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div>
            <p className="text-slate-400 mb-4">No active borrow position</p>

            {/* Mini collateral table */}
            {collaterals.filter(c => c.enabled).length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Available Collateral</div>
                {collaterals.filter(c => c.enabled).map(col => (
                  <div key={col.address} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-white text-sm font-medium">{col.symbol}</span>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      {col.priceUSD > 0 && (
                        <span>${col.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                      <span>Max LTV: <span className="text-emerald-400">{col.ltv}%</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <a
              href="/markets"
              className="inline-block text-indigo-400 hover:text-indigo-300 text-sm"
            >
              Go to Markets to start borrowing →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
