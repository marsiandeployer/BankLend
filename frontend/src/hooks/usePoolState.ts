import { useReadContracts, useChainId } from 'wagmi'
import { useStorage } from './useStorage'
import { POOL_ADDRESS_FALLBACK } from '../constants/addresses'
import BankLendingPoolABI from '../contracts/BankLendingPool.json'

export interface PoolState {
  totalDeposited: bigint
  totalShares: bigint
  totalBorrowed: bigint
  adminWithdrawn: bigint
  depositAPY: number
  borrowAPY: number
  utilizationRate: number
  availableLiquidity: bigint
  lastAccrualTime: bigint
  isLoading: boolean
  poolAddress: `0x${string}` | null
  refetch: () => void
}

export function usePoolState(): PoolState {
  const chainId = useChainId()
  const { config } = useStorage()

  const poolAddress = (
    config?.poolAddress ||
    POOL_ADDRESS_FALLBACK[chainId]
  ) as `0x${string}` | null

  const isValidAddress = poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000'

  const { data, isLoading, refetch } = useReadContracts({
    contracts: isValidAddress ? [
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'totalDeposited' },
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'totalShares' },
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'totalBorrowed' },
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'adminWithdrawn' },
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'depositAPY' },
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'borrowAPY' },
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'utilizationRate' },
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'availableLiquidity' },
      { address: poolAddress!, abi: BankLendingPoolABI as any, functionName: 'lastAccrualTime' },
    ] : [],
    query: {
      enabled: !!isValidAddress,
      refetchInterval: 15_000, // refresh every 15s
    },
  })

  const [
    totalDeposited,
    totalShares,
    totalBorrowed,
    adminWithdrawn,
    depositAPY,
    borrowAPY,
    utilizationRate,
    availableLiquidity,
    lastAccrualTime,
  ] = data?.map(d => d.result) ?? []

  return {
    totalDeposited: (totalDeposited as bigint) ?? 0n,
    totalShares: (totalShares as bigint) ?? 0n,
    totalBorrowed: (totalBorrowed as bigint) ?? 0n,
    adminWithdrawn: (adminWithdrawn as bigint) ?? 0n,
    depositAPY: Number(depositAPY ?? 800),
    borrowAPY: Number(borrowAPY ?? 1500),
    utilizationRate: Number(utilizationRate ?? 0),
    availableLiquidity: (availableLiquidity as bigint) ?? 0n,
    lastAccrualTime: (lastAccrualTime as bigint) ?? 0n,
    isLoading,
    poolAddress: isValidAddress ? poolAddress : null,
    refetch,
  }
}
