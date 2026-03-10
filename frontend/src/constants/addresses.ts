import { bsc, bscTestnet } from 'wagmi/chains'

// onout.org Storage contracts — different addresses per network
export const STORAGE_ADDRESSES: Record<number, `0x${string}`> = {
  [bsc.id]: '0xa7472f384339D37EfE505a1A71619212495A973A',
  [bscTestnet.id]: '0xF0BCf27a2203E7E8c1e9D36F40EF2C5A8a6E7D0B',
}

// Kept for backward-compat (useAdmin.ts imports it)
export const STORAGE_ADDRESS = STORAGE_ADDRESSES[bsc.id]

// Domain used as key in Storage contract (chain-specific)
export const DOMAINS: Record<number, string> = {
  [bsc.id]: 'lenda.onout.org',
  [bscTestnet.id]: 'lenda-testnet.onout.org',
}

// Legacy DOMAIN kept for reference
export const DOMAIN = 'lenda.onout.org'

// BSC token addresses (mainnet + testnet mocks)
export const TOKENS = {
  [bsc.id]: {
    USDT: '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`,
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`,
    WETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' as `0x${string}`,
  },
  [bscTestnet.id]: {
    USDT: '0x0B4Ed842a0b6df71ba19A095DA59db772021Af8c' as `0x${string}`,
    WBNB: '0x72193591c8FFF4BEea51805346BDF8A08bbD38dF' as `0x${string}`,
    WETH: '0x' as `0x${string}`,
  },
} as const

// Pool contract address fallback (actual address loaded from Storage; this is used when Storage has no config)
export const POOL_ADDRESS_FALLBACK: Record<number, `0x${string}`> = {
  [bsc.id]: '0x0000000000000000000000000000000000000000',
  [bscTestnet.id]: '0x7411fd9eDD2D9F620c3a3E91fb43b5aB78E49Cec',
}

export const SUPPORTED_CHAINS = [bsc, bscTestnet] as const
export const DEFAULT_CHAIN = bscTestnet
