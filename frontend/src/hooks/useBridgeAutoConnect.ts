import { useEffect, useRef } from 'react'
import { useConnect, useAccount, useSwitchChain } from 'wagmi'

// BSC mainnet = 56, BSC Testnet = 97
const BSC_MAINNET_ID = 56 as const
const BSC_TESTNET_ID = 97 as const

function isBridgeMode(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('walletBridge') === 'swaponline' || window !== window.top
  } catch {
    return false
  }
}

/**
 * When Lenda is opened inside MCW iframe with ?walletBridge=swaponline,
 * wallet-apps-bridge-client.js injects window.ethereum (EIP-1193 proxy to MCW wallet).
 *
 * This hook:
 * 1. Detects bridge mode
 * 2. Waits for window.ethereum to appear (bridge client injects it asynchronously)
 * 3. Auto-connects wagmi injected() connector
 * 4. If connected chain is not BSC/BSC Testnet, requests switch to BSC
 */
export function useBridgeAutoConnect() {
  const { connect, connectors } = useConnect()
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const connectAttempted = useRef(false)

  const bridgeMode = isBridgeMode()

  // Step 1: auto-connect when in bridge mode
  useEffect(() => {
    if (!bridgeMode || isConnected || connectAttempted.current) return

    const tryConnect = (): boolean => {
      const w = window as any
      if (!w.ethereum) return false

      const injectedConnector = connectors.find((c) => c.type === 'injected')
      if (!injectedConnector) return false

      connectAttempted.current = true
      connect({ connector: injectedConnector })
      return true
    }

    if (tryConnect()) return

    // Bridge client.js injects window.ethereum after receiving BRIDGE_READY from parent.
    // Poll until it appears (usually within 200-500ms).
    const interval = setInterval(() => {
      if (tryConnect()) clearInterval(interval)
    }, 100)

    const timeout = setTimeout(() => clearInterval(interval), 5000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [bridgeMode, isConnected, connectors, connect])

  // Step 2: after connecting, switch to BSC if on unsupported chain
  useEffect(() => {
    if (!bridgeMode || !isConnected || !chainId) return
    if (chainId === BSC_MAINNET_ID || chainId === BSC_TESTNET_ID) return

    // Current chain (e.g. Ethereum=1) is not supported by Lenda — request BSC mainnet
    switchChain({ chainId: BSC_MAINNET_ID })
  }, [bridgeMode, isConnected, chainId, switchChain])
}
