import { useAdmin } from '../hooks/useAdmin'
import { usePoolState } from '../hooks/usePoolState'
import { useStorage } from '../hooks/useStorage'
import { useCollaterals } from '../hooks/useCollaterals'
import { BankRunGauge } from '../components/BankRunGauge'
import { ConnectWallet } from '../components/ConnectWallet'
import { useAccount, useChainId } from 'wagmi'
import { formatUSDT, formatAPY } from '../constants/config'
import { TOKENS, DOMAINS } from '../constants/addresses'
import { useState } from 'react'

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
      />
    </div>
  )
}

export function AdminPanel() {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { isAdmin, adminWithdraw, adminDeposit, setRates, setCollateral, updateStorageConfig, step } = useAdmin()
  const { totalDeposited, totalBorrowed, adminWithdrawn, availableLiquidity, utilizationRate, depositAPY, borrowAPY, poolAddress } = usePoolState()
  const { config, owner } = useStorage()
  const { collaterals, isLoading: colLoading } = useCollaterals()

  const chainTokens = TOKENS[chainId as keyof typeof TOKENS]
  const usdtAddress = (config?.depositToken || chainTokens?.USDT || '') as `0x${string}`
  const domain = DOMAINS[chainId] ?? DOMAINS[56]

  // Form state — contract settings
  const [poolAddr, setPoolAddr] = useState(config?.poolAddress || poolAddress || '')
  const [depositToken, setDepositToken] = useState(config?.depositToken || usdtAddress || '')
  const [depAPY, setDepAPY] = useState(String(depositAPY / 100))
  const [borAPY, setBorAPY] = useState(String(borrowAPY / 100))

  // Bank mode form
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [depositBackAmount, setDepositBackAmount] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Add collateral form
  const [colToken, setColToken] = useState('')
  const [colPriceFeed, setColPriceFeed] = useState('')
  const [colLtv, setColLtv] = useState('')

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const handleSetCollateral = async () => {
    if (!colToken || !colPriceFeed || !colLtv) return
    setError('')
    try {
      await setCollateral(
        colToken as `0x${string}`,
        colPriceFeed as `0x${string}`,
        Math.round(parseFloat(colLtv)),
      )
      setColToken('')
      setColPriceFeed('')
      setColLtv('')
      showSuccess(`Collateral ${colToken.slice(0, 8)}… configured (LTV ${colLtv}%)`)
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const handleAdminWithdraw = async () => {
    if (!withdrawAmount) return
    setError('')
    try {
      await adminWithdraw(BigInt(Math.floor(parseFloat(withdrawAmount) * 1e6)))
      setWithdrawAmount('')
      showSuccess(`Withdrawn $${withdrawAmount} USDT from pool`)
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const handleAdminDeposit = async () => {
    if (!depositBackAmount || !usdtAddress) return
    setError('')
    try {
      await adminDeposit(
        BigInt(Math.floor(parseFloat(depositBackAmount) * 1e6)),
        usdtAddress,
      )
      setDepositBackAmount('')
      showSuccess(`Returned $${depositBackAmount} USDT to pool`)
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const handleSaveRates = async () => {
    setError('')
    try {
      const depBps = Math.round(parseFloat(depAPY) * 100)
      const borBps = Math.round(parseFloat(borAPY) * 100)
      await setRates(depBps, borBps)
      showSuccess('Interest rates updated')
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  const handleSaveConfig = async () => {
    setError('')
    try {
      await updateStorageConfig({
        poolAddress: poolAddr,
        depositToken: depositToken,
        depositAPY: Math.round(parseFloat(depAPY) * 100),
        borrowAPY: Math.round(parseFloat(borAPY) * 100),
      })
      showSuccess('Storage config saved')
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
        <p className="text-slate-400">Connect wallet to access admin panel</p>
        <ConnectWallet />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-slate-400">
          Admin address: <span className="font-mono text-indigo-300">{owner || 'Not set'}</span>
        </p>
        <p className="text-slate-400">
          Your address: <span className="font-mono text-slate-300">{address}</span>
        </p>
        <p className="text-sm text-slate-500">
          Set up admin in the onout.org Storage contract for domain: {domain}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
        <p className="text-slate-400">Manage BankLend pool settings and bank mode</p>
      </div>

      {/* Success/Error messages */}
      {successMsg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 text-sm">
          ✓ {successMsg}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
          ✗ {error}
        </div>
      )}

      {/* ── Bank Mode Gauge ── */}
      <BankRunGauge
        utilizationRate={utilizationRate}
        totalDeposited={totalDeposited}
        adminWithdrawn={adminWithdrawn}
        totalBorrowed={totalBorrowed}
        availableLiquidity={availableLiquidity}
      />

      {/* ── Bank Mode Actions ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Bank Mode Actions</h2>
        <p className="text-sm text-slate-400 mb-6">
          Withdraw USDT from the pool for external use. Return funds before depositors need to withdraw.
          <strong className="text-amber-400"> Always maintain adequate liquidity buffer.</strong>
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Withdraw from pool */}
          <div className="space-y-3">
            <h3 className="text-white font-medium">Withdraw from Pool</h3>
            <p className="text-sm text-slate-400">
              Available: {formatUSDT(availableLiquidity)}
            </p>
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="Amount in USDT"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleAdminWithdraw}
              disabled={step === 'pending' || !withdrawAmount}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {step === 'pending' ? 'Processing...' : 'Withdraw from Pool'}
            </button>
          </div>

          {/* Return funds to pool */}
          <div className="space-y-3">
            <h3 className="text-white font-medium">Return Funds to Pool</h3>
            <p className="text-sm text-slate-400">
              Admin withdrawn: {formatUSDT(adminWithdrawn)}
            </p>
            <input
              type="number"
              value={depositBackAmount}
              onChange={e => setDepositBackAmount(e.target.value)}
              placeholder="Amount in USDT"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleAdminDeposit}
              disabled={step === 'approving' || step === 'pending' || !depositBackAmount}
              className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {step === 'approving' ? 'Approving...' : step === 'pending' ? 'Processing...' : 'Return to Pool'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Contract Settings ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Contract Settings</h2>
        <div className="space-y-4">
          <FormField
            label="Pool Contract Address"
            value={poolAddr}
            onChange={setPoolAddr}
            placeholder="0x..."
          />
          <FormField
            label="Deposit Token (USDT)"
            value={depositToken}
            onChange={setDepositToken}
            placeholder="0x55d398..."
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Deposit APY (%)"
              value={depAPY}
              onChange={setDepAPY}
              placeholder="8"
              type="number"
            />
            <FormField
              label="Borrow APY (%)"
              value={borAPY}
              onChange={setBorAPY}
              placeholder="15"
              type="number"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={step === 'pending'}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Save to Storage
            </button>
            <button
              onClick={handleSaveRates}
              disabled={step === 'pending' || !poolAddress}
              className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              title={!poolAddress ? 'Pool address must be configured first' : ''}
            >
              Update On-Chain Rates
            </button>
          </div>
        </div>
      </div>

      {/* ── Add / Update Collateral ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <h2 className="text-white font-semibold text-lg mb-1">Add / Update Collateral</h2>
        <p className="text-sm text-slate-400 mb-5">
          Configure which tokens can be used as collateral. Calls <code className="text-indigo-300">setCollateral()</code> on-chain.
        </p>

        <div className="space-y-4 mb-5">
          <FormField
            label="Token Address"
            value={colToken}
            onChange={setColToken}
            placeholder="0x... (ERC20 collateral token)"
          />
          <FormField
            label="Price Feed (Chainlink)"
            value={colPriceFeed}
            onChange={setColPriceFeed}
            placeholder="0x... (AggregatorV3Interface)"
          />
          <FormField
            label="Max LTV (%)"
            value={colLtv}
            onChange={setColLtv}
            placeholder="75"
            type="number"
          />
          <button
            onClick={handleSetCollateral}
            disabled={step === 'pending' || !colToken || !colPriceFeed || !colLtv || !poolAddress}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            title={!poolAddress ? 'Pool address must be configured first' : ''}
          >
            {step === 'pending' ? 'Processing...' : 'Set Collateral'}
          </button>
        </div>

        {/* Current collaterals from contract */}
        <div>
          <div className="text-sm text-slate-400 font-medium mb-3">Current On-Chain Collaterals</div>
          {colLoading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : collaterals.length === 0 ? (
            <p className="text-slate-500 text-sm">No collaterals configured on-chain yet.</p>
          ) : (
            <div className="space-y-2">
              {collaterals.map(col => (
                <div key={col.address} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-4 py-3">
                  <div>
                    <span className="text-white font-medium">{col.symbol}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${col.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {col.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <div className="text-slate-500 font-mono text-xs mt-0.5">{col.address}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-indigo-300 text-sm">LTV: {col.ltv}%</div>
                    {col.priceUSD > 0 && (
                      <div className="text-slate-400 text-xs mt-0.5">
                        ${col.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pool Stats ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Pool Statistics</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Deposited', value: formatUSDT(totalDeposited) },
            { label: 'Total Borrowed', value: formatUSDT(totalBorrowed) },
            { label: 'Admin Withdrawn', value: formatUSDT(adminWithdrawn) },
            { label: 'Available Liquidity', value: formatUSDT(availableLiquidity) },
            { label: 'Utilization Rate', value: `${utilizationRate}%` },
            { label: 'Deposit APY', value: formatAPY(depositAPY) },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
              <div className="text-white font-medium">{stat.value}</div>
            </div>
          ))}
        </div>
        {poolAddress && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-xs text-slate-500 mb-1">Pool Contract</div>
            <a
              href={`https://${chainId === 97 ? 'testnet.' : ''}bscscan.com/address/${poolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-indigo-400 hover:text-indigo-300"
            >
              {poolAddress}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
