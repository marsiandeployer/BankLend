import { usePoolState } from '../hooks/usePoolState'
import { useStorage } from '../hooks/useStorage'
import { useCollaterals } from '../hooks/useCollaterals'
import { formatUSDT, formatAPY } from '../constants/config'
import { useState } from 'react'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { useDeposit } from '../hooks/useDeposit'
import { useUserPosition } from '../hooks/useUserPosition'
import { useBorrow } from '../hooks/useBorrow'
import { LTVBar } from '../components/LTVBar'

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const LIQUIDATION_THRESHOLD = 80

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

function BorrowForm({
  collateralAddress,
  collateralSymbol,
  collateralDecimals,
  collateralPriceUSD,
  maxLTV,
  onClose,
}: {
  collateralAddress: `0x${string}`
  collateralSymbol: string
  collateralDecimals: number
  collateralPriceUSD: number
  maxLTV: number
  onClose: () => void
}) {
  const { address } = useAccount()
  const { borrow, step } = useBorrow()
  const [collateralAmount, setCollateralAmount] = useState('')
  const [borrowAmount, setBorrowAmount] = useState('')
  const [error, setError] = useState('')

  const { data: balanceRaw } = useReadContract({
    address: collateralAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const balance = balanceRaw ? Number(balanceRaw) / Math.pow(10, collateralDecimals) : 0

  const collateralNum = parseFloat(collateralAmount) || 0
  const collateralUSD = collateralNum * collateralPriceUSD
  const maxBorrow = collateralUSD * maxLTV / 100
  const borrowNum = parseFloat(borrowAmount) || 0
  const currentLTV = collateralUSD > 0 ? (borrowNum / collateralUSD) * 100 : 0

  const handleMaxCollateral = () => {
    setCollateralAmount(balance.toFixed(6))
  }

  const handleMaxBorrow = () => {
    setBorrowAmount(maxBorrow.toFixed(2))
  }

  const handleBorrow = async () => {
    if (!collateralAmount || !borrowAmount) return
    setError('')
    try {
      const collateralBig = BigInt(Math.floor(collateralNum * Math.pow(10, collateralDecimals)))
      const borrowBig = BigInt(Math.floor(parseFloat(borrowAmount) * 1e6))
      await borrow(collateralAddress, collateralBig, borrowBig)
      onClose()
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const isBusy = step !== 'idle' && step !== 'done'

  return (
    <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-600 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Borrow USDT using {collateralSymbol}</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-sm">✕</button>
      </div>

      {/* Collateral input */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Collateral amount ({collateralSymbol})</span>
          <button onClick={handleMaxCollateral} className="text-indigo-400 hover:text-indigo-300">
            Balance: {balance.toFixed(4)} {collateralSymbol}
          </button>
        </div>
        <input
          type="number"
          value={collateralAmount}
          onChange={e => setCollateralAmount(e.target.value)}
          placeholder={`0.00 ${collateralSymbol}`}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
        />
        {collateralNum > 0 && (
          <div className="text-xs text-slate-500 mt-1">
            ≈ ${collateralUSD.toFixed(2)} · Max borrow: ${maxBorrow.toFixed(2)} USDT
          </div>
        )}
      </div>

      {/* Borrow input */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Borrow amount (USDT)</span>
          <button
            onClick={handleMaxBorrow}
            disabled={collateralNum === 0}
            className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 disabled:cursor-not-allowed"
          >
            Max: ${maxBorrow.toFixed(2)}
          </button>
        </div>
        <input
          type="number"
          value={borrowAmount}
          onChange={e => setBorrowAmount(e.target.value)}
          placeholder="0.00 USDT"
          max={maxBorrow}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
        />
      </div>

      {/* LTV Bar */}
      {collateralNum > 0 && (
        <LTVBar
          currentLTV={Math.min(currentLTV, 100)}
          liquidationThreshold={LIQUIDATION_THRESHOLD}
          maxLTV={maxLTV}
        />
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleBorrow}
          disabled={isBusy || !collateralAmount || !borrowAmount || borrowNum > maxBorrow}
          className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {step === 'approving-collateral' ? 'Approving...' : step === 'borrowing' ? 'Borrowing...' : 'Approve & Borrow'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 border border-slate-600 text-slate-400 rounded-lg text-sm hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function Markets() {
  const chainId = useChainId()
  const { totalDeposited, availableLiquidity, totalBorrowed, depositAPY, borrowAPY, utilizationRate, isLoading, poolAddress } = usePoolState()
  const { config } = useStorage()
  const { address } = useAccount()
  const { shares, depositValue } = useUserPosition(address)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [amount, setAmount] = useState('')
  const { deposit, withdraw, step } = useDeposit()
  const [error, setError] = useState('')
  const { collaterals, isLoading: colLoading } = useCollaterals()
  const [borrowingCollateral, setBorrowingCollateral] = useState<`0x${string}` | null>(null)

  const bscScanBase = `https://${chainId === 97 ? 'testnet.' : ''}bscscan.com`

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
      const usdtAmount = BigInt(Math.floor(parseFloat(amount) * 1e6))
      await withdraw(usdtAmount)
      setAmount('')
      setShowWithdraw(false)
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const utilizationColor = utilizationRate < 70 ? 'text-emerald-400' :
    utilizationRate < 85 ? 'text-amber-400' : 'text-red-400'

  const availableForBorrow = collaterals.length > 0
    ? `$${(Number(availableLiquidity) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : formatUSDT(availableLiquidity)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          {config?.title || 'BankLend'} Markets
        </h1>
        <p className="text-slate-400">
          Deposit USDT to earn yield. Borrow against crypto collateral.
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
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeposit(true)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Deposit USDT
            </button>
            {shares > 0n && (
              <button
                onClick={() => setShowWithdraw(true)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Withdraw
              </button>
            )}
          </div>
        )}

        {showWithdraw && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-400">Available: {formatUSDT(depositValue)}</p>
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
                onClick={handleWithdraw}
                disabled={step !== 'idle' && step !== 'done'}
                className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
              >
                {step === 'depositing' ? 'Withdrawing...' : 'Confirm Withdraw'}
              </button>
              <button
                onClick={() => { setShowWithdraw(false); setAmount(''); setError('') }}
                className="px-4 py-2 border border-slate-600 text-slate-400 rounded-lg text-sm hover:border-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Borrow / Collateral section */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Borrow USDT</h2>
            <p className="text-sm text-slate-400">
              Post collateral · {formatAPY(borrowAPY)} APY · Liq. threshold {LIQUIDATION_THRESHOLD}%
            </p>
          </div>
          <span className="text-sm text-slate-400">Available: {availableForBorrow}</span>
        </div>

        {colLoading ? (
          <p className="text-slate-500 text-sm py-4">Loading collaterals...</p>
        ) : collaterals.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-slate-500 text-sm">No collateral configured on-chain yet.</p>
            <p className="text-slate-600 text-xs mt-1">Admin can add collateral in the Admin Panel.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-5 gap-2 px-3 py-1 text-xs text-slate-500 font-medium uppercase tracking-wide">
              <span>Asset</span>
              <span>Price</span>
              <span>Max LTV</span>
              <span>Liq. Threshold</span>
              <span></span>
            </div>

            {collaterals.filter(c => c.enabled).map(col => (
              <div key={col.address}>
                <div className="grid grid-cols-5 gap-2 items-center bg-slate-900/50 rounded-lg px-3 py-3">
                  <div>
                    <div className="text-white text-sm font-medium">{col.symbol}</div>
                    <a
                      href={`${bscScanBase}/address/${col.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:text-slate-400 font-mono text-xs"
                    >
                      {col.address.slice(0, 6)}…{col.address.slice(-4)}
                    </a>
                  </div>
                  <div className="text-slate-300 text-sm">
                    {col.priceUSD > 0 ? `$${col.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </div>
                  <div className="text-emerald-400 text-sm font-medium">{col.ltv}%</div>
                  <div className="text-amber-400 text-sm">{LIQUIDATION_THRESHOLD}%</div>
                  <div>
                    {!address ? (
                      <span className="text-slate-600 text-xs">Connect wallet</span>
                    ) : (
                      <button
                        onClick={() => setBorrowingCollateral(
                          borrowingCollateral === col.address ? null : col.address
                        )}
                        className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          borrowingCollateral === col.address
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                      >
                        {borrowingCollateral === col.address ? 'Close' : 'Borrow'}
                      </button>
                    )}
                  </div>
                </div>

                {borrowingCollateral === col.address && (
                  <BorrowForm
                    collateralAddress={col.address}
                    collateralSymbol={col.symbol}
                    collateralDecimals={col.decimals}
                    collateralPriceUSD={col.priceUSD}
                    maxLTV={col.ltv}
                    onClose={() => setBorrowingCollateral(null)}
                  />
                )}
              </div>
            ))}

            {collaterals.every(c => !c.enabled) && (
              <p className="text-slate-500 text-sm py-4 text-center">All collaterals are currently disabled.</p>
            )}
          </div>
        )}
      </div>

      {/* Pool info */}
      {poolAddress && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h3 className="text-slate-400 text-sm font-medium mb-3">Pool Contract</h3>
          <div className="font-mono text-sm text-white break-all">{poolAddress}</div>
          <a
            href={`${bscScanBase}/address/${poolAddress}`}
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
