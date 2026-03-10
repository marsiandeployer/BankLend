import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState } from 'react'

export function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [showModal, setShowModal] = useState(false)

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-emerald-400 font-mono bg-emerald-400/10 px-3 py-1 rounded-lg">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-sm text-slate-400 hover:text-white px-3 py-1 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg mb-4">Connect Wallet</h3>
            {connectors.map(connector => (
              <button
                key={connector.uid}
                onClick={() => {
                  connect({ connector })
                  setShowModal(false)
                }}
                className="w-full flex items-center gap-3 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              >
                {connector.icon && (
                  <img src={connector.icon} alt="" className="w-6 h-6 rounded" />
                )}
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
        </div>
      )}
    </>
  )
}
