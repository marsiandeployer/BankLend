import { bsc, bscTestnet } from 'wagmi/chains'

// onout.org Storage contract — same address on BSC mainnet and testnet
export const STORAGE_ADDRESS = '0xa7472f384339D37EfE505a1A71619212495A973A' as const

// Domain used as key in Storage contract
export const DOMAIN = typeof window !== 'undefined'
  ? window.location.hostname
  : 'lenda.onout.org'

// BSC mainnet token addresses
export const TOKENS = {
  [bsc.id]: {
    USDT: '0x55d398326f99059fF775485246999027B3197955' as `0x${string}`,
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as `0x${string}`,
    WETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' as `0x${string}`,
  },
  [bscTestnet.id]: {
    USDT: '0x' as `0x${string}`, // Set after testnet deployment
    WBNB: '0x' as `0x${string}`, // Set after testnet deployment
    WETH: '0x' as `0x${string}`,
  },
} as const

// Pool contract address — loaded from Storage or set here after deployment
// This is a fallback; actual address is read from Storage
export const POOL_ADDRESS_FALLBACK: Record<number, `0x${string}`> = {
  [bsc.id]: '0x0000000000000000000000000000000000000000',
  [bscTestnet.id]: '0x0000000000000000000000000000000000000000',
}

export const SUPPORTED_CHAINS = [bsc, bscTestnet] as const
export const DEFAULT_CHAIN = bsc
