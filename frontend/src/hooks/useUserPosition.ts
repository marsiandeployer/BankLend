import { useReadContracts } from 'wagmi'
import { usePoolState } from './usePoolState'

export interface UserBorrow {
  collateralToken: `0x${string}`
  collateralAmount: bigint
  principal: bigint
  interestOwed: bigint
  startTime: bigint
}

export interface UserPosition {
  shares: bigint
  depositValue: bigint  // shares → USDT
  borrow: UserBorrow | null
  healthFactor: bigint  // scaled 1e18
  pendingInterest: bigint
  isLoading: boolean
  refetch: () => void
}

export function useUserPosition(userAddress: `0x${string}` | undefined): UserPosition {
  const { poolAddress } = usePoolState()

  const enabled = !!poolAddress && !!userAddress

  const { data, isLoading, refetch } = useReadContracts({
    contracts: enabled ? [
      { address: poolAddress!, abi: POOL_ABI as any, functionName: 'userShares', args: [userAddress!] },
      { address: poolAddress!, abi: POOL_ABI as any, functionName: 'userDepositValue', args: [userAddress!] },
      { address: poolAddress!, abi: POOL_ABI as any, functionName: 'borrows', args: [userAddress!] },
      { address: poolAddress!, abi: POOL_ABI as any, functionName: 'healthFactor', args: [userAddress!] },
      { address: poolAddress!, abi: POOL_ABI as any, functionName: 'pendingInterest', args: [userAddress!] },
    ] : [],
    query: {
      enabled,
      refetchInterval: 15_000,
    },
  })

  const [shares, depositValue, borrowRaw, healthFactor, pendingInterest] = data?.map(d => d.result) ?? []

  // borrowRaw is a tuple: [collateralToken, collateralAmount, principal, interestOwed, startTime]
  const borrow = borrowRaw as any
  const hasBorrow = borrow && borrow[2] > 0n

  return {
    shares: (shares as bigint) ?? 0n,
    depositValue: (depositValue as bigint) ?? 0n,
    borrow: hasBorrow ? {
      collateralToken: borrow[0] as `0x${string}`,
      collateralAmount: borrow[1] as bigint,
      principal: borrow[2] as bigint,
      interestOwed: borrow[3] as bigint,
      startTime: borrow[4] as bigint,
    } : null,
    healthFactor: (healthFactor as bigint) ?? 0n,
    pendingInterest: (pendingInterest as bigint) ?? 0n,
    isLoading,
    refetch,
  }
}

// Minimal ABI subset for reading user position
const POOL_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'userShares',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'userDepositValue',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'borrows',
    outputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'principal', type: 'uint256' },
      { name: 'interestOwed', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'borrower', type: 'address' }],
    name: 'healthFactor',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'borrower', type: 'address' }],
    name: 'pendingInterest',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]
