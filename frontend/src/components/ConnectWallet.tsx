import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { bsc, bscTestnet } from 'wagmi/chains'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const CHAINS = [
  { id: bscTestnet.id, name: 'BSC Testnet', short: 'tBSC', color: '#e8b240' },
  { id: bsc.id, name: 'BNB Chain', short: 'BSC', color: '#f3ba2f' },
]

function BscIcon({ color = '#f3ba2f', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill={color} />
      <path d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.002-.001 2.262-2.259zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002L16 13.706l-1.72 1.72-.199.199-.412.412.001.002-.001.001L16 18.294l2.294-2.294.001-.002-.003-.001z" fill="#fff" />
    </svg>
  )
}

export function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [showModal, setShowModal] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // walletConnect connector is kept in wagmiConfig for wallet-bridge iframe injection,
  // but should not appear in manual connect UI (requires AppKit setup + real projectId)
  const visibleConnectors = connectors.filter(c => c.type !== 'walletConnect')

  const currentChain = CHAINS.find(c => c.id === chainId) ?? CHAINS[0]
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  if (!isConnected) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 hover:border-indigo-500 rounded-full text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          <BscIcon size={15} color="#6366f1" />
          <span className="text-indigo-400">
            {isPending ? 'Connecting…' : 'Connect Wallet'}
          </span>
          <span className="text-slate-500 text-xs">▾</span>
        </button>

        {showModal && createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 space-y-3"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-semibold text-lg mb-4">Connect Wallet</h3>
              {visibleConnectors.map(connector => (
                <button
                  key={connector.uid}
                  onClick={() => { connect({ connector }); setShowModal(false) }}
                  className="w-full flex items-center gap-3 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  {connector.icon && <img src={connector.icon} alt="" className="w-6 h-6 rounded" />}
                  {connector.name}
                </button>
              ))}
              <button
                onClick={() => setShowModal(false)}
                className="w-full text-slate-400 hover:text-white py-2 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
      </>
    )
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        id="wallet-chip"
        onClick={() => setDropdownOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 hover:border-indigo-500/60 rounded-full text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
      >
        <BscIcon size={15} color={currentChain.color} />
        <span className="text-white font-bold">{currentChain.short}</span>
        <span className="text-slate-500">·</span>
        <span className="text-indigo-400 font-mono">{shortAddr}</span>
        <span className="text-slate-500 text-xs">{dropdownOpen ? '▴' : '▾'}</span>
      </button>

      {dropdownOpen && (
        <div className="absolute top-[calc(100%+6px)] right-0 min-w-[200px] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
          {/* Network switching */}
          <div className="px-3 py-2 text-xs text-slate-500 font-medium uppercase tracking-wide border-b border-slate-700">
            Switch Network
          </div>
          {CHAINS.map(chain => (
            <button
              key={chain.id}
              onClick={() => { switchChain({ chainId: chain.id }); setDropdownOpen(false) }}
              disabled={chain.id === chainId || isSwitching}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left ${
                chain.id === chainId
                  ? 'text-white bg-slate-700/50 cursor-default'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer'
              }`}
            >
              <BscIcon size={16} color={chain.color} />
              <span className="font-medium">{chain.name}</span>
              {chain.id === chainId && <span className="ml-auto text-emerald-400 text-xs">✓</span>}
            </button>
          ))}
          {/* Disconnect */}
          <div className="border-t border-slate-700">
            <button
              onClick={() => { disconnect(); setDropdownOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors cursor-pointer text-left"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
