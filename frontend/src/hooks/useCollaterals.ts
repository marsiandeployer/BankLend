import { useReadContracts } from 'wagmi'
import { usePoolState } from './usePoolState'

export interface CollateralInfo {
  address: `0x${string}`
  symbol: string
  decimals: number
  ltv: number        // percent (0-90)
  priceFeed: `0x${string}`
  priceUSD: number   // current price from Chainlink
  enabled: boolean
}

const POOL_COLLATERAL_ABI = [
  {
    inputs: [],
    name: 'getSupportedCollaterals',
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'collateralConfigs',
    outputs: [
      { name: 'priceFeed', type: 'address' },
      { name: 'ltv', type: 'uint256' },
      { name: 'enabled', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const ERC20_META_ABI = [
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const CHAINLINK_ABI = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export function useCollaterals(): { collaterals: CollateralInfo[]; isLoading: boolean } {
  const { poolAddress } = usePoolState()

  // Step 1: get supported collateral addresses
  const { data: listData, isLoading: listLoading } = useReadContracts({
    contracts: poolAddress
      ? [{ address: poolAddress, abi: POOL_COLLATERAL_ABI as any, functionName: 'getSupportedCollaterals' }]
      : [],
    query: { enabled: !!poolAddress, refetchInterval: 30_000 },
  })

  const collateralAddresses = (listData?.[0]?.result as `0x${string}`[] | undefined) ?? []

  // Step 2: per-collateral: configs + symbol + decimals (3 calls each)
  const configContracts = collateralAddresses.flatMap(addr => [
    { address: poolAddress as `0x${string}`, abi: POOL_COLLATERAL_ABI as any, functionName: 'collateralConfigs', args: [addr] },
    { address: addr, abi: ERC20_META_ABI as any, functionName: 'symbol' },
    { address: addr, abi: ERC20_META_ABI as any, functionName: 'decimals' },
  ])

  const { data: configData, isLoading: configLoading } = useReadContracts({
    contracts: configContracts,
    query: { enabled: collateralAddresses.length > 0, refetchInterval: 30_000 },
  })

  interface ParsedConfig {
    priceFeed: `0x${string}`
    ltv: number
    enabled: boolean
    symbol: string
    decimals: number
  }

  const parsedConfigs: ParsedConfig[] = collateralAddresses.map((_, i) => {
    const base = i * 3
    const cfgRaw = configData?.[base]?.result as any
    const symbol = (configData?.[base + 1]?.result as string | undefined) ?? '???'
    const decimals = Number(configData?.[base + 2]?.result ?? 18)
    return {
      priceFeed: (cfgRaw?.[0] ?? '0x') as `0x${string}`,
      ltv: Number(cfgRaw?.[1] ?? 0),
      enabled: Boolean(cfgRaw?.[2] ?? false),
      symbol,
      decimals,
    }
  })

  // Step 3: Chainlink prices for each collateral
  const priceContracts = parsedConfigs
    .filter(cfg => cfg.priceFeed && cfg.priceFeed !== '0x')
    .map(cfg => ({
      address: cfg.priceFeed,
      abi: CHAINLINK_ABI as any,
      functionName: 'latestRoundData',
    }))

  const { data: priceData, isLoading: priceLoading } = useReadContracts({
    contracts: priceContracts,
    query: { enabled: priceContracts.length > 0, refetchInterval: 30_000 },
  })

  // Map price results back by index (only for non-zero priceFeeds)
  const priceByIndex: number[] = []
  let priceIdx = 0
  parsedConfigs.forEach(cfg => {
    if (cfg.priceFeed && cfg.priceFeed !== '0x') {
      const raw = priceData?.[priceIdx]?.result as any
      priceByIndex.push(raw ? Number(raw[1]) / 1e8 : 0)
      priceIdx++
    } else {
      priceByIndex.push(0)
    }
  })

  const collaterals: CollateralInfo[] = collateralAddresses.map((addr, i) => {
    const cfg = parsedConfigs[i]
    return {
      address: addr,
      symbol: cfg?.symbol ?? '???',
      decimals: cfg?.decimals ?? 18,
      ltv: cfg?.ltv ?? 0,
      priceFeed: cfg?.priceFeed ?? ('0x' as `0x${string}`),
      priceUSD: priceByIndex[i] ?? 0,
      enabled: cfg?.enabled ?? false,
    }
  })

  return {
    collaterals,
    isLoading: listLoading || configLoading || priceLoading,
  }
}
