import { useReadContract, useWriteContract, useAccount, useChainId } from 'wagmi'
import { STORAGE_ADDRESS, DOMAIN } from '../constants/addresses'
import StorageABI from '../contracts/Storage.json'

export interface StorageData {
  owner: `0x${string}`
  data: `0x${string}`
}

export interface PoolConfig {
  poolAddress: string
  depositToken: string
  collateral: Record<string, { symbol: string; ltv: number }>
  depositAPY: number
  borrowAPY: number
  logoUrl: string
  title: string
}

export function useStorage() {
  const { data: storageData, isLoading, refetch } = useReadContract({
    address: STORAGE_ADDRESS,
    abi: StorageABI,
    functionName: 'getData',
    args: [DOMAIN],
  })

  const { writeContractAsync, isPending } = useWriteContract()

  const appData = storageData as StorageData | undefined

  // Parse JSON from bytes data
  const parseConfig = (): PoolConfig | null => {
    if (!appData?.data || appData.data === '0x') return null
    try {
      const hex = appData.data.slice(2)
      const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
      const str = new TextDecoder().decode(bytes)
      return JSON.parse(str)
    } catch {
      return null
    }
  }

  const setConfig = async (config: PoolConfig) => {
    const json = JSON.stringify(config)
    const bytes = new TextEncoder().encode(json)
    const hex = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('') as `0x${string}`

    await writeContractAsync({
      address: STORAGE_ADDRESS,
      abi: StorageABI,
      functionName: 'setData',
      args: [DOMAIN, hex],
    })
    await refetch()
  }

  const config = parseConfig()

  return {
    owner: appData?.owner,
    config,
    isLoading,
    isPending,
    setConfig,
    refetch,
  }
}
